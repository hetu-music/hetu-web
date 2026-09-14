import { NextResponse } from "next/server";
import { getServiceClient, TABLES } from "@/lib/db/supabase-server";
import { serverErrorResponse } from "@/lib/server/server-utils";

export async function GET() {
  const supabase = getServiceClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Server configuration error" },
      { status: 500 },
    );
  }

  // 查询 users 表
  const { data, error } = await supabase
    .from(TABLES.USERS)
    .select("name, display, intro, sort_order")
    .eq("display", true)
    .order("sort_order", { ascending: true });

  if (error) {
    return serverErrorResponse("GET /api/public/contributors", error);
  }

  // 直接返回完整信息
  return NextResponse.json({ contributors: data || [] });
}
