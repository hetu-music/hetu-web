/**
 * 曲库页的第二档（见 docs/LIBRARY.md 阶段 4「2.」）：要用归一化（含繁转简表）的部分——
 * 人名、曲风的选项统计和匹配、置灰（F5）、搜索（阶段 5 起是 src/lib/search/rank.ts）、歌词索引的构建。不在首屏路径上，页面空闲时和筛选面板
 * 一起加载（src/components/library/deferred.ts）；地址栏带了搜索词或人名、曲风时挂载后立即加载。
 *
 * 只按类型、年份筛选不用等它（filters.ts 的 filterByTypeAndYear）。
 */
import { FILTER_OPTION_UNKNOWN } from "@/lib/constants";
import {
  FACET_KEYS,
  FACETS,
  type FacetConfig,
  type FacetKey,
  type FacetOption,
  type LibraryFilters,
  type LibraryOptions,
  buildBaseOptions,
  matchesFacet,
  matchesType,
  matchesYear,
  orderBy,
} from "@/lib/library/filters";
import {
  buildCorpusChunked,
  type LyricsCorpus,
  type LyricsLinesEntry,
} from "@/lib/search/corpus";
import { getSongMeta, type SongMeta } from "@/lib/search/meta";
import { normalize } from "@/lib/search/normalize";
import {
  type SearchHit,
  type SearchResult,
  searchSongs,
  TIER,
} from "@/lib/search/rank";
import { buildSnippet, type Snippet } from "@/lib/search/snippet";
import type { Song } from "@/lib/types";
import { sortNamesOptimized } from "@/lib/utils/utils-song";

/** 归一化后的值；SongMeta 里每个维度都按同名字段存 */
function metaValues(meta: SongMeta, key: FacetKey): readonly string[] {
  return meta[key];
}

/** 人名、曲风各维度的选项：值是归一化后的，显示文字按页面字形 */
export function buildFacetOptions(
  songs: readonly Song[],
): Record<FacetKey, FacetOption[]> {
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
  return facets;
}

export function buildLibraryOptions(songs: readonly Song[]): LibraryOptions {
  return { ...buildBaseOptions(songs), facets: buildFacetOptions(songs) };
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

export interface LibraryEngine {
  facetOptions: Record<FacetKey, FacetOption[]>;
  /** 地址栏里手打的、繁体的人名也按归一化后的值比较 */
  normalize: (text: string) => string;
  filter(songs: readonly Song[], filters: LibraryFilters): Song[];
  available(
    songs: readonly Song[],
    filters: LibraryFilters,
  ): Record<FacetKey, Set<string>>;
  /** 在 songs 里搜；corpus 为 null（歌词还没到）时只查元数据各档。没有可搜的字时返回 null */
  search(
    songs: readonly Song[],
    query: string,
    corpus: LyricsCorpus | null,
  ): SearchResult | null;
  snippet(
    corpus: LyricsCorpus,
    hit: SearchHit,
    words: readonly string[],
  ): Snippet | null;
  /** 结果全是兜底（近似）命中：兜底只在一首精确命中都没有时才有，不会和精确的混在一起 */
  isApproximate(result: SearchResult): boolean;
  /** 分段构建歌词索引，不卡输入；同一份数据只建一次 */
  buildCorpus(entries: readonly LyricsLinesEntry[]): Promise<LyricsCorpus>;
  /** 已经建好的索引，没建好时 null：从详情页返回时直接用上，不再等一轮 */
  builtCorpus(entries: readonly LyricsLinesEntry[]): LyricsCorpus | null;
}

/** 一份歌词数据一个索引；返回曲库页、切换简繁再切回来时不重建 */
const corpora = new WeakMap<
  readonly LyricsLinesEntry[],
  { promise: Promise<LyricsCorpus>; value: LyricsCorpus | null }
>();

function corpusFor(entries: readonly LyricsLinesEntry[]) {
  let entry = corpora.get(entries);
  if (!entry) {
    const created: {
      promise: Promise<LyricsCorpus>;
      value: LyricsCorpus | null;
    } = {
      value: null,
      promise: buildCorpusChunked(entries).then((corpus) => {
        created.value = corpus;
        return corpus;
      }),
    };
    // 失败了下次重建
    created.promise.catch(() => corpora.delete(entries));
    corpora.set(entries, created);
    entry = created;
  }
  return entry;
}

/** 一份曲库一个 */
export function createLibraryEngine(songs: Song[]): LibraryEngine {
  return {
    facetOptions: buildFacetOptions(songs),
    normalize,
    filter: filterSongs,
    available: availableFacetValues,
    search: searchSongs,
    snippet: buildSnippet,
    isApproximate: (result) =>
      result.hits.length > 0 &&
      result.hits.every((h) => h.tier === TIER.LYRIC_FALLBACK),
    buildCorpus: (entries) => corpusFor(entries).promise,
    builtCorpus: (entries) => corpora.get(entries)?.value ?? null,
  };
}
