import { songFields } from "@/lib/constants";
import type { SongFormFieldKey } from "@/lib/types";

type SongFields = Partial<Record<SongFormFieldKey, unknown>>;

/** 空串、空数组、null、undefined 都算「没填」，否则两个版本的写法差异会被当成改动 */
function normalize(value: unknown): unknown {
  if (value === undefined || value === null) return null;
  if (typeof value === "string") return value === "" ? null : value;
  if (Array.isArray(value)) return value.length === 0 ? null : value;
  return value;
}

/**
 * 工作版本与线上版本相比，哪些表单字段不同。
 * published 为 null（不在线上）时返回空数组，由调用方另行判断状态。
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

/**
 * unpublished 从没发布过；published 在线、没有草稿；changed 在线、有草稿；withdrawn 下架了。
 * 「有草稿」包括只改了意象、基调、校勘的：资料字段一样也算有未发布的改动。
 */
export type PublishStatus = "unpublished" | "changed" | "published" | "withdrawn";

/** working_songs 上的三个状态列 */
export type VersionFlags = {
  is_live?: boolean | null;
  has_draft?: boolean | null;
  ever_published?: boolean | null;
};

export function publishStatusOf(song: VersionFlags): PublishStatus {
  if (song.is_live) return song.has_draft ? "changed" : "published";
  return song.ever_published ? "withdrawn" : "unpublished";
}

/** 等着发布的：从没发布过的，和线上有草稿的。下架的不算 */
export function isPendingPublish(status: PublishStatus): boolean {
  return status === "unpublished" || status === "changed";
}

export const PUBLISH_STATUS_LABEL: Record<PublishStatus, string> = {
  unpublished: "未发布",
  changed: "有未发布的改动",
  published: "已发布",
  withdrawn: "已下架",
};
