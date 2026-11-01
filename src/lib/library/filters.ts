/**
 * 曲库筛选（见 docs/LIBRARY.md 阶段 3「2. 用一份配置描述筛选维度」）。
 *
 * 曲风和四个署名维度由 FACETS 一份配置驱动：选项统计、匹配、置灰（F5）都是通用实现。
 * 匹配用阶段 2 的 SongMeta 里归一化后的值，地址栏里存的也是归一化后的简体（F2），
 * 简繁两种页面打开同一个链接，结果一致。选项的显示文字仍按页面字形，取自 Song。
 *
 * 类型是单选，年份是区间，各有各的写法。
 */
import {
  FILTER_OPTION_ALL,
  FILTER_OPTION_UNKNOWN,
  GENRE_ORDER,
  TYPE_ORDER,
} from "@/lib/constants";
import { getSongMeta, type SongMeta } from "@/lib/search/meta";
import { normalize } from "@/lib/search/normalize";
import type { Song } from "@/lib/types";
import { sortNamesOptimized } from "@/lib/utils/utils-song";

type FacetConfig = {
  key: "genre" | "artist" | "lyricist" | "composer" | "arranger";
  /** 显示用的原文，按页面字形 */
  values: (song: Song) => readonly string[] | null | undefined;
  /** 选项顺序：给了就按这个列表排，没列到的排在后面；不给就按人名排序 */
  order?: readonly string[];
};

export const FACETS = [
  { key: "genre", values: (s) => s.genre, order: GENRE_ORDER },
  { key: "artist", values: (s) => s.artist },
  { key: "lyricist", values: (s) => s.lyricist },
  { key: "composer", values: (s) => s.composer },
  { key: "arranger", values: (s) => s.arranger },
] as const satisfies readonly FacetConfig[];

export type FacetKey = (typeof FACETS)[number]["key"];

export const FACET_KEYS: readonly FacetKey[] = FACETS.map((f) => f.key);

/** 归一化后的值；SongMeta 里每个维度都按同名字段存 */
function metaValues(meta: SongMeta, key: FacetKey): readonly string[] {
  return meta[key];
}

/**
 * 一个维度选了什么。include：选中的这几项（空表示不筛选）；
 * exclude：全部选项减去这几项（空表示全选，结果和不筛选一样）。
 * 值都是归一化后的；「未知」用 FILTER_OPTION_UNKNOWN。
 */
export interface FacetSelection {
  mode: "include" | "exclude";
  values: readonly string[];
}

export const NO_SELECTION: FacetSelection = { mode: "include", values: [] };
export const ALL_SELECTED: FacetSelection = { mode: "exclude", values: [] };

/** 选中这一维度会不会改变结果：不选和全选都不会 */
export function isSelectionActive(sel: FacetSelection): boolean {
  return sel.values.length > 0;
}

/**
 * 年份筛选，和滑轨一样从左到右、从新到旧：newest 是左端，oldest 是右端，都含在内。
 * newest 为 null：左端拖到了最左（最新）一格，那一侧开放，以后加了更新年份的歌也包含。
 * oldest 为 null：右端拖到了最右一格「未知」，那一侧开放，含年份未知的歌。
 * "unknown"：只看年份未知的歌。null：不筛选。
 */
export type YearFilter =
  { newest: number | null; oldest: number | null } | "unknown" | null;

export interface LibraryFilters {
  /** 类型标签，单选；FILTER_OPTION_ALL 表示不筛选 */
  type: string;
  year: YearFilter;
  facets: Record<FacetKey, FacetSelection>;
}

export function emptyFacets(): Record<FacetKey, FacetSelection> {
  return Object.fromEntries(FACET_KEYS.map((k) => [k, NO_SELECTION])) as Record<
    FacetKey,
    FacetSelection
  >;
}

// ─── 选项 ─────────────────────────────────────────────────────────────────────

export interface FacetOption {
  /** 归一化后的值，地址栏里存的就是它 */
  value: string;
  /** 显示的文字，按页面字形；「未知」由界面翻译 */
  label: string;
}

/** 滑轨的一格：年份从新到旧，「未知」在最右 */
export type YearCell = number | typeof FILTER_OPTION_UNKNOWN;

export interface LibraryOptions {
  /** 类型标签：FILTER_OPTION_ALL 在最前，FILTER_OPTION_UNKNOWN 在最后（有的话） */
  types: string[];
  years: YearCell[];
  facets: Record<FacetKey, FacetOption[]>;
}

function orderBy(values: string[], order: readonly string[]): string[] {
  return [
    ...order.filter((v) => values.includes(v)),
    ...values.filter((v) => !order.includes(v)),
  ];
}

