import type { SongFormFieldKey } from "@/lib/types";

/** 表单里以「数组 + 可增删行」形式编辑的创作者类字段 */
export const CREATOR_FIELD_KEYS = [
  "lyricist",
  "composer",
  "arranger",
  "artist",
  "albumartist",
] as const satisfies readonly SongFormFieldKey[];

export type CreatorFieldKey = (typeof CREATOR_FIELD_KEYS)[number];

/**
 * 判断「资料是否完善」时不计入的字段。
 * 这几项缺失属正常情况，不应把歌曲标记为待完善。
 * 乐谱是要另找来上传的素材，不是漏填的资料：曾经算在里面，
 * 结果 265 首待完善里有 220 首只缺乐谱，真缺资料的反而看不出来。另见 lacksScore。
 */
export const NON_CRITICAL_FIELD_KEYS: readonly SongFormFieldKey[] = [
  "hascover",
  "kugolink",
  "qmlink",
  "nelink",
  "comment",
  "dispute_note",
  "lyrics_start",
  "nmn_status",
];

export type MissingGroup = "lyrics" | "credits" | "basic";

/**
 * 待完善按资料分组：歌词影响正文、意象与寻曲测验，最要紧，单列一组。
 * 其余关键字段都归「基本」。顺序即显示顺序。
 */
export const MISSING_GROUPS: readonly {
  key: MissingGroup;
  label: string;
  keys: readonly SongFormFieldKey[];
}[] = [
  { key: "lyrics", label: "歌词", keys: ["lyrics"] },
  { key: "credits", label: "署名", keys: CREATOR_FIELD_KEYS },
  {
    key: "basic",
    label: "基本",
    keys: [
      "title",
      "album",
      "date",
      "length",
      "type",
      "genre",
      "track",
      "tracktotal",
      "discnumber",
      "disctotal",
    ],
  },
];

export type PlatformLinkKey = "nelink" | "kugolink" | "qmlink";

/**
 * 音乐平台链接：不算待完善（有的歌确实不在某个平台上），单独统计「链接不全」。
 * 顺序即显示顺序，与资料表单里「链接」一段一致。
 */
export const PLATFORM_LINKS: readonly {
  key: PlatformLinkKey;
  label: string;
}[] = [
  { key: "nelink", label: "网易云" },
  { key: "kugolink", label: "酷狗" },
  { key: "qmlink", label: "QQ音乐" },
];

/** 待完善标签上与 songFields.label 不一致的显示名 */
export const MISSING_FIELD_LABEL_OVERRIDES: Partial<
  Record<SongFormFieldKey, string>
> = {
  lyrics: "歌词",
};
