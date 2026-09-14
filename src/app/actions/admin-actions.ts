"use server";

import { locales } from "@/i18n/config";
import { getServiceClient } from "@/lib/db/supabase-server";
import { assertAdmin } from "@/lib/server/server-auth";
import {
  purgeCloudflareCache,
  purgeEdgeOneCache,
} from "@/lib/server/server-utils";
import { revalidatePath } from "next/cache";

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

    // 【第二步】同步成功，执行缓存刷新以实现实时数据更新
    //
    // 注：此处曾调用 revalidateTag("music")，但全站没有任何缓存条目打过
    // 这个标签，等于空操作。页面级失效由下面的 revalidatePath 完成。

    // Next.js 侧：只有带 locale 前缀的路由真实存在。无前缀的 /、/song/:id
    // 在 next.config 的 redirects() 里是 301，Next 没有对应的缓存条目。
    const nextPaths: string[] = [];
    for (const locale of locales) {
      nextPaths.push(`/${locale}`);
      nextPaths.push(`/${locale}/song/${id}`);
    }
    nextPaths.push("/sitemap.xml");
    nextPaths.push("/api/public/songs/lyrics-index");

    // CDN 侧：还要额外清掉无前缀的旧 URL——边缘节点会把那些 301 响应缓存下来。
    const cdnPaths = [...nextPaths, "/", `/song/${id}`];

    // 1. 刷新 Next.js 本地服务缓存
    for (const path of nextPaths) {
      revalidatePath(path);
    }

    // 2. 两家 CDN 互不依赖，并行刷新，缩短发布等待时间
    await Promise.all([
      purgeCloudflareCache(cdnPaths),
      purgeEdgeOneCache(cdnPaths),
    ]);

    return { success: true };
  } catch (err: unknown) {
    console.error("handleApprove unexpected error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "未知错误",
    };
  }
}
