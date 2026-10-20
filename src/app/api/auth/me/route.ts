import { NextRequest, NextResponse } from "next/server";
import { withAuth, type AuthenticatedUser } from "@/lib/server/server-auth";
import { createSupabaseServerClient } from "@/lib/db/supabase-auth";
import { TABLES } from "@/lib/db/supabase-server";
import { serverErrorResponse } from "@/lib/server/server-utils";

export const GET = withAuth(
  async (_request: NextRequest, user: AuthenticatedUser) => {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from(TABLES.USERS)
      .select("name, display, intro, is_admin, is_super, can_stream")
      .eq("id", user.id)
      .maybeSingle();

    if (error) {
      return serverErrorResponse("GET /api/auth/me", error);
    }

    return NextResponse.json({
      id: user.id,
      email: user.email,
      // 改邮箱验证到一半（页面刷新、关掉又回来）时，个人中心据此接着验证
      pendingEmail: (user.new_email as string | undefined) || null,
      name: data?.name ?? "未设置用户名",
      display: data?.display ?? false,
      intro: data?.intro ?? null,
      isAdmin: data?.is_admin ?? false,
      isSuper: data?.is_super ?? false,
      hasBenefits: data?.can_stream === true,
    });
  },
);
