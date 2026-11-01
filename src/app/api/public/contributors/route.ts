import { NextResponse } from "next/server";
import { NO_STORE_HEADERS, PUBLIC_API_CACHE } from "@/lib/server/cache-headers";
import { getServiceClient, TABLES } from "@/lib/db/supabase-server";
import { serverErrorResponse } from "@/lib/server/server-utils";

export async function GET() {
  const supabase = getServiceClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Server configuration error" },
      { status: 500, headers: NO_STORE_HEADERS },
    );
  }

  // 查询 users 表
  const { data, error } = await supabase
    .from(TABLES.USERS)
    .select("name, display, intro, sort_order")
    .eq("display", true)
    .order("sort_order", { ascending: true });

  if (error) {
    const response = serverErrorResponse("GET /api/public/contributors", error);
    response.headers.set("Cache-Control", NO_STORE_HEADERS["Cache-Control"]);
    return response;
  }

  // 「关于」里的维护团队：不用登录、内容很少变，CDN 缓存 6 小时，
  // 后台改用户、管理员改自己的资料时清（server-revalidate 的 refreshContributors）
  return NextResponse.json(
    { contributors: data || [] },
    { headers: { "Cache-Control": PUBLIC_API_CACHE } },
  );
}
