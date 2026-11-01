"use client";

/**
 * 曲库页的结果：搜索、筛选、哪些选项会筛出零首（F5）。都是地址栏状态的纯函数，
 * 没有防抖（防抖在输入那一端，见 useLibraryState）。
 *
 * 只按类型、年份筛选在首屏就算得出来；搜索和人名、曲风筛选要用第二档的 engine
 * （见 docs/LIBRARY.md 阶段 4「2.」）。engine 没到时 pending 为 true，结果先停在上一次
 * （第一次是全部歌），列表藏不藏由 useListReveal 决定。
 *
 * 搜索暂时仍是旧的 Fuse，阶段 5 换成 src/lib/search/rank.ts。
 * Fuse 的排序只看每首歌自己，所以「先在全部歌里搜、再筛」和「先筛、再搜」结果和顺序相同；
 * 先搜可以只调一次 Fuse，置灰的计算也要用到全部搜到的歌。
 */
import { useCallback, useMemo, useState } from "react";
import {
  extractLyricsSnippet,
  useLyricsIndex,
} from "@/hooks/library/useLyricsIndex";
import type { LibraryEngine } from "@/lib/library/engine";
import {
  FACET_KEYS,
  type FacetKey,
  filterByTypeAndYear,
  isAnyFacetActive,
  type LibraryFilters,
} from "@/lib/library/filters";
import type { Song } from "@/lib/types";

const NOTHING_AVAILABLE = Object.fromEntries(
  FACET_KEYS.map((k) => [k, new Set<string>()]),
) as Record<FacetKey, Set<string>>;

export function useLibraryResults(
  songs: Song[],
  query: string,
  filters: LibraryFilters,
  engine: LibraryEngine | null,
) {
  const { entries, state: lyricsState } = useLyricsIndex(songs);
  const needsEngine = query !== "" || isAnyFacetActive(filters.facets);

  const searched = useMemo(
    () => (engine ? engine.search(query, entries) : null),
    [engine, query, entries],
  );
  const pool = searched?.songs ?? songs;

  const computed = useMemo(() => {
    if (!needsEngine) return filterByTypeAndYear(songs, filters);
    return engine ? engine.filter(pool, filters) : null;
  }, [needsEngine, engine, songs, pool, filters]);

  // engine 没到时停在上一次的结果：用户在它到之前就打了字，列表不会先跳回全部歌
  const [last, setLast] = useState<Song[]>(songs);
  if (computed && computed !== last) setLast(computed);
  const results = computed ?? last;

  const available = useMemo(
    () => (engine ? engine.available(pool, filters) : NOTHING_AVAILABLE),
    [engine, pool, filters],
  );

  const getLyricsSnippet = useCallback(
    (songId: number) => {
      if (!engine || !searched || lyricsState !== "ready") return undefined;
      // 只有命中确实发生在歌词上才给片段：靠题名、专辑命中的歌不在这个 Map 里
      return extractLyricsSnippet(
        engine.lyricsOf(songId),
        searched.lyricMatchesById.get(songId),
      );
    },
    [engine, searched, lyricsState],
  );

  return {
    results,
    available,
    lyricsState,
    getLyricsSnippet,
    /** 要用 engine 才算得出来，而它还没到 */
    pending: computed === null,
  };
}
