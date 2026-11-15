import "server-only";
import { getUserClient, TABLES } from "@/lib/db/supabase-server";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * 歌曲版本（docs/DATABASE.md 第三节）。
 *
 * 一首歌有至多一个草稿和若干冻结的版本，线上用 songs.live_version_id 指的那个。
 * 资料与编校数据（意象、基调、校记与补遗）都挂在版本上：后台写之前先 ensureDraft，
 * 写在草稿上，发布时一起上线。草稿只在真有写入时才开，打开看看不开。
 *
 * 编校数据行的 id 在各版本间不变（开草稿时连 id 一起复制），所以后台拿着的 id
 * 在开草稿前后都能用：按 (草稿的 version_id, id) 定位。
 */

export type Db = SupabaseClient;

/** 带状态码的错误，路由据此回 4xx */
export class SongVersionError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

export function userDb(accessToken: string): Db {
  const db = getUserClient(accessToken);
  if (!db) throw new Error("Supabase client unavailable");
  return db;
}

/** 数据库函数抛出的错误转成带状态码的：P0002 不存在，P0001 前置条件不满足，42501 没有权限 */
function fromRpcError(error: { code?: string; message: string }): Error {
  if (error.code === "P0002") return new SongVersionError(error.message, 404);
  if (error.code === "P0001") return new SongVersionError(error.message, 409);
  if (error.code === "42501") return new SongVersionError(error.message, 403);
  return new Error(error.message);
}

/** 这首歌的草稿；没有就从最新冻结版本复制一份（资料与全部编校数据）。返回草稿的 version id */
export async function ensureDraft(db: Db, songId: number): Promise<number> {
  const { data, error } = await db.rpc("ensure_draft", { p_song_id: songId });
  if (error) throw fromRpcError(error);
  return Number(data);
}

/** 工作版本（有草稿用草稿，否则用最新冻结版本）的 id；歌不存在返回 null */
export async function workingVersionId(
  db: Db,
  songId: number,
): Promise<number | null> {
  const { data, error } = await db
    .from(TABLES.WORKING_SONGS)
    .select("version_id")
    .eq("id", songId)
    .maybeSingle();
  if (error) throw error;
  return (data as { version_id: number } | null)?.version_id ?? null;
}

/** 线上版本的 id；歌不在线上返回 null */
export async function liveVersionId(
  db: Db,
  songId: number,
): Promise<number | null> {
  const { data, error } = await db
    .from(TABLES.PUBLISHED_SONGS)
    .select("version_id")
    .eq("id", songId)
    .maybeSingle();
  if (error) throw error;
  return (data as { version_id: number } | null)?.version_id ?? null;
}

/** 新建一首歌及它的草稿，返回歌的 id。fields 的键名同 song_versions 的列 */
export async function createSongRecord(
  db: Db,
  fields: Record<string, unknown>,
): Promise<number> {
  const { data, error } = await db.rpc("create_song", { p_fields: fields });
  if (error) throw fromRpcError(error);
  return Number(data);
}

/** 发布：草稿冻结并上线；没有草稿而已下架时，重新上线最新的冻结版本。只有 admin、super 能调 */
export async function publishSong(db: Db, songId: number): Promise<number> {
  const { data, error } = await db.rpc("publish_song", { p_song_id: songId });
  if (error) throw fromRpcError(error);
  return Number(data);
}

/** 放弃草稿，回到最新的冻结版本。从没发布过的歌不能放弃，要删就删歌 */
export async function discardDraft(db: Db, songId: number): Promise<void> {
  const { error } = await db.rpc("discard_draft", { p_song_id: songId });
  if (error) throw fromRpcError(error);
}

/** 下架（只有 super）：不在线上，版本、草稿、读者数据都保留 */
export async function unpublishSong(db: Db, songId: number): Promise<void> {
  const { error } = await db.rpc("unpublish_song", { p_song_id: songId });
  if (error) throw fromRpcError(error);
}

/** 删歌（只有 super）：在线的歌要先下架 */
export async function deleteSong(db: Db, songId: number): Promise<void> {
  const { error } = await db.rpc("delete_song", { p_song_id: songId });
  if (error) throw fromRpcError(error);
}

/**
 * 线上版本的标注算进哪些母题（含「同时算进」），发布、下架时据此刷新母题页。
 * 只对线上版本有意义：读的是 published_song_imagery，调用时这个版本得还在线上
 */
export async function motifIdsOfVersion(
  db: Db,
  versionId: number | null,
): Promise<number[]> {
  if (versionId === null) return [];
  const { data, error } = await db
    .from(TABLES.PUBLISHED_SONG_IMAGERY)
    .select("motif_id,part_motif_ids")
    .eq("version_id", versionId);
  if (error) throw error;
  return [
    ...new Set(
      (
        (data ?? []) as { motif_id: number; part_motif_ids: number[] | null }[]
      ).flatMap((r) => [r.motif_id, ...(r.part_motif_ids ?? [])]),
    ),
  ];
}
