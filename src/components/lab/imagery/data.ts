import "server-only";

import { unstable_cache } from "next/cache";
import { fetchAll, getServiceClient, TABLES } from "@/lib/db/supabase-server";
import { parseLrcLines } from "@/lib/imagery/suggest";
import { PALETTE_FULL, sortLevel1Categories } from "@/lib/imagery/palette";
import { SONG_IMAGERY_TAG } from "@/lib/imagery/tags";

/**
 * 意象页原型（母题为单位）的数据。全库标注一次读进来，跨请求缓存；
 * 母题页只另取写到该母题的歌的歌词。
 */

type CategoryRow = {
  id: number;
  name: string;
  parent_id: number | null;
  level: number | null;
  description: string | null;
};

type EmotionRow = {
  id: number;
  name: string;
  tone: string;
  energy: string;
  sort: number;
};

type Index = {
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
    date: string | null;
    hascover: boolean | null;
    lyricist: string[] | null;
  }>;
  emotions: EmotionRow[];
  songEmotions: Array<{ song_id: number; emotion_id: number; rank: number }>;
};

const loadIndex = unstable_cache(
  async (): Promise<Index> => {
    const supabase = getServiceClient();
    if (!supabase) throw new Error("Supabase 未配置");
    const [categories, imagery, occurrences, songs, emotions, songEmotions] =
      await Promise.all([
        fetchAll<Index["categories"][number]>(
          supabase,
          TABLES.IMAGERY_CAT,
          "id,name,parent_id,level,description",
        ),
        fetchAll<Index["imagery"][number]>(supabase, TABLES.IMAGERY, "id,name"),
        fetchAll<Index["occurrences"][number]>(
          supabase,
          TABLES.IMAGERY_OCC,
          "song_id,imagery_id,category_id,lyric_timetag",
        ),
        fetchAll<Index["songs"][number]>(
          supabase,
          TABLES.MUSIC_CATALOG,
          "id,title,date,hascover,lyricist",
        ),
        fetchAll<EmotionRow>(
          supabase,
          TABLES.EMOTIONS,
          "id,name,tone,energy,sort",
        ),
        fetchAll<Index["songEmotions"][number]>(
          supabase,
          TABLES.SONG_EMOTIONS,
          "song_id,emotion_id,rank",
        ),
      ]);
    if (occurrences.length === 0 || songs.length === 0) {
      throw new Error("意象索引数据为空");
    }
    return { categories, imagery, occurrences, songs, emotions, songEmotions };
  },
  ["lab-motif-index-v2"],
  { revalidate: 7200, tags: [SONG_IMAGERY_TAG] },
);

/** 只算曲库里的歌；作品数一律按歌去重 */
function derive(index: Index) {
  const catById = new Map(index.categories.map((c) => [c.id, c]));
  const l1 = sortLevel1Categories(index.categories);
  // 配色记成 PALETTE_FULL 的下标，客户端据此取深浅两套颜色；-1 为灰
  const paletteOfL1 = new Map(
    l1.map((c, i) => [c.id, i % PALETTE_FULL.length]),
  );
  const pathOf = (id: number): CategoryRow[] => {
    const path: CategoryRow[] = [];
    let cat = catById.get(id);
    while (cat && path.length < 5) {
      path.unshift(cat);
      cat = cat.parent_id !== null ? catById.get(cat.parent_id) : undefined;
    }
    return path;
  };
  const paletteOf = (motifId: number) => {
    const root = pathOf(motifId)[0];
    return (root && paletteOfL1.get(root.id)) ?? -1;
  };

  const catalog = new Set(index.songs.map((s) => s.id));
  const songsByMotif = new Map<number, Set<number>>();
  const motifsBySong = new Map<number, Set<number>>();
  // 词 → 母题 → 歌：多义词在不同母题下各算各的
  const wordMotifSongs = new Map<number, Map<number, Set<number>>>();
  for (const occ of index.occurrences) {
    if (!catalog.has(occ.song_id)) continue;
    let songs = songsByMotif.get(occ.category_id);
    if (!songs) songsByMotif.set(occ.category_id, (songs = new Set()));
    songs.add(occ.song_id);
    let motifs = motifsBySong.get(occ.song_id);
    if (!motifs) motifsBySong.set(occ.song_id, (motifs = new Set()));
    motifs.add(occ.category_id);
    let byMotif = wordMotifSongs.get(occ.imagery_id);
    if (!byMotif) wordMotifSongs.set(occ.imagery_id, (byMotif = new Map()));
    let wordSongs = byMotif.get(occ.category_id);
    if (!wordSongs) byMotif.set(occ.category_id, (wordSongs = new Set()));
    wordSongs.add(occ.song_id);
  }
  return {
    catById,
    l1,
    paletteOfL1,
    pathOf,
    paletteOf,
    catalog,
    songsByMotif,
    motifsBySong,
    wordMotifSongs,
  };
}

