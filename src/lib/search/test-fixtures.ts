/** 搜索内核单元测试共用的小曲库。只给测试用，不进页面的包 */
import type { Song } from "@/lib/types";
import type { LyricsLinesEntry } from "./corpus";

export function song(
  id: number,
  title: string,
  extra: Partial<Song> = {},
): Song {
  return {
    id,
    title,
    album: null,
    year: null,
    genre: null,
    lyricist: null,
    composer: null,
    artist: null,
    length: null,
    updated_at: "",
    ...extra,
  };
}

export const SONGS: Song[] = [
  song(1, "倾尽天下", {
    artist: ["河图"],
    lyricist: ["Vagary"],
    album: "倾尽天下",
  }),
  song(2, "如花", { artist: ["河图"] }),
  song(3, "江南雨", { artist: ["司夏"], composer: ["李萌"] }),
  song(4, "雨碎江南", { artist: ["河图"], arranger: ["李萌"] }),
  song(5, "越人歌", { artist: ["河图"], creditAliases: ["萧忆情"] }),
  song(6, "风起天阑", { artist: ["萧忆情Alex"], album: "漱愿记" }),
  song(7, "如夢", { artist: ["河圖"] }),
];

export const LYRICS: LyricsLinesEntry[] = [
  { id: 1, lines: ["夜夜笙歌", "七重纱衣，血溅了白纱", "倾尽天下"] },
  { id: 2, lines: ["她在灯下把墨研", "如花"] },
  { id: 3, lines: ["江南烟雨", "我不知道你在哪里", "不知道"] },
  { id: 4, lines: ["雨碎江南", "天下太平", "我不知道"] },
  { id: 6, lines: ["风起天阑", "天下之大"] },
];
