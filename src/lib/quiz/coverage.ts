import { CATEGORY_TO_DIMENSION, SIGNATURE_IMAGERY } from "./dimensions";
import {
  createLevel2Resolver,
  isPoolEligible,
  MIN_OCCURRENCES,
  type PoolRows,
} from "./pool";

/**
 * 寻曲测验的数据覆盖检查：找出手工维护的映射（dimensions.ts）与数据库之间的漂移，
 * 以及还差标注才能入池的歌曲。纯逻辑，诊断脚本与单元测试共用。
 */

export interface CoverageReport {
  /** 类型允许入池、但标注数不足的歌曲，按已有标注数从多到少（越靠前越接近入池） */
  pendingSongs: Array<{
    id: number;
    title: string;
    occurrences: number;
    hasLyrics: boolean;
  }>;
  /** 数据库中存在、但没有映射到任何维度的二级分类（其下标注在测验中被忽略） */
  unmappedCategories: Array<{ name: string; occurrences: number }>;
  /** dimensions.ts 引用了、但数据库中已不存在的二级分类（多为改名） */
  missingCategories: string[];
  /** 招牌意象指向、但数据库中已不存在的母题（多为改名），这些招牌意象不会被计数 */
  missingMotifs: Array<{ signature: string; motif: string }>;
}

export function checkCoverage(
  rows: Omit<PoolRows, "songs"> & {
    songs: Array<PoolRows["songs"][number] & { lyrics?: string | null }>;
  },
): CoverageReport {
  const level2Of = createLevel2Resolver(rows.categories);

  // ── 每首歌的标注数；每个二级分类下的标注数 ──
  const occCountBySong = new Map<number, number>();
  const occByLevel2 = new Map<string, number>();
  for (const occ of rows.occurrences) {
    occCountBySong.set(occ.song_id, (occCountBySong.get(occ.song_id) ?? 0) + 1);
    const level2 = level2Of(occ.category_id);
    if (level2 !== null) {
      occByLevel2.set(level2, (occByLevel2.get(level2) ?? 0) + 1);
    }
  }

  const pendingSongs = rows.songs
    .filter((s) => isPoolEligible(s))
    .map((s) => ({
      id: s.id,
      title: s.title,
      occurrences: occCountBySong.get(s.id) ?? 0,
      hasLyrics: Boolean(s.lyrics?.trim()),
    }))
    .filter((s) => s.occurrences < MIN_OCCURRENCES)
    .sort((a, b) => b.occurrences - a.occurrences || a.id - b.id);

  // ── 二级分类与维度映射的漂移 ──
  const level2Names = new Set(
    rows.categories.filter((c) => c.level === 2).map((c) => c.name),
  );
  const unmappedCategories = [...level2Names]
    .filter((name) => !CATEGORY_TO_DIMENSION.has(name))
    .map((name) => ({ name, occurrences: occByLevel2.get(name) ?? 0 }))
    .sort((a, b) => b.occurrences - a.occurrences);
  const missingCategories = [...CATEGORY_TO_DIMENSION.keys()].filter(
    (name) => !level2Names.has(name),
  );

  // ── 招牌意象指向的母题 ──
  const motifNames = new Set(
    rows.categories.filter((c) => c.level === 3).map((c) => c.name),
  );
  const missingMotifs = SIGNATURE_IMAGERY.filter(
    (s) => !motifNames.has(s.motif),
  ).map((s) => ({ signature: s.name, motif: s.motif }));

  return {
    pendingSongs,
    unmappedCategories,
    missingCategories,
    missingMotifs,
  };
}
