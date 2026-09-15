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
 */
export const NON_CRITICAL_FIELD_KEYS: readonly SongFormFieldKey[] = [
  "hascover",
  "kugolink",
  "qmlink",
  "nelink",
  "comment",
];

/** 待完善标签上与 songFields.label 不一致的显示名 */
export const MISSING_FIELD_LABEL_OVERRIDES: Partial<
  Record<SongFormFieldKey, string>
> = {
  lyrics: "歌词",
};

export type SongFormMode = "add" | "edit";

export interface OperationMessage {
  type: "success" | "error";
  text: string;
}
