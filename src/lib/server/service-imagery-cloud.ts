import { unstable_cache } from "next/cache";
import { fetchAll, getServiceClient, TABLES } from "@/lib/db/supabase-server";
import { PALETTE_FULL, sortLevel1Categories } from "@/lib/imagery/palette";
import { SONG_IMAGERY_TAG } from "@/lib/imagery/tags";
import type {
  CloudMotif,
  CloudMotifGroup,
  CloudWord,
  ImageryCloud,
  MotifDetail,
  MotifLink,
  MotifWork,
  MotifWord,
} from "@/lib/types";
import { toTraditional, toTraditionalArray } from "@/lib/utils/utils-convert";

/**
 * 意象词云的数据，以母题为单位（见 IMAGERY.md）：词云列母题或全部写法，
 * 面板列一个母题的写法与作品。全库标注一次读进来，跨请求缓存；面板也从这份缓存里算。
 * 作品数一律按歌去重，只算曲库里的歌。
 */

type CategoryRow = {
  id: number;
  name: string;
  parent_id: number | null;
  level: number | null;
  description: string | null;
};

type Index = {
  categories: CategoryRow[];
  imagery: Array<{ id: number; name: string }>;
  occurrences: Array<{
    song_id: number;
    imagery_id: number;
    category_id: number;
  }>;
  songs: Array<{
    id: number;
    title: string;
    date: string | null;
    lyricist: string[] | null;
  }>;
};

const loadIndex = unstable_cache(
  async (): Promise<Index> => {
    // 失败时抛错而不返回空数据：unstable_cache 不缓存异常
    const supabase = getServiceClient();
    if (!supabase) throw new Error("Supabase 未配置");
    const [categories, imagery, occurrences, songs] = await Promise.all([
      fetchAll<Index["categories"][number]>(
        supabase,
        TABLES.IMAGERY_CAT,
        "id,name,parent_id,level,description",
      ),
      fetchAll<Index["imagery"][number]>(supabase, TABLES.IMAGERY, "id,name"),
      fetchAll<Index["occurrences"][number]>(
        supabase,
        TABLES.IMAGERY_OCC,
        "song_id,imagery_id,category_id",
      ),
      fetchAll<Index["songs"][number]>(
        supabase,
        TABLES.MUSIC_CATALOG,
        "id,title,date,lyricist",
      ),
    ]);
    if (occurrences.length === 0 || songs.length === 0) {
      throw new Error("意象索引数据为空");
    }
    return { categories, imagery, occurrences, songs };
  },
  ["imagery-cloud-index-v1"],
  { revalidate: 7200, tags: [SONG_IMAGERY_TAG] },
);

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
  // 词 → 母题 → 歌：多义词（烟花：焰火 / 春）在不同母题下各算各的
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
    songsByMotif,
    motifsBySong,
    wordMotifSongs,
  };
}

function translator(locale: string) {
  return locale === "zh-TW"
    ? (s: string) => toTraditional(s) ?? s
    : (s: string) => s;
}

// ─── 词云 ──────────────────────────────────────────────────────────────────

export async function getImageryCloud(locale: string): Promise<ImageryCloud> {
  const index = await loadIndex();
  const d = derive(index);
  const tr = translator(locale);
  const wordName = new Map(index.imagery.map((i) => [i.id, i.name]));

  const wordCount = new Map<number, number>();
  const words: CloudWord[] = [];
  for (const [wordId, byMotif] of d.wordMotifSongs) {
    const name = wordName.get(wordId);
    if (!name) continue;
    const all = new Set<number>();
    let top = 0;
    let topSize = -1;
    for (const [motifId, songs] of byMotif) {
      for (const s of songs) all.add(s);
      if (songs.size > topSize) [top, topSize] = [motifId, songs.size];
      wordCount.set(motifId, (wordCount.get(motifId) ?? 0) + 1);
    }
    const [root, l2] = d.pathOf(top);
    words.push({
      id: wordId,
      name: tr(name),
      songCount: all.size,
      motif: top,
      l1: root?.id ?? 0,
      l2: l2?.id ?? 0,
      palette: d.paletteOf(top),
    });
  }
  words.sort((a, b) => b.songCount - a.songCount || a.id - b.id);

  const groups = new Map<number, CloudMotifGroup>();
  for (const [motifId, songs] of d.songsByMotif) {
    const [root, l2, motif] = d.pathOf(motifId);
    if (!root || !l2 || !motif) continue;
    let group = groups.get(l2.id);
    if (!group) {
      groups.set(
        l2.id,
        (group = {
          id: l2.id,
          name: tr(l2.name),
          l1: root.id,
          palette: d.paletteOf(motifId),
          motifs: [],
        }),
      );
    }
    const item: CloudMotif = {
      id: motifId,
      name: tr(motif.name),
      l1: root.id,
      l2: l2.id,
      palette: group.palette,
      songCount: songs.size,
      wordCount: wordCount.get(motifId) ?? 0,
    };
    group.motifs.push(item);
  }
  const l1Order = new Map(d.l1.map((c, i) => [c.id, i]));
  const total = (g: CloudMotifGroup) =>
    g.motifs.reduce((s, m) => s + m.songCount, 0);
  const sortedGroups = [...groups.values()]
    .map((g) => ({
      ...g,
      motifs: g.motifs.sort((a, b) => b.songCount - a.songCount),
    }))
    .sort(
      (a, b) =>
        (l1Order.get(a.l1) ?? 99) - (l1Order.get(b.l1) ?? 99) ||
        total(b) - total(a),
    );

  return {
    l1: d.l1.map((c) => ({
      id: c.id,
      name: tr(c.name),
      palette: d.paletteOfL1.get(c.id) ?? -1,
    })),
    groups: sortedGroups,
    words,
    motifCount: d.songsByMotif.size,
  };
}

