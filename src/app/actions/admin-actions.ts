"use server";

import { getServiceClient } from "@/lib/db/supabase-server";
import { assertAdmin } from "@/lib/server/server-auth";
import { refreshSongs } from "@/lib/server/server-revalidate";

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

    // 【第二步】同步成功，刷新这首歌牵连的页面、接口与缓存数据
    const purge = await refreshSongs([id]);

    // Server Action 拿不到响应头，没刷成功的 CDN 放进返回值，由调用方提示
    return { success: true, cdnPurgeFailed: purge.failed };
  } catch (err: unknown) {
    console.error("handleApprove unexpected error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "未知错误",
    };
  }
}
