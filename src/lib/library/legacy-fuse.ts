/**
 * 旧的 Fuse 搜索（曲库页、后台歌曲列表、scripts/search-eval.ts 用）。
 * 单独成一个文件，Fuse 才不会跟着 utils-song 进首屏（见 docs/LIBRARY.md 阶段 4「2.」）。
 * 阶段 5 曲库页换成 src/lib/search/rank.ts，阶段 6 后台也换掉后删除。
 */
import Fuse from "fuse.js";
import { FILTER_OPTION_ALL, FILTER_OPTION_UNKNOWN } from "@/lib/constants";
import type { Song } from "@/lib/types";
import { LYRIC_SEARCH_KEY, type MatchRanges } from "@/lib/utils/utils-song";

export type LyricsEntry = { id: number; l: string };

// 创建 Fuse.js 搜索实例（不包含歌词搜索）
export function createFuseInstance(songs: Song[]) {
  // 为每首歌准备搜索数据
  const searchData = songs.map((song) => ({
    ...song,
    searchableContent: [
      song.title,
      song.album || "",
      (song.artist || []).join(" "),
      (song.lyricist || []).join(" "),
      (song.composer || []).join(" "),
      (song.arranger || []).join(" "),
    ]
      .filter(Boolean)
      .join(" "),
  }));

  return new Fuse(searchData, {
    keys: [
      { name: "title", weight: 0.35 }, // 提高标题权重
      { name: "album", weight: 0.2 }, // 提高专辑权重
      { name: "artist", weight: 0.15 },
      { name: "lyricist", weight: 0.15 },
      { name: "composer", weight: 0.1 },
      { name: "arranger", weight: 0.05 },
      // 搜别署也能找到，列表里显示的仍是主名
      { name: "creditAliases", weight: 0.05 },
    ],
    threshold: 0.4, // 放宽阈值，对中文更友好
    includeScore: true,
    ignoreLocation: true,
    findAllMatches: true,
    minMatchCharLength: 1, // 允许单字符匹配
    shouldSort: true,
  });
}

type FuseExtended = Fuse<
  Song & { searchableContent: string; lyricContent: string }
>;

/** 含歌词的 Fuse 索引（曲库页搜歌词用；scripts/search-eval.ts 也用它按线上配置跑旧方案做对比） */
export function buildFromEntries(
  songs: Song[],
  entries: readonly LyricsEntry[],
): { map: Map<number, string>; fuse: FuseExtended } {
  const map = new Map<number, string>();
  entries.forEach((entry) => map.set(entry.id, entry.l));

  const searchData = songs.map((song) => ({
    ...song,
    searchableContent: [
      song.title,
      song.album || "",
      (song.artist || []).join(" "),
      (song.lyricist || []).join(" "),
      (song.composer || []).join(" "),
      (song.arranger || []).join(" "),
    ]
      .filter(Boolean)
      .join(" "),
    [LYRIC_SEARCH_KEY]: map.get(song.id) || "",
  }));

  const fuse = new Fuse(searchData, {
    keys: [
      { name: "title", weight: 0.35 },
      { name: "album", weight: 0.15 },
      { name: "artist", weight: 0.15 },
      { name: "lyricist", weight: 0.1 },
      { name: "composer", weight: 0.05 },
      { name: "arranger", weight: 0.05 },
      { name: "creditAliases", weight: 0.05 },
      { name: LYRIC_SEARCH_KEY, weight: 0.15 },
    ],
    threshold: 0.35,
    includeScore: true,
    ignoreLocation: true,
    findAllMatches: true,
    minMatchCharLength: 1,
    shouldSort: true,
    includeMatches: true,
  });

  return { map, fuse };
}

export interface SearchAndFilterResult {
  songs: Song[];
  /**
   * 每首歌「命中发生在歌词字段上」的字符区间。
   * 直接取自 Fuse 的 matches，不再由展示层用 indexOf 重新推断——
   * 两者算法不同会导致搜出来的歌显示不出片段。
   * 靠标题/专辑等元数据命中的歌不会出现在这里，也就不会错误地展示歌词片段。
   */
  lyricMatchesById: Map<number, MatchRanges>;
}

/**
 * 搜索 + 筛选，同时保留 Fuse 的命中区间。
 * filterSongs 是它只取 songs 的薄封装。
 */