// ─── 索引页 ────────────────────────────────────────────────────────────────

export type IndexMotif = {
  id: number;
  name: string;
  l1: number;
  l2: number;
  palette: number;
  songCount: number;
  /** 这个母题下的写法，按作品数排；搜索时用 */
  words: string[];
};

export type IndexWord = {
  id: number;
  name: string;
  songCount: number;
  /** 作品最多的那个母题：点词时去它的母题页 */
  motif: number;
  l1: number;
  l2: number;
  palette: number;
};

export type IndexGroup = {
  id: number;
  name: string;
  l1: number;
  palette: number;
  motifs: IndexMotif[];
};

export type IndexData = {
  l1: Array<{ id: number; name: string; palette: number }>;
  groups: IndexGroup[];
  words: IndexWord[];
  motifCount: number;
  songCount: number;
};

export async function getMotifIndex(): Promise<IndexData> {
  const index = await loadIndex();
  const d = derive(index);
  const wordName = new Map(index.imagery.map((i) => [i.id, i.name]));

  const wordsOfMotif = new Map<number, Array<[string, number]>>();
  const words: IndexWord[] = [];
  for (const [wordId, byMotif] of d.wordMotifSongs) {
    const name = wordName.get(wordId);
    if (!name) continue;
    const all = new Set<number>();
    let top = 0;
    let topSize = -1;
    for (const [motifId, songs] of byMotif) {
      for (const s of songs) all.add(s);
      if (songs.size > topSize) [top, topSize] = [motifId, songs.size];
      let list = wordsOfMotif.get(motifId);
      if (!list) wordsOfMotif.set(motifId, (list = []));
      list.push([name, songs.size]);
    }
    const [root, l2] = d.pathOf(top);
    words.push({
      id: wordId,
      name,
      songCount: all.size,
      motif: top,
      l1: root?.id ?? 0,
      l2: l2?.id ?? 0,
      palette: d.paletteOf(top),
    });
  }
  words.sort((a, b) => b.songCount - a.songCount || a.id - b.id);

  const groups = new Map<number, IndexGroup>();
  for (const [motifId, songs] of d.songsByMotif) {
    const path = d.pathOf(motifId);
    const [root, l2, motif] = path;
    if (!root || !l2 || !motif) continue;
    let group = groups.get(l2.id);
    if (!group) {
      groups.set(
        l2.id,
        (group = {
          id: l2.id,
          name: l2.name,
          l1: root.id,
          palette: d.paletteOf(motifId),
          motifs: [],
        }),
      );
    }
    group.motifs.push({
      id: motifId,
      name: motif.name,
      l1: root.id,
      l2: l2.id,
      palette: group.palette,
      songCount: songs.size,
      words: (wordsOfMotif.get(motifId) ?? [])
        .sort((a, b) => b[1] - a[1])
        .map(([w]) => w),
    });
  }
  const l1Order = new Map(d.l1.map((c, i) => [c.id, i]));
  const sortedGroups = [...groups.values()]
    .map((g) => ({
      ...g,
      motifs: g.motifs.sort((a, b) => b.songCount - a.songCount),
    }))
    .sort(
      (a, b) =>
        (l1Order.get(a.l1) ?? 99) - (l1Order.get(b.l1) ?? 99) ||
        b.motifs.reduce((s, m) => s + m.songCount, 0) -
          a.motifs.reduce((s, m) => s + m.songCount, 0),
    );

  return {
    l1: d.l1.map((c) => ({
      id: c.id,
      name: c.name,
      palette: d.paletteOfL1.get(c.id) ?? -1,
    })),
    groups: sortedGroups,
    words,
    motifCount: d.songsByMotif.size,
    songCount: d.motifsBySong.size,
  };
}

