"use client";

/**
 * 曲库页的结果：搜索、筛选、哪些选项会筛出零首（F5）。都是地址栏状态的纯函数，
 * 没有防抖（防抖在输入那一端，见 useLibraryState）。
 *
 * 只按类型、年份筛选在首屏就算得出来；搜索和人名、曲风筛选要用第二档的 engine
 * （见 docs/LIBRARY.md 阶段 4「2.」）。engine 没到时 pending 为 true，结果先停在上一次
 * （第一次是全部歌），列表藏不藏由 useListReveal 决定。
 *
 * 搜索用 src/lib/search/rank.ts，先筛后搜（阶段 5）：歌词兜底看的是「筛完的这些歌里
 * 有没有精确命中」，先在全部歌里搜的话，别人的歌有一句精确命中，这里就不兜底了。
 * 歌词索引没到时只查元数据各档；到了之后歌词各档追加在后面，已显示的不重排（S5）。
 */
import { useCallback, useMemo, useState } from "react";
import type { LyricsSearchState } from "@/hooks/library/useLyricsLines";
import type { LibraryEngine } from "@/lib/library/engine";
import {
  FACET_KEYS,
  type FacetKey,
  filterByTypeAndYear,
  isAnyFacetActive,
  type LibraryFilters,
} from "@/lib/library/filters";
import type { LyricsCorpus } from "@/lib/search/corpus";
// 只能引用类型：rank.ts 连着归一化和繁转简表，引用值就把它们拉回首屏（第二档的东西都经 engine 用）
import type { SearchHit } from "@/lib/search/rank";
import type { Snippet } from "@/lib/search/snippet";
import type { Song } from "@/lib/types";

const NOTHING_AVAILABLE = Object.fromEntries(
  FACET_KEYS.map((k) => [k, new Set<string>()]),
) as Record<FacetKey, Set<string>>;

export function useLibraryResults({
  songs,
  query,
  filters,
  engine,
  corpus,
  lyricsState,
  withAvailable,
}: {
  songs: Song[];
  query: string;
  filters: LibraryFilters;
  engine: LibraryEngine | null;
  /** 歌词索引，没到时 null */
  corpus: LyricsCorpus | null;
  lyricsState: LyricsSearchState;
  /** 要不要算置灰：只有筛选面板展开时才用得到 */
  withAvailable: boolean;
}) {
  const facetsActive = isAnyFacetActive(filters.facets);
  const needsEngine = query !== "" || facetsActive;

  // 先筛
  const filtered = useMemo(() => {
    if (!facetsActive) return filterByTypeAndYear(songs, filters);
    return engine ? engine.filter(songs, filters) : null;
  }, [facetsActive, engine, songs, filters]);

  // 再搜
  const searched = useMemo(() => {
    if (!query || !engine || !filtered) return null;
    return engine.search(filtered, query, corpus);
  }, [query, engine, filtered, corpus]);

  const computed = useMemo(() => {
    if (!needsEngine) return filtered;
    if (!engine || !filtered) return null;
    return searched ? searched.hits.map((h) => h.song) : filtered;
  }, [needsEngine, engine, filtered, searched]);

  // engine 没到时停在上一次的结果：用户在它到之前就打了字，列表不会先跳回全部歌
  const [last, setLast] = useState<Song[]>(songs);
  if (computed && computed !== last) setLast(computed);
  const results = computed ?? last;

  // 置灰按「全部歌里搜到的」算：其他维度的筛选在 availableFacetValues 里自己套
  const available = useMemo(() => {
    if (!withAvailable || !engine) return NOTHING_AVAILABLE;
    const pool = query
      ? (engine.search(songs, query, corpus)?.hits.map((h) => h.song) ?? songs)
      : songs;
    return engine.available(pool, filters);
  }, [withAvailable, engine, songs, query, corpus, filters]);

  const hitById = useMemo(
    () =>
      new Map<number, SearchHit>(
        searched?.hits.map((h) => [h.song.id, h]) ?? [],
      ),
    [searched],
  );

  const getLyricsSnippet = useCallback(
    (songId: number): Snippet | undefined => {
      const hit = hitById.get(songId);
      if (!hit || !engine || !corpus || !searched) return undefined;
      return engine.snippet(corpus, hit, searched.words) ?? undefined;
    },
    [hitById, engine, corpus, searched],
  );

  const hasQuery = !!searched;
  return {
    results,
    available,
    getLyricsSnippet,
    /** 要用 engine 才算得出来，而它还没到 */
    pending: computed === null,
    /** 结果全是兜底（近似）命中：兜底只在一首精确命中都没有时才有，不会混在一起 */
    approximate: hasQuery && !!engine?.isApproximate(searched),
    /** 在搜，歌词还没搜上：结果可能还会在后面追加 */
    lyricsPending:
      hasQuery && (lyricsState === "idle" || lyricsState === "loading"),
  };
}
