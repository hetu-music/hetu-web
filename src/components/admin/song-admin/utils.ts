import { songFields } from "@/lib/constants";
import type {
  SongDetail,
  SongFieldConfig,
  SongFormFieldKey,
} from "@/lib/types";
import {
  CREATOR_FIELD_KEYS,
  MISSING_FIELD_LABEL_OVERRIDES,
  MISSING_GROUPS,
  NON_CRITICAL_FIELD_KEYS,
  type CreatorFieldKey,
  type MissingGroup,
} from "./types";

export function getInputValue(value: string | number | null | undefined) {
  return value ?? "";
}

export function hasSongId(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function isCreatorFieldKey(
  value: SongFormFieldKey,
): value is CreatorFieldKey {
  return CREATOR_FIELD_KEYS.includes(value as CreatorFieldKey);
}

export function isCriticalField(key: SongFormFieldKey): boolean {
  return !NON_CRITICAL_FIELD_KEYS.includes(key);
}

/**
 * 单个字段是否为空。
 *
 * 此前「是否完善」「缺哪些字段」「详情面板高亮」三处各写了一遍同样的判断，
 * nmn_status 的特殊规则（false 也算缺失）也重复了三遍，统一到这里。
 */
export function isFieldEmpty(
  song: SongDetail,
  field: SongFieldConfig,
): boolean {
  const value = song[field.key];

  // 乐谱字段只有明确为 true 才算已补全
  if (field.key === "nmn_status") return value !== true;

  if (value === null || value === undefined) return true;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === "string") return value.trim() === "";
  return false;
}

/** 列出所有缺失的关键字段（用于待完善标签） */
export function getMissingFields(song: SongDetail): string[] {
  return songFields
    .filter((field) => isCriticalField(field.key) && isFieldEmpty(song, field))
    .map((field) => MISSING_FIELD_LABEL_OVERRIDES[field.key] ?? field.label);
}

export function isSongIncomplete(song: SongDetail): boolean {
  return songFields.some(
    (field) => isCriticalField(field.key) && isFieldEmpty(song, field),
  );
}

/** 缺了哪几组资料，按 MISSING_GROUPS 的顺序 */
export function getMissingGroups(song: SongDetail): MissingGroup[] {
  return MISSING_GROUPS.filter((group) =>
    songFields.some(
      (field) => group.keys.includes(field.key) && isFieldEmpty(song, field),
    ),
  ).map((group) => group.key);
}

/** 还没有乐谱（只有 nmn_status 为 true 才算有） */
export function lacksScore(song: SongDetail): boolean {
  return song.nmn_status !== true;
}

/** 列表里一行写得下的缺失说明：「歌词、作词」，多了写「歌词、作词等 5 项」 */
export function summarizeMissing(labels: readonly string[], max = 2): string {
  if (labels.length <= max) return labels.join("、");
  return `${labels.slice(0, max).join("、")}等 ${labels.length} 项`;
}