// ─── 母题页 ────────────────────────────────────────────────────────────────

export type MotifWord = { id: number; name: string; songCount: number };

export type MotifWork = {
  id: number;
  title: string;
  year: string | null;
  hascover: boolean | null;
  lyricist: string[] | null;
  /** 本曲在这个母题下用到的写法 */
  wordIds: number[];
  /** 写到它的歌词，按出现顺序；没有时间轴的歌按字面找行 */
  lines: string[];
};

export type MotifEmotion = {
  id: number;
  name: string;
  tone: string;
  energy: string;
  /** 写到这个母题的歌里，主基调是它的比例 */
  share: number;
  count: number;
  /** 全库的比例 */
  base: number;
};

export type MotifLink = {
  id: number;
  name: string;
  palette: number;
  both: number;
  lift: number;
};

export type MotifData = {
  id: number;
  name: string;
  path: string[];
  palette: number;
  description: string | null;
  songCount: number;
  words: MotifWord[];
  works: MotifWork[];
  emotions: MotifEmotion[];
  /** 有基调的作品数；太少时不显示偏向 */
  emotionSample: number;
  cowritten: MotifLink[];
  /** 同一二级分类下的其他母题 */
  siblings: Array<{ id: number; name: string; songCount: number }>;
};

/** 同写：至少几首歌一起写到、对方至少写到几首，才算数 */
const COWRITE_MIN_BOTH = 4;
const COWRITE_MIN_OTHER = 5;
const COWRITE_MIN_LIFT = 1.8;
const COWRITE_LIMIT = 10;

