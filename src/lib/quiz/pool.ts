import {
  CATEGORY_TO_DIMENSION,
  DIMENSION_KEYS,
  MOTIF_TO_SIGNATURE,
} from "./dimensions";
import type { DimensionKey, Mood, PoolSong } from "./types";

/** 候选池的原始数据行，字段与数据库表一致 */
export interface PoolRows {
  categories: Array<{
    id: number;
    name: string;
    parent_id: number | null;
    level: number | null;
  }>;
  imagery: Array<{ id: number; name: string }>;
  occurrences: Array<{
    song_id: number;
    category_id: number;
    imagery_id: number;
    lyric_timetag: string[] | null;
  }>;
  songs: Array<{
    id: number;
    title: string;
    artist: string[] | null;
    album: string | null;
    hascover: boolean | null;
    has_audio: boolean | null;
    type: string[] | null;
    /** 发布日期；为空表示日期未知 */
    date: string | null;
  }>;
  /** 歌曲基调（song_emotions 连 emotions），用于算情绪坐标；省略时所有歌都没有坐标 */
  songEmotions?: Array<{
    song_id: number;
    rank: number;
    emotions: { tone: string; energy: string } | null;
  }>;
}

/**
 * 不进入候选池的作品类型：翻唱、参与的歌词并非河图的创作取向。
 * 其余类型（原创、合作、文宣、商业、墨宝）以及未标类型的作品都参与匹配。
 */
export const EXCLUDED_TYPES: readonly string[] = ["翻唱", "参与"];
/** 入池规则版本：修改排除类型、标注门槛、招牌意象计法、情绪坐标等规则时递增，使服务端缓存失效 */
export const POOL_VERSION = 8;
/** 主基调在情绪坐标里的权重，副基调为 1 */
const MAIN_EMOTION_WEIGHT = 2;

/**
 * 歌曲的情绪坐标：主、副基调按权重平均，明 / 扬记 +1，暗 / 抑记 -1。
 * 《倾尽天下》（悲怆、执守、苍凉）= 暗、略扬。
 */
function moodOf(rows: NonNullable<PoolRows["songEmotions"]>): Mood | null {
  let tone = 0;
  let energy = 0;
  let total = 0;
  for (const row of rows) {
    if (!row.emotions) continue;
    const w = row.rank === 1 ? MAIN_EMOTION_WEIGHT : 1;
    tone += w * (row.emotions.tone === "明" ? 1 : -1);
    energy += w * (row.emotions.energy === "扬" ? 1 : -1);
    total += w;
  }
  return total > 0 ? { tone: tone / total, energy: energy / total } : null;
}

/** 意象标注少于此数的歌曲不进入候选池，画像不可靠 */
export const MIN_OCCURRENCES = 10;
/** 「（纯歌版）」「(DJ版)」等衍生版本与原曲意象相同，不重复入池 */
const VARIANT_TITLE = /[（(][^（）()]*版[）)]/;

/**
 * 作品类型、标题与日期是否允许入池（不看标注数量）。
 * 日期未知的作品来历不明，不推荐给用户。
 */
export function isPoolEligible(song: {
  title: string;
  type: string[] | null;
  date: string | null;
}): boolean {
  if (!song.date) return false;
  if (song.type?.some((t) => EXCLUDED_TYPES.includes(t))) return false;
  return !VARIANT_TITLE.test(song.title);
}

/**
 * 意象挂在三级分类上；返回把任意分类 id 映射到其二级分类名的函数（带缓存）。
 */
export function createLevel2Resolver(
  categories: PoolRows["categories"],
): (categoryId: number) => string | null {
  const categoryById = new Map(categories.map((c) => [c.id, c]));
  const cache = new Map<number, string | null>();
  return (categoryId) => {
    const cached = cache.get(categoryId);
    if (cached !== undefined) return cached;
    let cat = categoryById.get(categoryId);
    while (cat && (cat.level ?? 0) > 2 && cat.parent_id !== null) {
      cat = categoryById.get(cat.parent_id);
    }
    const name = cat && cat.level === 2 ? cat.name : null;
    cache.set(categoryId, name);
    return name;
  };
}

function emptyDimCounts(): Record<DimensionKey, number> {
  return Object.fromEntries(DIMENSION_KEYS.map((k) => [k, 0])) as Record<
    DimensionKey,
    number
  >;
}

/**
 * 把意象标注聚合为候选池。意象挂在三级分类（母题）上：向上找到二级分类后映射到维度，
 * 母题本身决定是否计入招牌意象。
 */
export function buildPool(rows: PoolRows): PoolSong[] {
  const level2Of = createLevel2Resolver(rows.categories);
  const signatureOf = new Map(
    rows.categories.flatMap((c) => {
      const signature = MOTIF_TO_SIGNATURE.get(c.name);
      return c.level === 3 && signature ? [[c.id, signature] as const] : [];
    }),
  );
  const resolveDim = (categoryId: number): DimensionKey | null => {
    const name = level2Of(categoryId);
    return name === null ? null : (CATEGORY_TO_DIMENSION.get(name) ?? null);
  };

  const imageryName = new Map(rows.imagery.map((i) => [i.id, i.name]));
  const occBySong = new Map<number, PoolRows["occurrences"]>();
  for (const occ of rows.occurrences) {
    const list = occBySong.get(occ.song_id);
    if (list) list.push(occ);
    else occBySong.set(occ.song_id, [occ]);
  }
  const emotionsBySong = new Map<
    number,
    NonNullable<PoolRows["songEmotions"]>
  >();
  for (const row of rows.songEmotions ?? []) {
    const list = emotionsBySong.get(row.song_id);
    if (list) list.push(row);
    else emotionsBySong.set(row.song_id, [row]);
  }

  const pool: PoolSong[] = [];
  for (const song of rows.songs) {
    if (!isPoolEligible(song)) continue;
    const occs = occBySong.get(song.id) ?? [];
    if (occs.length < MIN_OCCURRENCES) continue;

    const dimCounts = emptyDimCounts();
    const imageryCounts: Record<string, number> = {};
    const occurrences: PoolSong["occurrences"] = [];
    for (const occ of occs) {
      const dim = resolveDim(occ.category_id);
      if (dim) dimCounts[dim] += 1;
      const signature = signatureOf.get(occ.category_id) ?? null;
      if (signature) {
        imageryCounts[signature] = (imageryCounts[signature] ?? 0) + 1;
      }
      occurrences.push({
        dim,
        imagery: imageryName.get(occ.imagery_id) ?? "",
        signature,
        timetag: occ.lyric_timetag?.[0] ?? null,
      });
    }

    pool.push({
      id: song.id,
      title: song.title,
      artist: song.artist,
      album: song.album,
      hascover: song.hascover,
      hasAudio: song.has_audio ?? false,
      type: song.type,
      total: occs.length,
      dimCounts,
      imageryCounts,
      mood: moodOf(emotionsBySong.get(song.id) ?? []),
      occurrences,
    });
  }

  return pool.sort((a, b) => a.id - b.id);
}
