import "server-only";
import { fetchAll, getServiceClient, TABLES } from "@/lib/db/supabase-server";
import type { Song } from "@/lib/types";
import {
  type PublishStatus,
  publishStatusOf,
  type VersionFlags,
} from "@/lib/utils/utils-song-diff";

/**
 * 后台读线上版本：拿来和工作版本比对「改了什么」。
 * 读原样的行，不套署名主名（getSongById 的公开路径会套），否则署名字段永远对不上。
 */
export async function getPublishedSongRaw(
  id: number,
): Promise<Record<string, unknown> | null> {
  const supabase = getServiceClient();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from(TABLES.PUBLISHED_SONGS)
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) {
    console.error("[getPublishedSongRaw] query failed for id:", id, error);
    return null;
  }
  return data;
}

/** 每首歌的发布状态，由 working_songs 行上的 is_live、has_draft、ever_published 得出 */
export async function getPublishStatuses(
  songs: Song[] | Promise<Song[]>,
): Promise<Record<number, PublishStatus>> {
  return Object.fromEntries(
    (await songs).map((song) => [
      song.id,
      publishStatusOf(song as Song & VersionFlags),
    ]),
  );
}

/** 每首歌已有的意象标注条数（没有的不出现在结果里） */
export async function getOccurrenceCountsBySong(): Promise<
  Record<number, number>
> {
  const supabase = getServiceClient();
  if (!supabase) return {};

  // 库里 group by，一次往返；按工作版本数（见 migrations/20261115120000_songs_versions.sql）
  const { data, error } = await supabase.rpc("imagery_occurrence_counts");
  if (!error && Array.isArray(data)) {
    return Object.fromEntries(
      (data as { song_id: number | string; n: number | string }[]).map(
        (row) => [Number(row.song_id), Number(row.n)],
      ),
    );
  }
  // 函数还没建（迁移未执行）时退回整列分页读取：一万多行要串行翻十几页，慢但结果相同
  console.warn(
    "[getOccurrenceCountsBySong] rpc unavailable, falling back to paging:",
    error?.message,
  );
  const rows = await fetchAll<{ song_id: number }>(
    supabase,
    TABLES.WORKING_SONG_IMAGERY,
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
