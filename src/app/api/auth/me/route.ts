import { NextRequest, NextResponse } from "next/server";
import { withAuth, type AuthenticatedUser } from "@/lib/server/server-auth";
import { createSupabaseServerClient } from "@/lib/db/supabase-auth";
import { TABLES } from "@/lib/db/supabase-server";
import { serverErrorResponse } from "@/lib/server/server-utils";
import { isHumanAdmin, isStaff, isSuperRole, roleOf } from "@/lib/auth/roles";

export const GET = withAuth(
  async (_request: NextRequest, user: AuthenticatedUser) => {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from(TABLES.USERS)
      .select("name, display, intro, role, can_stream")
      .eq("id", user.id)
      .maybeSingle();

    if (error) {
      return serverErrorResponse("GET /api/auth/me", error);
    }

    return NextResponse.json({
      id: user.id,
      email: user.email,
      // 改邮箱验证到一半（页面刷新、关掉又回来）时，个人中心据此接着验证
      pendingEmail: user.new_email || null,
      name: data?.name ?? "未设置用户名",
      display: data?.display ?? false,
      intro: data?.intro ?? null,
      // 角色以库里为准：刚改了角色、令牌还没刷新时，界面先跟上
      role: roleOf(data),
      isAdmin: isStaff(roleOf(data)),
      canPublish: isHumanAdmin(roleOf(data)),
      isSuper: isSuperRole(roleOf(data)),
      hasBenefits: data?.can_stream === true,
    });
  },
);
