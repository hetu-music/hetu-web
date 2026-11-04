import { Song, SongDetail, SongInfo, SongInfoRow } from "@/lib/types";
import { formatDate, formatTime } from "@/lib/utils/utils-common";
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

type TranslationFn = ReturnType<typeof useTranslations>;

/**
 * 类型、流派的显示名：enums 里有译名就用译名，没有的（库里新出现的值）照原样显示。
 * tEnum 是 useTranslations("enums")
 */
export function enumLabel(
  tEnum: TranslationFn,
  kind: "type" | "genre",
  value: string,
): string {
  const key = `${kind}.${value}`;
  return tEnum.has(key) ? tEnum(key) : value;
}

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
                .map((g) => (tEnum ? enumLabel(tEnum, "genre", g) : g))
                .join(" ")
            : unknownStr,
      },
      {
        label: getLabel("labels.type", "类型"),
        value:
          song.type && song.type.length > 0
            ? song.type
                .map((v) => (tEnum ? enumLabel(tEnum, "type", v) : v))
                .join(" ")
            : tEnum
              ? enumLabel(tEnum, "type", "原创")
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

/** 图床上封面的文件名：有封面用自己的；确定没有用占位图；还没核对过用默认图 */
export function getCoverFilename(song: Pick<Song, "id" | "hascover">): string {
  if (song.hascover === true) return `${song.id}.jpg`;
  if (song.hascover === false) return "proto.jpg";
  return "default.jpg";
}

export function getCoverUrl(song: Pick<Song, "id" | "hascover">): string {
  return `https://cover.hetu-music.com/cover/${getCoverFilename(song)}`;
}

// 获取乐谱图片 URL
export function getNmnUrl(song: Song | SongDetail): string {
  return `https://cover.hetu-music.com/nmn/${song.id}.png`;
}
