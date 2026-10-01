/**
 * Navidrome 映射相关的数据库读写（navid_song 映射表与 music.has_audio）。
 * 接收外部传入的 Supabase 客户端，不依赖 Next 运行时，
 * scripts/navidrome-sync.ts 与后台 API 共用。
 *
 * 与 supabase-server 的 fetchAll 不同，这里任何一页读取失败都直接抛错：
 * 残缺的数据会让同步计划把大量映射误判为缺失或失效。
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  mediaOf,
  type DbSong,
  type MappingRow,
  type NavSong,
  type SyncPlan,
} from "./sync";

const MUSIC = "music";
const NAVID_SONG = "navid_song";
const PAGE_SIZE = 1000;

async function fetchAllStrict<T>(
  supabase: SupabaseClient,
  table: string,
  select: string,
): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from(table)
      .select(select)
      .order("id")
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    out.push(...(data as T[]));
    if (data.length < PAGE_SIZE) return out;
  }
}

export async function loadSyncState(
  supabase: SupabaseClient,
): Promise<{ songs: DbSong[]; mappings: MappingRow[] }> {
  const [songs, mappings] = await Promise.all([
    fetchAllStrict<DbSong>(
      supabase,
      MUSIC,
      "id,title,album,discnumber,track,length,has_audio",
    ),
    fetchAllStrict<MappingRow>(
      supabase,
      NAVID_SONG,
      "id,navid_id,suffix,duration",
    ),
  ]);
  return { songs, mappings };
}

export type ApplyResult = {
  upserted: number;
  deleted: number;
  /** 只更新了格式、时长的映射数 */
  mediaUpdated: number;
  /** has_audio 发生变化的歌曲 ID，调用方据此刷新页面缓存 */
  hasAudioChanged: number[];
};

async function setHasAudio(
  supabase: SupabaseClient,
  ids: number[],
  value: boolean,
) {
  if (ids.length === 0) return;
  const { error } = await supabase
    .from(MUSIC)
    .update({ has_audio: value })
    .in("id", ids);
  if (error) throw error;
}

export async function applySyncPlan(
  supabase: SupabaseClient,
  plan: SyncPlan,
): Promise<ApplyResult> {
  if (plan.upserts.length > 0) {
    const { error } = await supabase.from(NAVID_SONG).upsert(
      plan.upserts.map((u) => ({
        id: u.song.id,
        navid_id: u.nav.id,
        ...mediaOf(u.nav),
      })),
      { onConflict: "id" },
    );
    if (error) throw error;
  }
  if (plan.mediaUpdates.length > 0) {
    const { error } = await supabase
      .from(NAVID_SONG)
      .upsert(plan.mediaUpdates, { onConflict: "id" });
    if (error) throw error;
  }
  if (plan.deletes.length > 0) {
    const { error } = await supabase
      .from(NAVID_SONG)
      .delete()
      .in(
        "id",
        plan.deletes.map((d) => d.id),
      );
    if (error) throw error;
  }
  for (const value of [true, false]) {
    await setHasAudio(
      supabase,
      plan.hasAudioChanges
        .filter((c) => c.next === value)
        .map((c) => c.song.id),
      value,
    );
  }
  return {
    upserted: plan.upserts.length,
    deleted: plan.deletes.length,
    mediaUpdated: plan.mediaUpdates.length,
    hasAudioChanged: plan.hasAudioChanges.map((c) => c.song.id),
  };
}

export class MappingConflictError extends Error {
  constructor(readonly songId: number) {
    super(`该曲目已关联到歌曲 #${songId}`);
    this.name = "MappingConflictError";
  }
}

/**
 * 手动设置单首歌的映射；nav 为 null 表示解除关联。
 * has_audio 随映射一起更新，格式与时长一并写入。
 * 一个曲目只能关联一首歌，冲突时抛 MappingConflictError。
 */
export async function setSongMapping(
  supabase: SupabaseClient,
  songId: number,
  nav: NavSong | null,
): Promise<void> {
  if (nav === null) {
    const { error } = await supabase.from(NAVID_SONG).delete().eq("id", songId);
    if (error) throw error;
    await setHasAudio(supabase, [songId], false);
    return;
  }

  const { data: owner, error: ownerError } = await supabase
    .from(NAVID_SONG)
    .select("id")
    .eq("navid_id", nav.id)
    .neq("id", songId)
    .limit(1)
    .maybeSingle();
  if (ownerError) throw ownerError;
  if (owner) throw new MappingConflictError(owner.id as number);

  const { error } = await supabase
    .from(NAVID_SONG)
    .upsert(
      { id: songId, navid_id: nav.id, ...mediaOf(nav) },
      { onConflict: "id" },
    );
  if (error) throw error;
  await setHasAudio(supabase, [songId], true);
}
