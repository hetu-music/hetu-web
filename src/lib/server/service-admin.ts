import "server-only";
import { fetchAll, getServiceClient, TABLES } from "@/lib/db/supabase-server";
import type { Song } from "@/lib/types";
import {
  type PublishStatus,
  publishStatusOf,
} from "@/lib/utils/utils-song-diff";

/**
 * 后台读正式表：拿来和暂存表比对「发布了没有、改了什么」。
 * 读原样的行，不套署名主名（getSongById 的公开路径会套），否则署名字段永远对不上。
 */
export async function getPublishedSongRaw(
  id: number,
): Promise<Record<string, unknown> | null> {
  const supabase = getServiceClient();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from(TABLES.MUSIC)
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) {
    console.error("[getPublishedSongRaw] query failed for id:", id, error);
    return null;
  }
  return data;
}

/** 暂存表里每首歌的发布状态 */
export async function getPublishStatuses(
  drafts: Song[],
): Promise<Record<number, PublishStatus>> {
  const supabase = getServiceClient();
  if (!supabase) return {};
  const published = await fetchAll<Record<string, unknown>>(
    supabase,
    TABLES.MUSIC,
    "*",
  );
  const byId = new Map(published.map((row) => [row.id as number, row]));
  return Object.fromEntries(
    drafts.map((song) => [
      song.id,
      publishStatusOf(
        song as unknown as Record<string, unknown>,
        byId.get(song.id) ?? null,
      ),
    ]),
  );
}

/** 每首歌已有的意象标注条数（没有的不出现在结果里） */
export async function getOccurrenceCountsBySong(): Promise<
  Record<number, number>
> {
  const supabase = getServiceClient();
  if (!supabase) return {};
  const rows = await fetchAll<{ song_id: number }>(
    supabase,
    TABLES.IMAGERY_OCC,
    "song_id",
  );
  const counts: Record<number, number> = {};
  for (const { song_id } of rows) counts[song_id] = (counts[song_id] ?? 0) + 1;
  return counts;
}

/** 待处理的反馈条数；普通管理员只处理歌曲纠错，与 /api/admin/requests 的口径一致 */
export async function getPendingRequestCount(
  isSuper: boolean,
): Promise<number> {
  const supabase = getServiceClient();
  if (!supabase) return 0;
  let query = supabase
    .from(TABLES.USER_REQUESTS)
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");
  if (!isSuper) query = query.eq("type", "song_feedback");
  const { count, error } = await query;
  if (error) {
    console.error("[getPendingRequestCount] query failed:", error);
    return 0;
  }
  return count ?? 0;
}
