"use client";

/**
 * 曲库页的结果：搜索、筛选、哪些选项会筛出零首（F5）。都是地址栏状态的纯函数，
 * 没有防抖（防抖在输入那一端，见 useLibraryState）。
 *
 * 搜索暂时仍是旧的 Fuse（legacySearch），阶段 5 换成 src/lib/search/rank.ts。
 * Fuse 的排序只看每首歌自己，所以「先在全部歌里搜、再筛」和「先筛、再搜」结果和顺序相同；
 * 先搜可以只调一次 Fuse，置灰的计算也要用到全部搜到的歌。
 */
import { useCallback, useMemo } from "react";
import {
  extractLyricsSnippet,
  useLyricsIndex,
} from "@/hooks/library/useLyricsIndex";
import { legacySearch } from "@/lib/library/legacy-search";
import {
  availableFacetValues,
  filterSongs,
  type LibraryFilters,
} from "@/lib/library/filters";
import type { Song } from "@/lib/types";
import { createFuseInstance } from "@/lib/utils/utils-song";

export function useLibraryResults(
  songs: Song[],
  query: string,
  filters: LibraryFilters,
) {
  const fuse = useMemo(() => createFuseInstance(songs), [songs]);
  const {
    lyricsFuseInstance,
    lyricsMap,
    state: lyricsState,
  } = useLyricsIndex(songs);
  const searched = useMemo(
    () =>
      query && lyricsFuseInstance
        ? legacySearch(songs, query, lyricsFuseInstance)
        : legacySearch(songs, query, fuse),
    [songs, query, fuse, lyricsFuseInstance],
  );
  const pool = searched?.songs ?? songs;

  const results = useMemo(() => filterSongs(pool, filters), [pool, filters]);
  const available = useMemo(
    () => availableFacetValues(pool, filters),
    [pool, filters],
  );

  const getLyricsSnippet = useCallback(
    (songId: number) => {
      if (!searched || lyricsState !== "ready") return undefined;
      // 只有命中确实发生在歌词上才给片段：靠题名、专辑命中的歌不在这个 Map 里
      return extractLyricsSnippet(
        lyricsMap.get(songId) || "",
        searched.lyricMatchesById.get(songId),
      );
    },
    [searched, lyricsMap, lyricsState],
  );

  return { results, available, lyricsState, getLyricsSnippet };
}
