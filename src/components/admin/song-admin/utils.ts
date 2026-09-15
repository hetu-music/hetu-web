import { songFields } from "@/lib/constants";
import type {
  SongDetail,
  SongFieldConfig,
  SongFormFieldKey,
} from "@/lib/types";
import {
  CREATOR_FIELD_KEYS,
  MISSING_FIELD_LABEL_OVERRIDES,
  NON_CRITICAL_FIELD_KEYS,
  type CreatorFieldKey,
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
