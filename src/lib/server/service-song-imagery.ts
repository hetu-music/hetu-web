import { unstable_cache } from "next/cache";
import { fetchAll, getServiceClient, TABLES } from "@/lib/db/supabase-server";
import {
  GRAY_PALETTE,
  PALETTE_FULL,
  sortLevel1Categories,
} from "@/lib/imagery/palette";
import { SONG_IMAGERY_TAG } from "@/lib/imagery/tags";
import type {
  RelatedSong,
  SongImageryMark,
  SongImageryView,
} from "@/lib/types";
import { toTraditional, toTraditionalArray } from "@/lib/utils/utils-convert";
import {
  applyCreditAliases,
  type CreditAliasMap,
} from "@/lib/utils/utils-credits";
import { getCreditAliases } from "@/lib/server/service-credit-aliases";

const RELATED_LIMIT = 4;
const SHARED_LIMIT = 3;
/**
 * 基调在相关作品排序里的分量：得分 = 意象相似度 × (1 − β + β × 基调相似度)。
 * 只看意象时，推荐与本曲主基调相同的仅 19%（随机两首 11%）；β=0.3 时 45%，
 * 仍保留原推荐的 65%。不再加大，因为怅惘与思念、孤寂的边界本就标不稳
 */
const EMOTION_WEIGHT = 0.3;
const MAIN_EMOTION_WEIGHT = 2;

type CategoryRow = {
  id: number;
  name: string;
  parent_id: number | null;
  level: number | null;
};

type ImageryIndex = {
  categories: CategoryRow[];
  imagery: Array<{ id: number; name: string }>;
  occurrences: Array<{
    song_id: number;
    imagery_id: number;
    category_id: number;
    lyric_timetag: string[] | null;
  }>;
  songs: Array<{
    id: number;
    title: string;
    artist: string[] | null;
    hascover: boolean | null;
  }>;
  songEmotions: Array<{ song_id: number; emotion_id: number; rank: number }>;
};

/**
 * 相关作品要拿全库标注做相似度，每个详情页各查一遍太重；
 * 与寻曲候选池一样跨请求缓存，2 小时刷新。
 */
const loadImageryIndex = unstable_cache(
  async (): Promise<ImageryIndex> => {
    // 失败时抛错而不返回空数据：unstable_cache 不缓存异常
    const supabase = getServiceClient();
    if (!supabase) throw new Error("Supabase 未配置");
    const [categories, imagery, occurrences, songs, songEmotions] =
      await Promise.all([
        fetchAll<ImageryIndex["categories"][number]>(
          supabase,
          TABLES.IMAGERY_CAT,
          "id,name,parent_id,level",
        ),
        fetchAll<ImageryIndex["imagery"][number]>(
          supabase,
          TABLES.IMAGERY,
          "id,name",
        ),
        fetchAll<ImageryIndex["occurrences"][number]>(
          supabase,
          TABLES.IMAGERY_OCC,
          "song_id,imagery_id,category_id,lyric_timetag",
        ),
        // 出处取全部歌曲（存疑的歌自己的详情页也要标意象），
        // 歌曲只取计入曲库的：作品数统计与相关作品都以它为范围
        fetchAll<ImageryIndex["songs"][number]>(
          supabase,
          TABLES.MUSIC_CATALOG,
          "id,title,artist,hascover",
        ),
        fetchAll<ImageryIndex["songEmotions"][number]>(
          supabase,
          TABLES.SONG_EMOTIONS,
          "song_id,emotion_id,rank",
        ),
      ]);
    if (occurrences.length === 0 || songs.length === 0) {
      throw new Error("意象索引数据为空");
    }
    return { categories, imagery, occurrences, songs, songEmotions };
  },
  ["song-imagery-index-v3"],
  { revalidate: 7200, tags: [SONG_IMAGERY_TAG] },
);

/**
 * 两首歌基调的余弦相似度，主基调记 2、副基调记 1。
 * 任一首没标基调记 0：本曲没标时所有候选同乘一个系数，排序不变
 */
function emotionSimilarity(
  a: Map<number, number> | undefined,
  b: Map<number, number> | undefined,
): number {
  if (!a || !b) return 0;
  let dot = 0;
  for (const [id, w] of a) dot += w * (b.get(id) ?? 0);
  const norm = (v: Map<number, number>) =>
    Math.sqrt([...v.values()].reduce((sum, w) => sum + w * w, 0));
  return dot / (norm(a) * norm(b));
}

/** 「（纯歌版）」「(DJ版)」等衍生版本与原曲同源，不互相推荐 */
function baseTitle(title: string): string {
  return title.replace(/\s*[（(][^（）()]*[）)]\s*$/, "").trim();
}

