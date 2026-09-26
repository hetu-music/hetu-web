import {
  CATEGORY_TO_DIMENSION,
  DIMENSION_KEYS,
  IMAGERY_ALIAS,
} from "./dimensions";
import type { DimensionKey, PoolSong } from "./types";

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
  }>;
}

/**
 * 不进入候选池的作品类型：翻唱、参与的歌词并非河图的创作取向。
 * 其余类型（原创、合作、文宣、商业、墨宝）以及未标类型的作品都参与匹配。
 */
export const EXCLUDED_TYPES: readonly string[] = ["翻唱", "参与"];
/** 入池规则版本：修改排除类型、标注门槛等规则时递增，使服务端缓存失效 */
export const POOL_VERSION = 2;
/** 候选池服务端缓存的标签，revalidate 接口据此刷新 */
export const QUIZ_POOL_TAG = "quiz-pool";
/** 意象标注少于此数的歌曲不进入候选池，画像不可靠 */
export const MIN_OCCURRENCES = 10;
/** 「（纯歌版）」「(DJ版)」等衍生版本与原曲意象相同，不重复入池 */
const VARIANT_TITLE = /[（(][^（）()]*版[）)]/;

/** 作品类型与标题是否允许入池（不看标注数量） */
export function isPoolEligible(song: {
  title: string;
  type: string[] | null;
}): boolean {
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
 * 把意象标注聚合为候选池。意象挂在三级分类上，向上找到二级分类后映射到维度。
 */
export function buildPool(rows: PoolRows): PoolSong[] {
  const level2Of = createLevel2Resolver(rows.categories);
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
      const name = imageryName.get(occ.imagery_id) ?? "";
      const signature = IMAGERY_ALIAS.get(name);
      if (signature) {
        imageryCounts[signature] = (imageryCounts[signature] ?? 0) + 1;
      }
      occurrences.push({
        dim,
        imagery: name,
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
      total: occs.length,
      dimCounts,
      imageryCounts,
      occurrences,
    });
  }

  return pool.sort((a, b) => a.id - b.id);
}
