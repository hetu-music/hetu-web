import { unstable_cache } from "next/cache";
import { fetchAll, getServiceClient, TABLES } from "@/lib/db/supabase-server";
import {
  GRAY_PALETTE,
  PALETTE_FULL,
  sortLevel1Categories,
} from "@/lib/imagery/palette";
import { SONG_IMAGERY_TAG } from "@/lib/imagery/tags";
import type {
  LibraryImagery,
  LibraryImageryItem,
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
    const [categories, imagery, occurrences, songs] = await Promise.all([
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
    ]);
    if (occurrences.length === 0 || songs.length === 0) {
      throw new Error("意象索引数据为空");
    }
    return { categories, imagery, occurrences, songs };
  },
  ["song-imagery-index-v1"],
  { revalidate: 7200, tags: [SONG_IMAGERY_TAG] },
);

/** 「（纯歌版）」「(DJ版)」等衍生版本与原曲同源，不互相推荐 */
function baseTitle(title: string): string {
  return title.replace(/\s*[（(][^（）()]*[）)]\s*$/, "").trim();
}

/** 全库的意象统计：分类路径、一级分类配色、每首歌的意象集合与每个意象的作品数 */
function analyseIndex(index: ImageryIndex) {
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

  // 每首歌的意象集合，以及每个意象覆盖的作品数
  const songIds = new Set(index.songs.map((s) => s.id));
  const imageryBySong = new Map<number, Set<number>>();
  for (const occ of index.occurrences) {
    if (!songIds.has(occ.song_id)) continue;
    let set = imageryBySong.get(occ.song_id);
    if (!set) imageryBySong.set(occ.song_id, (set = new Set()));
    set.add(occ.imagery_id);
  }
  const df = new Map<number, number>();
  for (const set of imageryBySong.values()) {
    for (const id of set) df.set(id, (df.get(id) ?? 0) + 1);
  }

  const imageryName = new Map(index.imagery.map((i) => [i.id, i.name]));
  return { pathOf, l1Color, imageryBySong, df, imageryName };
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

  const { pathOf, l1Color, imageryBySong, df, imageryName } =
    analyseIndex(index);

  // ── 本曲意象 ──
  const byImagery = new Map<number, SongImageryMark>();
  for (const occ of index.occurrences) {
    if (occ.song_id !== songId) continue;
    const existing = byImagery.get(occ.imagery_id);
    if (existing) {
      existing.timetags.push(...(occ.lyric_timetag ?? []));
      continue;
    }
    const path = pathOf(occ.category_id);
    byImagery.set(occ.imagery_id, {
      id: occ.imagery_id,
      name: tr(imageryName.get(occ.imagery_id) ?? ""),
      path: path.map((c) => tr(c.name)),
      accent: (path[0] && l1Color.get(path[0].id)) ?? GRAY_PALETTE.accent,
      timetags: [...(occ.lyric_timetag ?? [])],
      songCount: df.get(occ.imagery_id) ?? 1,
    });
  }
  const marks = [...byImagery.values()].filter((m) => m.name);

  // ── 相关作品：以 IDF 加权的意象集合余弦相似度，少见的共同意象更能说明气质相近 ──
  // 不从 imageryBySong 取：存疑的歌不在曲库范围内，但它的详情页照样推荐相关作品
  const own = new Set(byImagery.keys());
  const related: RelatedSong[] = [];
  if (own && own.size > 0) {
    const n = imageryBySong.size;
    const idf = (id: number) => Math.log(n / (df.get(id) ?? n));
    const norm = (set: Set<number>) =>
      Math.sqrt([...set].reduce((sum, id) => sum + idf(id) ** 2, 0));
    const ownNorm = norm(own);
    const songById = new Map(index.songs.map((s) => [s.id, s]));
    const ownBase = baseTitle(songById.get(songId)?.title ?? "");

    const scored: Array<{ id: number; score: number; shared: number[] }> = [];
    for (const [otherId, set] of imageryBySong) {
      if (otherId === songId) continue;
      const shared = [...set].filter((id) => own.has(id));
      if (shared.length === 0) continue;
      const dot = shared.reduce((sum, id) => sum + idf(id) ** 2, 0);
      const denom = ownNorm * norm(set);
      if (denom === 0) continue;
      scored.push({ id: otherId, score: dot / denom, shared });
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
          .map((sid) => tr(imageryName.get(sid) ?? ""))
          .filter(Boolean),
      });
      if (related.length >= RELATED_LIMIT) break;
    }
  }

  return { marks, related };
}

/**
 * 主页封面墙用的意象数据：每首歌写到哪些意象，以及这些意象的名称、配色与作品数。
 * 只含计入曲库的歌（存疑的歌在墙上照常出现，但不参与意象点灯与相认）。
 */
export async function getLibraryImagery(
  locale: string,
): Promise<LibraryImagery> {
  let index: ImageryIndex;
  try {
    index = await loadImageryIndex();
  } catch (e) {
    console.error("[getLibraryImagery] 加载意象索引失败", e);
    return { bySong: {}, items: [] };
  }
  const tr =
    locale === "zh-TW"
      ? (s: string) => toTraditional(s) ?? s
      : (s: string) => s;
  const { pathOf, l1Color, imageryBySong, df, imageryName } =
    analyseIndex(index);

  // 同一意象在不同出处可能归在不同分类下，配色取出现最多的那个一级分类
  const l1Votes = new Map<number, Map<number, number>>();
  for (const occ of index.occurrences) {
    const l1 = pathOf(occ.category_id)[0];
    if (!l1) continue;
    let votes = l1Votes.get(occ.imagery_id);
    if (!votes) l1Votes.set(occ.imagery_id, (votes = new Map()));
    votes.set(l1.id, (votes.get(l1.id) ?? 0) + 1);
  }
  const l1Of = (imageryId: number) => {
    let best: number | undefined;
    let bestCount = 0;
    for (const [id, count] of l1Votes.get(imageryId) ?? []) {
      if (count > bestCount) [best, bestCount] = [id, count];
    }
    return best;
  };

  const items: LibraryImageryItem[] = [];
  for (const [id, songCount] of df) {
    const name = imageryName.get(id);
    if (!name) continue;
    const l1 = l1Of(id);
    items.push({
      id,
      name: tr(name),
      accent: (l1 !== undefined && l1Color.get(l1)) || GRAY_PALETTE.accent,
      songCount,
    });
  }

  const bySong: Record<number, number[]> = {};
  for (const [songId, set] of imageryBySong) bySong[songId] = [...set];

  return { bySong, items };
}