export function searchAndFilterSongs(
  songsData: Song[],
  searchTerm: string,
  selectedType: string,
  selectedYear: string | (string | number)[],
  selectedLyricist: string[],
  selectedComposer: string[],
  selectedArranger: string[],
  selectedGenre: string[] = [],
  selectedArtist: string[] = [],
  // 接受基础索引或含歌词的扩展索引
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fuseInstance?: Fuse<any>,
): SearchAndFilterResult {
  let filteredBySearch = songsData;
  const lyricMatchesById = new Map<number, MatchRanges>();

  // 如果有搜索词，使用 Fuse.js 进行模糊搜索
  if (searchTerm.trim()) {
    const fuse = fuseInstance || createFuseInstance(songsData);
    const searchResults = fuse.search(searchTerm);
    filteredBySearch = searchResults.map((result) => result.item);

    // 保留命中区间：仅当 Fuse 配置了 includeMatches 时存在
    for (const result of searchResults) {
      const lyricMatch = result.matches?.find(
        (m) => m.key === LYRIC_SEARCH_KEY,
      );
      if (lyricMatch?.indices?.length) {
        lyricMatchesById.set(result.item.id, lyricMatch.indices);
      }
    }
  }

  // 应用其他筛选条件
  const songs = filteredBySearch.filter((song) => {
    // type 筛选
    const matchesType =
      selectedType === FILTER_OPTION_ALL ||
      (selectedType === FILTER_OPTION_UNKNOWN
        ? !song.type || song.type.length === 0
        : song.type && song.type.includes(selectedType));

    // year 筛选
    let matchesYear = true;
    if (Array.isArray(selectedYear)) {
      if (selectedYear.length > 0) {
        // 如果是数组，检查是否包含
        const yearVal = song.year || FILTER_OPTION_UNKNOWN;
        matchesYear = selectedYear.includes(yearVal);
      }
    } else {
      matchesYear =
        selectedYear === FILTER_OPTION_ALL ||
        (selectedYear === FILTER_OPTION_UNKNOWN
          ? !song.year
          : (song.year?.toString() ?? "") === selectedYear);
    }

    const matchesLyricist =
      selectedLyricist.length === 0 ||
      selectedLyricist.some((sel) =>
        sel === FILTER_OPTION_UNKNOWN
          ? !song.lyricist || song.lyricist.length === 0
          : song.lyricist && song.lyricist.includes(sel),
      );

    const matchesComposer =
      selectedComposer.length === 0 ||
      selectedComposer.some((sel) =>
        sel === FILTER_OPTION_UNKNOWN
          ? !song.composer || song.composer.length === 0
          : song.composer && song.composer.includes(sel),
      );

    const matchesArranger =
      selectedArranger.length === 0 ||
      selectedArranger.some((sel) =>
        sel === FILTER_OPTION_UNKNOWN
          ? !song.arranger || song.arranger.length === 0
          : song.arranger && song.arranger.includes(sel),
      );

    const matchesGenre =
      selectedGenre.length === 0 ||
      selectedGenre.some((sel) =>
        sel === FILTER_OPTION_UNKNOWN
          ? !song.genre || song.genre.length === 0
          : song.genre && song.genre.includes(sel),
      );

    const matchesArtist =
      selectedArtist.length === 0 ||
      selectedArtist.some((sel) =>
        sel === FILTER_OPTION_UNKNOWN
          ? !song.artist || song.artist.length === 0
          : song.artist && song.artist.includes(sel),
      );

    return (
      matchesType &&
      matchesYear &&
      matchesLyricist &&
      matchesComposer &&
      matchesArranger &&
      matchesGenre &&
      matchesArtist
    );
  });

  return { songs, lyricMatchesById };
}

/** 只要筛选结果、不关心命中区间时的薄封装 */
export function filterSongs(
  songsData: Song[],
  searchTerm: string,
  selectedType: string,
  selectedYear: string | (string | number)[],
  selectedLyricist: string[],
  selectedComposer: string[],
  selectedArranger: string[],
  selectedGenre: string[] = [],
  selectedArtist: string[] = [],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fuseInstance?: Fuse<any>,
): Song[] {
  return searchAndFilterSongs(
    songsData,
    searchTerm,
    selectedType,
    selectedYear,
    selectedLyricist,
    selectedComposer,
    selectedArranger,
    selectedGenre,
    selectedArtist,
    fuseInstance,
  ).songs;
}
