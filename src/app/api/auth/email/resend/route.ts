import { NextRequest, NextResponse } from "next/server";
import { withAuth, type AuthenticatedUser } from "@/lib/server/server-auth";
import { createSupabaseServerClient } from "@/lib/db/supabase-auth";
import { authErrorResponse } from "@/lib/server/auth-errors";

/**
 * 重发改邮箱的验证码。GoTrue 重发时两个码都换新、已验过的那一个也作废，
 * 所以前端重发后要回到第一个码重新填。
 */
export const POST = withAuth(
  async (_request: NextRequest, user: AuthenticatedUser) => {
    const newEmail = user.new_email as string | undefined;
    if (!newEmail) {
      return NextResponse.json(
        { error: "没有待验证的邮箱更改" },
        { status: 400 },
      );
    }

    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.resend({
      type: "email_change",
      email: newEmail,
    });
    if (error) {
      return authErrorResponse(
        "POST /api/auth/email/resend",
        error,
        "发送失败",
      );
    }
    return NextResponse.json({ success: true });
  },
  { requireCSRF: true },
);
