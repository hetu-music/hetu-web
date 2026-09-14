import { NextRequest, NextResponse } from "next/server";
import { withAuth, type AuthenticatedUser } from "@/lib/server/server-auth";
import { createSupabaseServerClient } from "@/lib/db/supabase-auth";
import { TABLES } from "@/lib/db/supabase-server";
import { serverErrorResponse } from "@/lib/server/server-utils";

export const GET = withAuth(
  async (_request: NextRequest, user: AuthenticatedUser) => {
    try {
      const supabase = await createSupabaseServerClient();

      // 查询 public.users 表的 name、display 和 intro 字段
      const { data, error } = await supabase
        .from(TABLES.USERS)
        .select("name, display, intro")
        .eq("id", user.id)
        .maybeSingle();

      if (error) {
        return serverErrorResponse("GET /api/auth/account", error);
      }

      return NextResponse.json({
        displayName: data?.name || "",
        display: data?.display ?? false,
        intro: data?.intro ?? null,
      });
    } catch {
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 },
      );
    }
  },
);

export const POST = withAuth(
  async (request: NextRequest, user: AuthenticatedUser) => {
    // 解析请求体
    const { displayName, display, intro } = await request.json();
    if (
      !displayName ||
      typeof displayName !== "string" ||
      displayName.length < 2
    ) {
      return NextResponse.json(
        { error: "用户名不能为空且不少于2个字符" },
        { status: 400 },
      );
    }

    try {
      // 初始化 Supabase 客户端
      const supabase = await createSupabaseServerClient();

      if (!user.id) {
        return NextResponse.json(
          { error: "用户不存在，无法更新用户名" },
          { status: 400 },
        );
      }

      // 更新 public.users 表的 name、display 和 intro 字段
      const updateObj: {
        name: string;
        display?: boolean;
        intro?: string | null;
      } = { name: displayName };
      if (typeof display === "boolean") updateObj.display = display;
      if (typeof intro === "string" || intro === null) updateObj.intro = intro;
      const { error: updateError } = await supabase
        .from(TABLES.USERS)
        .update(updateObj)
        .eq("id", user.id);
      if (updateError) {
        return NextResponse.json(
          { error: updateError.message || "更新失败" },
          { status: 400 },
        );
      }

      return NextResponse.json({ success: true });
    } catch {
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 },
      );
    }
  },
  { requireCSRF: true },
);
