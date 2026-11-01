import { useMemo } from "react";
import { useDebouncedValue } from "@/hooks/ui/useDebouncedValue";
import { searchSongs } from "@/lib/search/rank";
import type { SongDetail } from "@/lib/types";
import { mapAndSortSongs } from "@/lib/utils/utils-song";

/**
 * 后台歌曲列表的搜索（见 docs/LIBRARY.md 阶段 6）。
 *
 * 用曲库页的搜索内核（src/lib/search/rank.ts），只查题名、人名、专辑，不搜歌词。
 * 没有搜索词时按日期从新到旧；有搜索词时按命中的档位排（题名完全对上的在最前），同一档里仍按日期。
 */
export function useSongs(
  songs: SongDetail[],
  searchTerm: string,
): SongDetail[] {
  const [debouncedSearchTerm] = useDebouncedValue(searchTerm, 300);
  // 清空搜索框时立即显示全部，不等防抖
  const resolvedSearchTerm = searchTerm === "" ? "" : debouncedSearchTerm;

  const byDate = useMemo(() => mapAndSortSongs(songs), [songs]);

  return useMemo(() => {
    const result = searchSongs(byDate, resolvedSearchTerm, null);
    return result ? result.hits.map((hit) => hit.song) : byDate;
  }, [byDate, resolvedSearchTerm]);
}
