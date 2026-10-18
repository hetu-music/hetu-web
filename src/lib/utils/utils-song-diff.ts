import { songFields } from "@/lib/constants";
import type { SongFormFieldKey } from "@/lib/types";

type SongFields = Partial<Record<SongFormFieldKey, unknown>>;

/** 空串、空数组、null、undefined 都算「没填」，否则暂存表与正式表的写法差异会被当成改动 */
function normalize(value: unknown): unknown {
  if (value === undefined || value === null) return null;
  if (typeof value === "string") return value === "" ? null : value;
  if (Array.isArray(value)) return value.length === 0 ? null : value;
  return value;
}

/**
 * 暂存表的一首歌与正式表的同一首相比，哪些表单字段不同。
 * published 为 null（还没发布过）时返回空数组，由调用方另行判断「未发布」。
 */
export function diffSongFields(
  draft: SongFields,
  published: SongFields | null,
): SongFormFieldKey[] {
  if (!published) return [];
  return songFields
    .map((f) => f.key)
    .filter(
      (key) =>
        JSON.stringify(normalize(draft[key])) !==
        JSON.stringify(normalize(published[key])),
    );
}

export type PublishStatus = "unpublished" | "changed" | "published";

export function publishStatusOf(
  draft: SongFields,
  published: SongFields | null,
): PublishStatus {
  if (!published) return "unpublished";
  return diffSongFields(draft, published).length > 0 ? "changed" : "published";
}

export const PUBLISH_STATUS_LABEL: Record<PublishStatus, string> = {
  unpublished: "未发布",
  changed: "有未发布的改动",
  published: "已发布",
};