export function buildLibraryOptions(songs: readonly Song[]): LibraryOptions {
  const typeSet = new Set<string>();
  let unknownType = false;
  const yearSet = new Set<number>();
  let unknownYear = false;
  for (const song of songs) {
    if (song.type?.length) song.type.forEach((t) => typeSet.add(t));
    else unknownType = true;
    if (song.year) yearSet.add(song.year);
    else unknownYear = true;
  }
  const types = [FILTER_OPTION_ALL, ...orderBy([...typeSet], TYPE_ORDER)];
  if (unknownType) types.push(FILTER_OPTION_UNKNOWN);
  const years: YearCell[] = [...yearSet].sort((a, b) => b - a);
  if (unknownYear) years.push(FILTER_OPTION_UNKNOWN);

  const facets = {} as Record<FacetKey, FacetOption[]>;
  for (const facet of FACETS as readonly FacetConfig[]) {
    // 同一个归一化值只出一项，显示文字取第一次见到的
    const labels = new Map<string, string>();
    let unknown = false;
    for (const song of songs) {
      const raw = facet.values(song);
      if (!raw?.length) {
        unknown = true;
        continue;
      }
      for (const label of raw) {
        const value = normalize(label);
        if (value && !labels.has(value)) labels.set(value, label);
      }
    }
    const byLabel = new Map([...labels].map(([v, l]) => [l, v]));
    const sortedLabels = facet.order
      ? orderBy([...byLabel.keys()], facet.order)
      : sortNamesOptimized([...byLabel.keys()]);
    const options = sortedLabels.map((label) => ({
      value: byLabel.get(label) as string,
      label,
    }));
    if (unknown) {
      options.push({
        value: FILTER_OPTION_UNKNOWN,
        label: FILTER_OPTION_UNKNOWN,
      });
    }
    facets[facet.key] = options;
  }
  return { types, years, facets };
}

// ─── 匹配 ─────────────────────────────────────────────────────────────────────

/** 同一维度内是「或」；字段为空的歌算「未知」 */
export function matchesFacet(
  values: readonly string[],
  sel: FacetSelection,
): boolean {
  if (sel.values.length === 0) return true;
  const set = new Set(sel.values);
  if (sel.mode === "include") {
    return values.length === 0
      ? set.has(FILTER_OPTION_UNKNOWN)
      : values.some((v) => set.has(v));
  }
  // 排除：全部选项减去这几项。全部选项就是曲库里出现过的值，所以只要这首歌
  // 有一个值没被排除就算命中，不用先把全部选项列出来；曲库加了新人自然也包含
  return values.length === 0
    ? !set.has(FILTER_OPTION_UNKNOWN)
    : values.some((v) => !set.has(v));
}

export function matchesType(song: Song, type: string): boolean {
  if (type === FILTER_OPTION_ALL) return true;
  if (type === FILTER_OPTION_UNKNOWN) return !song.type?.length;
  return !!song.type?.includes(type);
}

export function matchesYear(year: number | null, filter: YearFilter): boolean {
  if (filter === null) return true;
  if (filter === "unknown") return !year;
  if (!year) return filter.oldest === null;
  return (
    (filter.newest === null || year <= filter.newest) &&
    (filter.oldest === null || year >= filter.oldest)
  );
}

/** 按筛选条件过滤，保持原有顺序 */
export function filterSongs(
  songs: readonly Song[],
  filters: LibraryFilters,
): Song[] {
  return songs.filter((song) => {
    if (!matchesType(song, filters.type)) return false;
    if (!matchesYear(song.year, filters.year)) return false;
    const meta = getSongMeta(song);
    return FACET_KEYS.every((k) =>
      matchesFacet(metaValues(meta, k), filters.facets[k]),
    );
  });
}

/**
 * 每个维度里「勾上之后还有歌」的值（F5）：按其他维度的筛选，再加上这一项。
 * 同一维度内是「或」，再勾本维度的其他项只会让结果变多，所以不看本维度选了什么。
 * songs 应当是已经按搜索词搜过的那些歌。
 */
export function availableFacetValues(
  songs: readonly Song[],
  filters: LibraryFilters,
): Record<FacetKey, Set<string>> {
  const out = Object.fromEntries(
    FACET_KEYS.map((k) => [k, new Set<string>()]),
  ) as Record<FacetKey, Set<string>>;

  for (const song of songs) {
    if (!matchesType(song, filters.type)) continue;
    if (!matchesYear(song.year, filters.year)) continue;
    const meta = getSongMeta(song);
    let failed: FacetKey | null = null;
    let failures = 0;
    for (const k of FACET_KEYS) {
      if (!matchesFacet(metaValues(meta, k), filters.facets[k])) {
        failed = k;
        if (++failures > 1) break;
      }
    }
    // 两个维度不满足：去掉哪一个维度的限制都还有一个不满足，对谁都没有贡献
    if (failures > 1) continue;
    for (const k of failures === 1 ? [failed as FacetKey] : FACET_KEYS) {
      const values = metaValues(meta, k);
      if (values.length === 0) out[k].add(FILTER_OPTION_UNKNOWN);
      else values.forEach((v) => out[k].add(v));
    }
  }
  return out;
}

