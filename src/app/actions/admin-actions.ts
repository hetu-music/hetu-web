"use server";

import { createSupabaseServerClient } from "@/lib/db/supabase-auth";
import { getServiceClient } from "@/lib/db/supabase-server";
import { assertAdmin } from "@/lib/server/server-auth";
import { resyncSongTimetags } from "@/lib/server/service-imagery";
import { refreshImagery, refreshSongs } from "@/lib/server/server-revalidate";

/**
 * 发布后按新歌词重算意象时间标签。发布已经成功，这里出错只提示、不回滚；
 * 返回 null 表示没同步成功，标签可能与歌词对不上
 */
async function resyncImagery(id: number) {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.access_token) return null;
    return await resyncSongTimetags(id, session.access_token);
  } catch (err) {
    console.error("[handleApprove] 意象时间标签同步失败:", err);
    return null;
  }
}

/**
 * 后台歌曲审批同步操作 (Server Action)
 *
 * @param id 暂存表 (temp) 中对应的歌曲 ID
 */
export async function handleApprove(id: number) {
  try {
    // 验证当前用户是否为管理员
    await assertAdmin();

    const supabase = getServiceClient();
    if (!supabase) {
      throw new Error("数据库高权限客户端未初始化，请检查环境变量。");
    }

    // 【第一步】以 Service Role 高权限通知数据库执行同步，避免普通用户权限不足报错
    const { error } = await supabase.rpc("approve_music_sync", { temp_id: id });

    if (error) {
      console.error("同步失败:", error.message);
      return { success: false, error: error.message };
    }

    // 【第二步】歌词可能改了：意象标注的时间标签按正式表的新歌词重算，要在刷缓存之前
    const imagery = await resyncImagery(id);

    // 【第三步】刷新这首歌牵连的页面、接口与缓存数据；标签有变的母题页也要清
    const motifIds = imagery?.motifIds ?? [];
    const purges = await Promise.all([
      refreshSongs([id]),
      ...(motifIds.length > 0 ? [refreshImagery({ motifIds })] : []),
    ]);
    const cdnPurgeFailed = [...new Set(purges.flatMap((p) => p.failed))];

    // Server Action 拿不到响应头，没刷成功的 CDN 放进返回值，由调用方提示
    return {
      success: true,
      cdnPurgeFailed,
      imagerySyncFailed: imagery === null,
      imageryNotFound: imagery?.notFound ?? [],
    };
  } catch (err: unknown) {
    console.error("handleApprove unexpected error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "未知错误",
    };
  }
}
