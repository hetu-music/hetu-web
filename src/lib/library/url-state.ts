/**
 * 曲库页的地址栏格式（见 docs/LIBRARY.md 阶段 3「3. 地址栏格式」）。
 *
 *   q          搜索词
 *   type       类型标签
 *   year       年份：2020-2015、2018、-2015、2010-、unknown（和滑轨一样从新到旧）
 *   genre / artist / lyricist / composer / arranger
 *              一个个勾选的值（包含），重复参数：?artist=司夏&artist=李萌
 *   genreNot / artistNot / …
 *              在全选的基础上取消勾选的值（排除）
 *   view       视图，默认 grid
 *   page       页码，默认 1
 *   advanced   筛选面板是否展开，1 为展开
 *
 * 人名、曲风存归一化后的简体（F2）。全选不写（结果和不筛选一样）。
 * 读的时候归一化由调用方传进来：归一化要用繁转简表，不在首屏路径上（阶段 4「2.」）。
 * 不兼容旧格式（yearStart、yearEnd、*、!）：页面重构完成前不会上线。
 */
import {
  readArray,
  readFlag,
  readInt,
  readLiteral,
  readString,
  writeArray,
  writeFlag,
  writeInt,
  writeString,
} from "@/lib/utils/url-params";
import {
  DEFAULT_MUSIC_LIBRARY_VIEW_MODE,
  FILTER_OPTION_ALL,
  MUSIC_LIBRARY_VIEW_MODES,
  type MusicLibraryViewMode,
} from "@/lib/constants";
import {
  emptyFacets,
  FACET_KEYS,
  type FacetKey,
  type FacetSelection,
  formatYear,
  type LibraryFilters,
  NO_SELECTION,
  parseYear,
  type YearFilter,
} from "./filters";

export interface LibraryUrlState extends LibraryFilters {
  query: string;
  view: MusicLibraryViewMode;
  page: number;
  advanced: boolean;
}

const excludeKey = (key: FacetKey) => `${key}Not`;

const FACET_PARAMS = FACET_KEYS.flatMap((k) => [k, excludeKey(k)]);

/**
 * 影响列表的参数：带了其中任何一个打开，服务端渲染的默认列表就不对，
 * 要先藏起来（lib/library/reveal.ts）。advanced 只管筛选面板展开，不在其中。
 */
export const LIST_PARAMS: readonly string[] = [
  "q",
  "type",
  "year",
  ...FACET_PARAMS,
  "view",
  "page",
];

/** 要不要马上加载第二档（engine.ts 和筛选面板）：搜索、按人名曲风筛选、展开筛选面板 */
export function needsDeferred(params: URLSearchParams): boolean {
  return (
    !!params.get("q") ||
    readFlag(params, "advanced") ||
    FACET_PARAMS.some((k) => params.has(k))
  );
}

/** 第二档没到时的权宜：只去掉首尾空白。人名、曲风筛选要等真正的归一化才算 */
const trimOnly = (text: string) => text.trim();

/** 地址栏里的人名可能是手打的、繁体的，按归一化后的值比较 */
function readFacetValues(
  params: URLSearchParams,
  key: string,
  normalize: (text: string) => string,
): string[] {
  return [...new Set(readArray(params, key).map(normalize).filter(Boolean))];
}

function readFacet(
  params: URLSearchParams,
  key: FacetKey,
  normalize: (text: string) => string,
): FacetSelection {
  // 两种都写了时以包含为准：包含更具体
  const include = readFacetValues(params, key, normalize);
  if (include.length > 0) return { mode: "include", values: include };
  const exclude = readFacetValues(params, excludeKey(key), normalize);
  if (exclude.length > 0) return { mode: "exclude", values: exclude };
  return NO_SELECTION;
}

/** normalize 传 engine.ts 的归一化；不传时人名、曲风只去掉首尾空白 */
export function parseLibraryUrl(
  params: URLSearchParams,
  normalize: (text: string) => string = trimOnly,
): LibraryUrlState {
  const facets = emptyFacets();
  for (const key of FACET_KEYS) facets[key] = readFacet(params, key, normalize);
  return {
    query: readString(params, "q"),
    type: readString(params, "type", FILTER_OPTION_ALL),
    year: parseYear(params.get("year")),
    facets,
    view: readLiteral(
      params,
      "view",
      MUSIC_LIBRARY_VIEW_MODES,
      DEFAULT_MUSIC_LIBRARY_VIEW_MODE,
    ),
    page: Math.max(1, readInt(params, "page", 1)),
    advanced: readFlag(params, "advanced"),
  };
}

export function writeQuery(draft: URLSearchParams, query: string): void {
  writeString(draft, "q", query);
}

export function writeType(draft: URLSearchParams, type: string): void {
  writeString(draft, "type", type, FILTER_OPTION_ALL);
}

export function writeYear(draft: URLSearchParams, year: YearFilter): void {
  const raw = formatYear(year);
  if (raw === null) draft.delete("year");
  else draft.set("year", raw);
}

/** 全选（排除空）和不选都不写 */
export function writeFacet(
  draft: URLSearchParams,
  key: FacetKey,
  sel: FacetSelection,
): void {
  writeArray(draft, key, sel.mode === "include" ? sel.values : []);
  writeArray(draft, excludeKey(key), sel.mode === "exclude" ? sel.values : []);
}

export function writeView(
  draft: URLSearchParams,
  view: MusicLibraryViewMode,
): void {
  writeString(draft, "view", view, DEFAULT_MUSIC_LIBRARY_VIEW_MODE);
}

export function writePage(draft: URLSearchParams, page: number): void {
  writeInt(draft, "page", Math.max(1, page), 1);
}

export function writeAdvanced(draft: URLSearchParams, open: boolean): void {
  writeFlag(draft, "advanced", open);
}

/** 筛选条件全部清空（视图保留：那是怎么看，不是看什么） */
export function clearFilters(draft: URLSearchParams): void {
  for (const key of ["q", "type", "year", "page", "advanced"]) {
    draft.delete(key);
  }
  for (const key of FACET_KEYS) writeFacet(draft, key, NO_SELECTION);
}