// ─── 界面上的勾选 ↔ 选择 ─────────────────────────────────────────────────────

/** 界面上勾着的值 */
export function checkedValues(
  sel: FacetSelection,
  options: readonly FacetOption[],
): string[] {
  const set = new Set(sel.values);
  if (sel.mode === "include") {
    return options.filter((o) => set.has(o.value)).map((o) => o.value);
  }
  return options.filter((o) => !set.has(o.value)).map((o) => o.value);
}

/**
 * 界面上勾选变了之后的选择：按用户的操作决定存包含还是排除，不按数量自动切换（F4）。
 * 全部勾上就是全选；在全选（排除）的基础上取消勾选，继续是排除；其余是包含。
 */
export function nextSelection(
  checked: readonly string[],
  current: FacetSelection,
  options: readonly FacetOption[],
): FacetSelection {
  if (checked.length === 0) return NO_SELECTION;
  const set = new Set(checked);
  if (options.every((o) => set.has(o.value))) return ALL_SELECTED;
  if (current.mode === "exclude") {
    return {
      mode: "exclude",
      values: options.filter((o) => !set.has(o.value)).map((o) => o.value),
    };
  }
  return { mode: "include", values: [...checked] };
}

// ─── 年份滑轨 ↔ 年份筛选 ─────────────────────────────────────────────────────

/** 滑轨两端（格子下标，从左到右）对应的年份筛选 */
export function yearFromSlider(
  [left, right]: readonly [number, number],
  cells: readonly YearCell[],
): YearFilter {
  if (cells.length === 0) return null;
  const last = cells.length - 1;
  const l = Math.max(0, Math.min(left, right, last));
  const r = Math.min(last, Math.max(left, right, 0));
  if (cells[l] === FILTER_OPTION_UNKNOWN) return "unknown";
  const newest = l === 0 ? null : (cells[l] as number);
  const oldest =
    r === last || cells[r] === FILTER_OPTION_UNKNOWN
      ? null
      : (cells[r] as number);
  return newest === null && oldest === null ? null : { newest, oldest };
}

/** 年份筛选在当前滑轨上的位置。曲库里没有的年份落到最近的、仍在区间内的格子上 */
export function yearToSlider(
  filter: YearFilter,
  cells: readonly YearCell[],
): [number, number] {
  const last = Math.max(0, cells.length - 1);
  if (filter === null) return [0, last];
  if (filter === "unknown") {
    const i = cells.indexOf(FILTER_OPTION_UNKNOWN);
    return i === -1 ? [last, last] : [i, i];
  }
  const { newest, oldest } = filter;
  const numeric = cells
    .map((c, i) => [c, i] as const)
    .filter((e): e is readonly [number, number] => typeof e[0] === "number");
  const left =
    newest === null ? 0 : (numeric.find(([y]) => y <= newest)?.[1] ?? last);
  const right =
    oldest === null
      ? last
      : ([...numeric].reverse().find(([y]) => y >= oldest)?.[1] ?? 0);
  return left <= right ? [left, right] : [left, left];
}

/**
 * 地址栏里的写法，和滑轨一样「左端-右端」：2020-2015、2018（单独一年）、
 * -2015（左端拖到头：2015 年及以后）、2010-（右端拖到头：2010 年及以前，含未知）、unknown
 */
export function formatYear(filter: YearFilter): string | null {
  if (filter === null) return null;
  if (filter === "unknown") return "unknown";
  const { newest, oldest } = filter;
  if (newest !== null && newest === oldest) return String(newest);
  return `${newest ?? ""}-${oldest ?? ""}`;
}

export function parseYear(raw: string | null): YearFilter {
  if (raw === null) return null;
  if (raw === "unknown") return "unknown";
  if (/^\d{1,4}$/.test(raw)) {
    const y = Number(raw);
    return { newest: y, oldest: y };
  }
  const m = /^(\d{1,4})?-(\d{1,4})?$/.exec(raw);
  if (!m) return null;
  let newest = m[1] ? Number(m[1]) : null;
  let oldest = m[2] ? Number(m[2]) : null;
  if (newest === null && oldest === null) return null;
  // 手写链接两端写反了也照样认
  if (newest !== null && oldest !== null && newest < oldest) {
    [newest, oldest] = [oldest, newest];
  }
  return { newest, oldest };
}
