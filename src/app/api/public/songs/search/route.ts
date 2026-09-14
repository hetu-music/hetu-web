import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/server/server-auth";
import { getServiceClient, TABLES } from "@/lib/db/supabase-server";
import { serverErrorResponse } from "@/lib/server/server-utils";

/**
 * GET /api/public/songs/search?q=关键词&limit=10
 * 按标题模糊搜索歌曲，仅返回 id 和 title，供前端选择器使用。
 * 需要登录才能访问。
 */
export const GET = withAuth(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() ?? "";
  const limit = Math.min(
    20,
    Math.max(1, parseInt(searchParams.get("limit") ?? "10", 10)),
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
