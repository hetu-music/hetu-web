import { FILTER_OPTION_ALL, FILTER_OPTION_UNKNOWN } from "@/lib/constants";
import { Song, SongDetail, SongInfo, SongInfoRow } from "@/lib/types";
import { formatDate, formatTime } from "@/lib/utils/utils-common";
import Fuse from "fuse.js";
import { useTranslations } from "next-intl";

// 判断字符串首字母是否为英文
function startsWithEnglish(str: string): boolean {
  return /^[a-zA-Z]/.test(str);
}

// 优化的排序函数：首字母英文的在前按字母表排序，首字母中文的在后按拼音排序
export function sortNamesOptimized(names: string[]): string[] {
  const englishStartNames: string[] = [];
  const chineseStartNames: string[] = [];

  names.forEach((name) => {
    if (startsWithEnglish(name)) {
      englishStartNames.push(name);
    } else {
      chineseStartNames.push(name);
    }
  });

  // 首字母英文的按字母表排序
  englishStartNames.sort((a, b) =>
    a.localeCompare(b, "en", { sensitivity: "base" }),
  );

  // 首字母中文的按拼音排序
  chineseStartNames.sort((a, b) =>
    a.localeCompare(b, "zh-CN", { sensitivity: "base" }),
  );

  return [...englishStartNames, ...chineseStartNames];
}

// 处理 LRC 歌词用于搜索
export function processLyricsForSearch(lrcLyrics: string | null): string {
  if (!lrcLyrics) return "";

  // 1. 过滤掉头部信息行 (ar:, ti:, al:, by:, offset:, re:, ve: 等)
  let processedText = lrcLyrics.replace(
    /^\[(?:ar|ti|al|by|offset|re|ve):[^\]]*\]\s*$/gm,
    "",
  );

  // 2. 移除时间戳 [00:26.87] [00:15.365] 等
  processedText = processedText.replace(/\[\d{1,2}:\d{2}(?:\.\d{1,3})?\]/g, "");

  // 3. 清理多余的空白字符和空行
  const lines = processedText
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  return lines.join(" ");
}

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

// 过滤歌曲
/** 歌词全文在 Fuse 索引中的字段名，检索与片段展示共用 */
export const LYRIC_SEARCH_KEY = "lyricContent";

/** Fuse 给出的命中字符区间 [start, end]（闭区间） */
export type MatchRanges = ReadonlyArray<readonly [number, number]>;

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

type TranslationFn = ReturnType<typeof useTranslations>;

// 计算歌曲信息
export function calculateSongInfo(
  song: SongDetail,
  t?: TranslationFn,
  tCommon?: TranslationFn,
  tEnum?: TranslationFn,
): SongInfo {
  const getLabel = (key: string, fallback: string) => (t ? t(key) : fallback);
  const unknownStr = tCommon ? tCommon("unknown") : "未知";
  const creditRow = (
    key: string,
    fallback: string,
    names: string[] | null | undefined,
  ): SongInfoRow =>
    names && names.length > 0
      ? { label: getLabel(key, fallback), value: names.join(" "), names }
      : { label: getLabel(key, fallback), value: unknownStr };

  return {
    creativeInfo: [
      creditRow("labels.lyricist", "作词", song.lyricist),
      creditRow("labels.composer", "作曲", song.composer),
      creditRow("labels.arranger", "编曲", song.arranger),
      creditRow("labels.artist", "演唱", song.artist),
    ],
    basicInfo: [
      {
        label: getLabel("labels.album", "专辑"),
        value: song.album || unknownStr,
      },
      creditRow("labels.albumartist", "出品发行", song.albumartist),
      {
        label: getLabel("labels.releaseDate", "发行日期"),
        value: formatDate(song.date),
      },
      {
        label: getLabel("labels.duration", "时长"),
        value: formatTime(song.length),
      },
      {
        label: getLabel("labels.trackNumber", "曲号"),
        value: (() => {
          const track = song.track;
          const total = song.tracktotal;
          if (!track && !total) return unknownStr;
          if (track && !total) {
            return t ? t("trackFormat.trackOnly", { track }) : `第${track}首`;
          }
          if (!track && total) {
            return t ? t("trackFormat.totalOnly", { total }) : `共${total}首`;
          }
          if (track && total) {
            return t
              ? t("trackFormat.both", { track, total })
              : `第${track}首/共${total}首`;
          }
          return unknownStr;
        })(),
      },
      {
        label: getLabel("labels.discNumber", "碟号"),
        value: (() => {
          const disc = song.discnumber;
          const total = song.disctotal;
          if (!disc && !total) return unknownStr;
          if (disc && !total) {
            return t ? t("discFormat.discOnly", { disc }) : `第${disc}张`;
          }
          if (!disc && total) {
            return t ? t("discFormat.totalOnly", { total }) : `共${total}张`;
          }
          if (disc && total) {
            return t
              ? t("discFormat.both", { disc, total })
              : `第${disc}张/共${total}张`;
          }
          return unknownStr;
        })(),
      },
      {
        label: getLabel("labels.genre", "流派"),
        value:
          song.genre && song.genre.length > 0
            ? song.genre
                .map((g) =>
                  tEnum && tEnum.has(`genre.${g}`) ? tEnum(`genre.${g}`) : g,
                )
                .join(" ")
            : unknownStr,
      },
      {
        label: getLabel("labels.type", "类型"),
        value:
          song.type && song.type.length > 0
            ? song.type
                .map((typeVal) =>
                  tEnum && tEnum.has(`type.${typeVal}`)
                    ? tEnum(`type.${typeVal}`)
                    : typeVal,
                )
                .join(" ")
            : tEnum && tEnum.has("type.原创")
              ? tEnum("type.原创")
              : "原创",
      },
    ],
  };
}

// 数据映射和排序
export function mapAndSortSongs(data: SongDetail[]): SongDetail[] {
  const mapped = data.map((song) => ({
    ...song,
    year: song.date ? new Date(song.date).getFullYear() : null,
  }));

  return mapped.slice().sort((a, b) => {
    if (a.date && b.date) {
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    } else if (a.date && !b.date) {
      return -1;
    } else if (!a.date && b.date) {
      return 1;
    } else {
      return 0;
    }
  });
}

/** 曲库计数：资料有争议的歌照常展示，但不计入收录总数 */
export function countCatalogSongs(
  songs: readonly Pick<Song, "dispute_note">[],
): number {
  return songs.filter((s) => !s.dispute_note).length;
}

export function getCoverUrl(song: Pick<Song, "id" | "hascover">): string {
  if (song.hascover === true) {
    return `https://cover.hetu-music.com/cover/${song.id}.jpg`;
  } else if (song.hascover === false) {
    return "https://cover.hetu-music.com/cover/proto.jpg";
  } else {
    return "https://cover.hetu-music.com/cover/default.jpg";
  }
}

// 获取乐谱图片 URL
export function getNmnUrl(song: Song | SongDetail): string {
  return `https://cover.hetu-music.com/nmn/${song.id}.png`;
}
