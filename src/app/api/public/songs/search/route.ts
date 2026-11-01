import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/server/server-auth";
import { getServiceClient, TABLES } from "@/lib/db/supabase-server";
import { serverErrorResponse } from "@/lib/server/server-utils";
import { toSimplified } from "@/lib/utils/utils-convert";

/**
 * GET /api/public/songs/search?q=关键词&limit=10
 * 按标题模糊搜索歌曲，仅返回 id 和 title，供前端选择器使用。
 * 需要登录才能访问。
 */
function toInt(raw: string | null, fallback: number): number {
  const n = parseInt(raw ?? "", 10);
  return Number.isNaN(n) ? fallback : n;
}

export const GET = withAuth(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  // 标题以简体存储，繁体输入先转简体，否则「夢」搜不到「梦」
  // 歌名没有这么长的；截断免得超长的模糊匹配串拖慢查询
  const q = toSimplified(searchParams.get("q")?.trim().slice(0, 50) ?? "");
  const limit = Math.min(
    20,
    // 不是数字时按默认的 10，不能把 NaN 传给查询
    Math.max(1, toInt(searchParams.get("limit"), 10)),
  );

  if (!q) {
    return NextResponse.json({ songs: [] });
  }

  const supabase = getServiceClient();
  if (!supabase) {
    return NextResponse.json({ error: "服务暂不可用" }, { status: 503 });
  }

  const { data, error } = await supabase
    .from(TABLES.MUSIC)
    .select("id, title")
    .ilike("title", `%${q}%`)
    .order("title", { ascending: true })
    .limit(limit);

  if (error) {
    return serverErrorResponse("GET /api/public/songs/search", error);
  }

  return NextResponse.json({ songs: data ?? [] });
});