export async function getSongImagery(
  songId: number,
  locale: string,
): Promise<SongImageryView> {
  let index: ImageryIndex;
  let aliases: CreditAliasMap;
  try {
    [index, aliases] = await Promise.all([
      loadImageryIndex(),
      getCreditAliases(),
    ]);
  } catch (e) {
    console.error("[getSongImagery] 加载意象索引失败", e);
    return { marks: [], related: [] };
  }
  const tr =
    locale === "zh-TW"
      ? (s: string) => toTraditional(s) ?? s
      : (s: string) => s;

  const catById = new Map(index.categories.map((c) => [c.id, c]));
  const l1Color = new Map(
    sortLevel1Categories(index.categories).map((c, i) => [
      c.id,
      PALETTE_FULL[i % PALETTE_FULL.length].accent,
    ]),
  );
  const pathOf = (categoryId: number): CategoryRow[] => {
    const path: CategoryRow[] = [];
    let cat = catById.get(categoryId);
    while (cat && path.length < 5) {
      path.unshift(cat);
      cat = cat.parent_id !== null ? catById.get(cat.parent_id) : undefined;
    }
    return path;
  };

  // 每首歌的母题集合，以及每个母题覆盖的作品数。按母题而非词聚合：
  // 写「明月」与写「月光」的歌算作写了同一个东西（见 IMAGERY.md）
  const songIds = new Set(index.songs.map((s) => s.id));
  const imageryBySong = new Map<number, Set<number>>();
  for (const occ of index.occurrences) {
    if (!songIds.has(occ.song_id)) continue;
    let set = imageryBySong.get(occ.song_id);
    if (!set) imageryBySong.set(occ.song_id, (set = new Set()));
    set.add(occ.category_id);
  }
  const df = new Map<number, number>();
  for (const set of imageryBySong.values()) {
    for (const id of set) df.set(id, (df.get(id) ?? 0) + 1);
  }

  // ── 本曲意象：一个词一处高亮。并列词（「风雨」）有几条标注，取第一条的母题作说明 ──
  const imageryName = new Map(index.imagery.map((i) => [i.id, i.name]));
  const byImagery = new Map<number, SongImageryMark>();
  const own = new Set<number>();
  for (const occ of index.occurrences) {
    if (occ.song_id !== songId) continue;
    own.add(occ.category_id);
    const existing = byImagery.get(occ.imagery_id);
    if (existing) {
      for (const tag of occ.lyric_timetag ?? []) {
        if (!existing.timetags.includes(tag)) existing.timetags.push(tag);
      }
      continue;
    }
    const path = pathOf(occ.category_id);
    byImagery.set(occ.imagery_id, {
      id: occ.imagery_id,
      name: tr(imageryName.get(occ.imagery_id) ?? ""),
      path: path.map((c) => tr(c.name)),
      accent: (path[0] && l1Color.get(path[0].id)) ?? GRAY_PALETTE.accent,
      timetags: [...new Set(occ.lyric_timetag ?? [])],
      songCount: df.get(occ.category_id) ?? 1,
    });
  }
  const marks = [...byImagery.values()].filter((m) => m.name);

  // ── 相关作品：以 IDF 加权的母题集合余弦相似度，少见的共同母题更能说明气质相近；
  // 再按基调相似度微调，免得意象相近、情绪相反的歌排在前面。推荐理由只列意象 ──
  // 不从 imageryBySong 取：存疑的歌不在曲库范围内，但它的详情页照样推荐相关作品
  const related: RelatedSong[] = [];
  if (own && own.size > 0) {
    const n = imageryBySong.size;
    const idf = (id: number) => Math.log(n / (df.get(id) ?? n));
    const norm = (set: Set<number>) =>
      Math.sqrt([...set].reduce((sum, id) => sum + idf(id) ** 2, 0));
    const ownNorm = norm(own);
    const songById = new Map(index.songs.map((s) => [s.id, s]));
    const ownBase = baseTitle(songById.get(songId)?.title ?? "");
    const emotionsBySong = new Map<number, Map<number, number>>();
    for (const row of index.songEmotions) {
      let vec = emotionsBySong.get(row.song_id);
      if (!vec) emotionsBySong.set(row.song_id, (vec = new Map()));
      vec.set(row.emotion_id, row.rank === 1 ? MAIN_EMOTION_WEIGHT : 1);
    }
    const ownEmotions = emotionsBySong.get(songId);

    const scored: Array<{ id: number; score: number; shared: number[] }> = [];
    for (const [otherId, set] of imageryBySong) {
      if (otherId === songId) continue;
      const shared = [...set].filter((id) => own.has(id));
      if (shared.length === 0) continue;
      const dot = shared.reduce((sum, id) => sum + idf(id) ** 2, 0);
      const denom = ownNorm * norm(set);
      if (denom === 0) continue;
      const mood = emotionSimilarity(ownEmotions, emotionsBySong.get(otherId));
      scored.push({
        id: otherId,
        score: (dot / denom) * (1 - EMOTION_WEIGHT + EMOTION_WEIGHT * mood),
        shared,
      });
    }
    scored.sort((a, b) => b.score - a.score);

    const seenBase = new Set([ownBase]);
    for (const { id, shared } of scored) {
      const found = songById.get(id);
      if (!found) continue;
      const song = applyCreditAliases(found, aliases);
      const base = baseTitle(song.title);
      if (seenBase.has(base)) continue;
      seenBase.add(base);
      related.push({
        id,
        title: tr(song.title),
        artist:
          locale === "zh-TW" ? toTraditionalArray(song.artist) : song.artist,
        hascover: song.hascover,
        shared: shared
          .sort((a, b) => idf(b) - idf(a))
          .slice(0, SHARED_LIMIT)
          .map((sid) => tr(catById.get(sid)?.name ?? ""))
          .filter(Boolean),
      });
      if (related.length >= RELATED_LIMIT) break;
    }
  }

  return { marks, related };
}
