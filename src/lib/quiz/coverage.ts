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

/** 别名建议的最低出现歌曲数：只在几首歌里出现的词不值得单独维护 */
export const MIN_ALIAS_SONGS = 5;

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
  /** 招牌意象别名中已不存在于意象表的名称 */
  missingAliases: Array<{ signature: string; alias: string }>;
  /**
   * 建议加入招牌意象别名的意象：含招牌字、与现有别名同属一个二级分类。
   * 同时含两个招牌字的词（如「风雨」）归属不明，不给建议。
   */
  aliasSuggestions: Array<{
    signature: string;
    name: string;
    category: string;
    songs: number;
  }>;
}

export function checkCoverage(
  rows: Omit<PoolRows, "songs"> & {
    songs: Array<PoolRows["songs"][number] & { lyrics?: string | null }>;
  },
): CoverageReport {
  const level2Of = createLevel2Resolver(rows.categories);
  const nameById = new Map(rows.imagery.map((i) => [i.id, i.name]));

  // ── 每首歌的标注数；每个意象出现的歌曲数与最常用的二级分类 ──
  const occCountBySong = new Map<number, number>();
  const songsByImagery = new Map<number, Set<number>>();
  const level2CountsByImagery = new Map<number, Map<string, number>>();
  const occByLevel2 = new Map<string, number>();
  for (const occ of rows.occurrences) {
    occCountBySong.set(occ.song_id, (occCountBySong.get(occ.song_id) ?? 0) + 1);

    const songs = songsByImagery.get(occ.imagery_id) ?? new Set<number>();
    songs.add(occ.song_id);
    songsByImagery.set(occ.imagery_id, songs);

    const level2 = level2Of(occ.category_id);
    if (level2 === null) continue;
    occByLevel2.set(level2, (occByLevel2.get(level2) ?? 0) + 1);
    const counts = level2CountsByImagery.get(occ.imagery_id) ?? new Map();
    counts.set(level2, (counts.get(level2) ?? 0) + 1);
    level2CountsByImagery.set(occ.imagery_id, counts);
  }
  const dominantLevel2 = (imageryId: number): string | null => {
    const counts = level2CountsByImagery.get(imageryId);
    if (!counts) return null;
    return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
  };

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

  // ── 招牌意象别名 ──
  const idByName = new Map(rows.imagery.map((i) => [i.name, i.id]));
  const allAliases = new Set(SIGNATURE_IMAGERY.flatMap((s) => s.aliases));
  const missingAliases = SIGNATURE_IMAGERY.flatMap((s) =>
    s.aliases
      .filter((alias) => !idByName.has(alias))
      .map((alias) => ({ signature: s.name, alias })),
  );

  // 按招牌意象最短的别名匹配（「星辰」的核心字是「星」）
  const coreOf = (s: (typeof SIGNATURE_IMAGERY)[number]) =>
    [...s.aliases].sort((a, b) => a.length - b.length)[0] ?? s.name;
  const cores = SIGNATURE_IMAGERY.map(coreOf);

  const aliasSuggestions: CoverageReport["aliasSuggestions"] = [];
  for (const signature of SIGNATURE_IMAGERY) {
    const core = coreOf(signature);
    // 现有别名所属的二级分类，决定哪些「含招牌字」的词是同一类事物
    const aliasCategories = new Set(
      signature.aliases.flatMap((alias) => {
        const id = idByName.get(alias);
        const level2 = id === undefined ? null : dominantLevel2(id);
        return level2 === null ? [] : [level2];
      }),
    );
    if (aliasCategories.size === 0) continue;

    for (const [imageryId, songs] of songsByImagery) {
      const name = nameById.get(imageryId);
      if (!name || allAliases.has(name) || !name.includes(core)) continue;
      if (cores.filter((c) => name.includes(c)).length > 1) continue;
      if (songs.size < MIN_ALIAS_SONGS) continue;
      const category = dominantLevel2(imageryId);
      if (category === null || !aliasCategories.has(category)) continue;
      aliasSuggestions.push({
        signature: signature.name,
        name,
        category,
        songs: songs.size,
      });
    }
  }
  aliasSuggestions.sort((a, b) => b.songs - a.songs);

  return {
    pendingSongs,
    unmappedCategories,
    missingCategories,
    missingAliases,
    aliasSuggestions,
  };
}
