import { useDebouncedValue } from "@/hooks/ui/useDebouncedValue";
import { useMemo, useState } from "react";
import { FILTER_OPTION_ALL } from "@/lib/constants";
import type { SongDetail } from "@/lib/types";
import {
  mapAndSortSongs,
  filterSongs,
  createFuseInstance,
} from "@/lib/utils/utils-song";

export function useSongs(
  initialSongs: SongDetail[],
  initialError: string | null,
  searchTerm: string,
) {
  const [songs, setSongs] = useState<SongDetail[]>(initialSongs);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(initialError);
  const [debouncedSearchTerm] = useDebouncedValue(searchTerm, 300);
  const resolvedSearchTerm =
    searchTerm === "" ? searchTerm : debouncedSearchTerm;

  // 缓存 Fuse 实例，只在歌曲数据变化时重新创建
  const fuseInstance = useMemo(() => {
    return createFuseInstance(songs);
  }, [songs]);

  // 使用统一的 filterSongs 函数，只传入搜索词，其他筛选条件设为默认值
  const filteredSongs = useMemo(() => {
    return filterSongs(
      songs,
      resolvedSearchTerm,
      FILTER_OPTION_ALL,
      FILTER_OPTION_ALL,
      [], // selectedLyricist
      [], // selectedComposer
      [], // selectedArranger
      [], // selectedGenre
      [], // selectedArtist
      fuseInstance, // 使用缓存的 Fuse 实例
    );
  }, [songs, resolvedSearchTerm, fuseInstance]);

  // 排序
  const sortedSongs = useMemo(
    () => mapAndSortSongs(filteredSongs),
    [filteredSongs],
  );

  return {
    songs,
    setSongs,
    loading,
    setLoading,
    error,
    setError,
    filteredSongs,
    sortedSongs,
  };
}
