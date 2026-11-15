/**
 * Navidrome 映射相关的数据库读写（song_audio；has_audio 由视图按有没有映射算出，不另存）。
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

/** 线上的歌（视图）：只给发布了的歌自动匹配音频 */
const PUBLISHED_SONGS = "published_songs";
const SONG_AUDIO = "song_audio";
const PAGE_SIZE = 1000;

async function fetchAllStrict<T>(
  supabase: SupabaseClient,
  table: string,
  select: string,
  orderBy = "id",
): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from(table)
      .select(select)
      .order(orderBy)
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
      PUBLISHED_SONGS,
      "id,title,album,discnumber,track,length,has_audio",
    ),
    // 映射表的列是 song_id，取出来仍叫 id，与同步计划的类型一致
    fetchAllStrict<MappingRow>(
      supabase,
      SONG_AUDIO,
      "id:song_id,navid_id,suffix,duration",
      "song_id",
    ),
  ]);
  return { songs, mappings };
}

export type ApplyResult = {
  upserted: number;
  deleted: number;
  /** 只更新了格式、时长的映射数 */
  mediaUpdated: number;
  /** 有没有音频发生变化的歌曲 ID，调用方据此刷新页面缓存 */
  hasAudioChanged: number[];
};

export async function applySyncPlan(
  supabase: SupabaseClient,
  plan: SyncPlan,
): Promise<ApplyResult> {
  if (plan.upserts.length > 0) {
    const { error } = await supabase.from(SONG_AUDIO).upsert(
      plan.upserts.map((u) => ({
        song_id: u.song.id,
        navid_id: u.nav.id,
        ...mediaOf(u.nav),
      })),
      { onConflict: "song_id" },
    );
    if (error) throw error;
  }
  if (plan.mediaUpdates.length > 0) {
    const { error } = await supabase.from(SONG_AUDIO).upsert(
      plan.mediaUpdates.map(({ id, ...media }) => ({ song_id: id, ...media })),
      { onConflict: "song_id" },
    );
    if (error) throw error;
  }
  if (plan.deletes.length > 0) {
    const { error } = await supabase
      .from(SONG_AUDIO)
      .delete()
      .in(
        "song_id",
        plan.deletes.map((d) => d.id),
      );
    if (error) throw error;
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
 * 格式与时长一并写入；has_audio 由视图按映射算出。
 * 一个曲目只能关联一首歌，冲突时抛 MappingConflictError。
 */
export async function setSongMapping(
  supabase: SupabaseClient,
  songId: number,
  nav: NavSong | null,
): Promise<void> {
  if (nav === null) {
    const { error } = await supabase
      .from(SONG_AUDIO)
      .delete()
      .eq("song_id", songId);
    if (error) throw error;
    return;
  }

  const { data: owner, error: ownerError } = await supabase
    .from(SONG_AUDIO)
    .select("song_id")
    .eq("navid_id", nav.id)
    .neq("song_id", songId)
    .limit(1)
    .maybeSingle();
  if (ownerError) throw ownerError;
  if (owner) throw new MappingConflictError(owner.song_id as number);

  const { error } = await supabase
    .from(SONG_AUDIO)
    .upsert(
      { song_id: songId, navid_id: nav.id, ...mediaOf(nav) },
      { onConflict: "song_id" },
    );
  if (error) throw error;
}
