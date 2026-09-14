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
      .select(
        "name, display, intro, is_admin, is_super, navid_id, navid_pw, endpoint",
      )
      .eq("id", user.id)
      .maybeSingle();

    if (error) {
      return serverErrorResponse("GET /api/auth/me", error);
    }

    return NextResponse.json({
      id: user.id,
      email: user.email,
      name: data?.name ?? "未设置用户名",
      display: data?.display ?? false,
      intro: data?.intro ?? null,
      isAdmin: data?.is_admin ?? false,
      isSuper: data?.is_super ?? false,
      hasBenefits: !!data?.navid_id && !!data?.navid_pw && !!data?.endpoint,
    });
  },
);