export async function getMotif(motifId: number): Promise<MotifData | null> {
  const index = await loadIndex();
  const d = derive(index);
  const motif = d.catById.get(motifId);
  const own = d.songsByMotif.get(motifId);
  if (!motif || motif.level !== 3 || !own) return null;
  const path = d.pathOf(motifId);
  const wordName = new Map(index.imagery.map((i) => [i.id, i.name]));

  // 写法
  const words: MotifWord[] = [];
  for (const [wordId, byMotif] of d.wordMotifSongs) {
    const songs = byMotif.get(motifId);
    if (songs) {
      words.push({
        id: wordId,
        name: wordName.get(wordId) ?? "",
        songCount: songs.size,
      });
    }
  }
  words.sort((a, b) => b.songCount - a.songCount || a.id - b.id);

  // 作品与歌词
  const supabase = getServiceClient();
  const lyricsRows = supabase
    ? await fetchAll<{ id: number; lyrics: string | null }>(
        supabase,
        TABLES.MUSIC_CATALOG,
        "id,lyrics",
        (q) => q.in("id", [...own]),
      )
    : [];
  const lyricsById = new Map(lyricsRows.map((r) => [r.id, r.lyrics]));
  const occBySong = new Map<
    number,
    Array<{ imagery_id: number; lyric_timetag: string[] | null }>
  >();
  for (const occ of index.occurrences) {
    if (occ.category_id !== motifId || !own.has(occ.song_id)) continue;
    let list = occBySong.get(occ.song_id);
    if (!list) occBySong.set(occ.song_id, (list = []));
    list.push(occ);
  }
  const songById = new Map(index.songs.map((s) => [s.id, s]));
  const works: MotifWork[] = [];
  for (const [songId, occs] of occBySong) {
    const song = songById.get(songId);
    if (!song) continue;
    const lyrics = lyricsById.get(songId) ?? null;
    const lrc = parseLrcLines(lyrics);
    const tags = new Set(occs.flatMap((o) => o.lyric_timetag ?? []));
    let lines = lrc.filter((l) => tags.has(l.tag)).map((l) => l.text);
    if (lines.length === 0) {
      // 没有时间轴：按字面找
      const names = occs.map((o) => wordName.get(o.imagery_id) ?? "");
      lines = (lyrics ?? "")
        .split("\n")
        .map((l) => l.replace(/\[[^\]]*\]/g, "").trim())
        .filter((l) => l && names.some((n) => n && l.includes(n)));
    }
    works.push({
      id: songId,
      title: song.title,
      year: song.date?.slice(0, 4) ?? null,
      hascover: song.hascover,
      lyricist: song.lyricist,
      wordIds: [...new Set(occs.map((o) => o.imagery_id))],
      lines: [...new Set(lines)],
    });
  }
  works.sort(
    (a, b) => (b.year ?? "0").localeCompare(a.year ?? "0") || a.id - b.id,
  );

  // 基调偏向：只看主基调，与全库（有意象的曲库歌曲）比
  const mainOf = new Map(
    index.songEmotions
      .filter((r) => r.rank === 1)
      .map((r) => [r.song_id, r.emotion_id]),
  );
  const baseCount = new Map<number, number>();
  let baseTotal = 0;
  for (const songId of d.motifsBySong.keys()) {
    const e = mainOf.get(songId);
    if (e === undefined) continue;
    baseCount.set(e, (baseCount.get(e) ?? 0) + 1);
    baseTotal++;
  }
  const ownCount = new Map<number, number>();
  let ownTotal = 0;
  for (const songId of own) {
    const e = mainOf.get(songId);
    if (e === undefined) continue;
    ownCount.set(e, (ownCount.get(e) ?? 0) + 1);
    ownTotal++;
  }
  const emotions: MotifEmotion[] = [...index.emotions]
    .sort((a, b) => a.sort - b.sort)
    .map((e) => ({
      id: e.id,
      name: e.name,
      tone: e.tone,
      energy: e.energy,
      count: ownCount.get(e.id) ?? 0,
      share: ownTotal ? (ownCount.get(e.id) ?? 0) / ownTotal : 0,
      base: baseTotal ? (baseCount.get(e.id) ?? 0) / baseTotal : 0,
    }));

  // 常与之同写：按超出随机的倍数（lift）
  const n = d.motifsBySong.size;
  const cowritten: MotifLink[] = [];
  for (const [otherId, songs] of d.songsByMotif) {
    if (otherId === motifId || songs.size < COWRITE_MIN_OTHER) continue;
    let both = 0;
    for (const s of songs) if (own.has(s)) both++;
    if (both < COWRITE_MIN_BOTH) continue;
    const lift = (both * n) / (own.size * songs.size);
    if (lift < COWRITE_MIN_LIFT) continue;
    cowritten.push({
      id: otherId,
      name: d.catById.get(otherId)?.name ?? "",
      palette: d.paletteOf(otherId),
      both,
      lift,
    });
  }
  cowritten.sort((a, b) => b.lift - a.lift);

  const l2 = path[1];
  const siblings = l2
    ? index.categories
        .filter((c) => c.parent_id === l2.id && c.id !== motifId)
        .map((c) => ({
          id: c.id,
          name: c.name,
          songCount: d.songsByMotif.get(c.id)?.size ?? 0,
        }))
        .filter((c) => c.songCount > 0)
        .sort((a, b) => b.songCount - a.songCount)
    : [];

  return {
    id: motifId,
    name: motif.name,
    path: path.slice(0, -1).map((c) => c.name),
    palette: d.paletteOf(motifId),
    description: motif.description,
    songCount: own.size,
    words,
    works,
    emotions,
    emotionSample: ownTotal,
    cowritten: cowritten.slice(0, COWRITE_LIMIT),
    siblings,
  };
}