// ─── 面板 ──────────────────────────────────────────────────────────────────

/**
 * 同写：两个母题同在一首歌里的次数是随机情况的几倍（lift = 同写数 × N ÷ (|A| × |B|)），
 * 只看同歌、不看同句。lift 上限是 N ÷ 较大一方的作品数，月、风这类高频母题到不了门槛。
 * 门槛凭结果目测定的：至少几首歌一起写到、对方至少写到几首，才算数
 */
const COWRITE_MIN_BOTH = 4;
const COWRITE_MIN_OTHER = 5;
const COWRITE_MIN_LIFT = 1.8;
const COWRITE_LIMIT = 10;

/** 一个母题的面板内容；不是母题、或曲库里没有歌写到它时返回 null */
export async function getMotifDetail(
  motifId: number,
  locale: string,
): Promise<MotifDetail | null> {
  const index = await loadIndex();
  const d = derive(index);
  const tr = translator(locale);
  const motif = d.catById.get(motifId);
  const own = d.songsByMotif.get(motifId);
  if (!motif || motif.level !== 3 || !own) return null;
  const wordName = new Map(index.imagery.map((i) => [i.id, i.name]));

  // 写法
  const words: MotifWord[] = [];
  for (const [wordId, byMotif] of d.wordMotifSongs) {
    const songs = byMotif.get(motifId);
    if (songs) {
      words.push({
        id: wordId,
        name: tr(wordName.get(wordId) ?? ""),
        songCount: songs.size,
      });
    }
  }
  words.sort((a, b) => b.songCount - a.songCount || a.id - b.id);

  // 作品：新的在前
  const wordsBySong = new Map<number, Set<number>>();
  for (const occ of index.occurrences) {
    if (occ.category_id !== motifId || !own.has(occ.song_id)) continue;
    let set = wordsBySong.get(occ.song_id);
    if (!set) wordsBySong.set(occ.song_id, (set = new Set()));
    set.add(occ.imagery_id);
  }
  const songById = new Map(index.songs.map((s) => [s.id, s]));
  const works: MotifWork[] = [];
  for (const [songId, wordIds] of wordsBySong) {
    const song = songById.get(songId);
    if (!song) continue;
    works.push({
      id: songId,
      title: tr(song.title),
      year: song.date?.slice(0, 4) ?? null,
      lyricist:
        locale === "zh-TW" ? toTraditionalArray(song.lyricist) : song.lyricist,
      wordIds: [...wordIds],
    });
  }
  works.sort(
    (a, b) => (b.year ?? "0").localeCompare(a.year ?? "0") || a.id - b.id,
  );

  // 常与之同写：面板不展示，留给以后的母题关系图
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
      name: tr(d.catById.get(otherId)?.name ?? ""),
      palette: d.paletteOf(otherId),
      both,
      lift,
    });
  }
  cowritten.sort((a, b) => b.lift - a.lift);

  return {
    id: motifId,
    name: tr(motif.name),
    path: d
      .pathOf(motifId)
      .slice(0, -1)
      .map((c) => tr(c.name)),
    palette: d.paletteOf(motifId),
    description: motif.description ? tr(motif.description) : null,
    songCount: own.size,
    words,
    works,
    cowritten: cowritten.slice(0, COWRITE_LIMIT),
  };
}
