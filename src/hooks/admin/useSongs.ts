import { useMemo } from "react";
import { searchSongs } from "@/lib/search/rank";
import type { SongDetail } from "@/lib/types";
import { mapAndSortSongs } from "@/lib/utils/utils-song";

/**
 * 后台歌曲列表的搜索（见 docs/LIBRARY.md 阶段 6）。
 *
 * 用曲库页的搜索内核（src/lib/search/rank.ts），只查题名、人名、专辑，不搜歌词。
 * 没有搜索词时按日期从新到旧；有搜索词时按命中的档位排（题名完全对上的在最前），同一档里仍按日期。
 *
 * 不防抖：防抖在输入那一端（SongListClient 的搜索框，同曲库页），这里传进来的已经是地址栏里的搜索词。
 */
export function useSongs(
  songs: SongDetail[],
  searchTerm: string,
): SongDetail[] {
  const byDate = useMemo(() => mapAndSortSongs(songs), [songs]);

  return useMemo(() => {
    const result = searchSongs(byDate, searchTerm, null);
    return result ? result.hits.map((hit) => hit.song) : byDate;
  }, [byDate, searchTerm]);
}
