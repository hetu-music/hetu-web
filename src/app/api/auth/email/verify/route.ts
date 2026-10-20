import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withAuth, type AuthenticatedUser } from "@/lib/server/server-auth";
import { createSupabaseServerClient } from "@/lib/db/supabase-auth";
import { otpCodeField } from "@/lib/forms/account-rules";
import { authErrorResponse } from "@/lib/server/auth-errors";
import { parseJsonBody } from "@/lib/server/parse-body";

const schema = z.object({
  /** 这个验证码是发到哪个邮箱的：新邮箱，还是原邮箱 */
  target: z.enum(["new", "current"]),
  otp: otpCodeField,
});

/**
 * 改邮箱第二步：验证发到某个邮箱的验证码。邮箱地址由服务端按 target 取，
 * 不收前端传来的地址。
 *
 * 开了「安全改邮箱」时，第一个码验过后 GoTrue 只回一句提示、不发新会话，
 * 这时回 done: false，前端接着要另一个邮箱的码；两个都验过才回 done: true，
 * GoTrue 同时签发新会话（cookie 里的邮箱随之更新）。
 */
export const POST = withAuth(
  async (request: NextRequest, user: AuthenticatedUser) => {
    const { data, response } = await parseJsonBody(request, schema);
    if (response) return response;

    const email = data.target === "new" ? user.new_email : user.email;
    if (!user.new_email || !email) {
      return NextResponse.json(
        { error: "没有待验证的邮箱更改" },
        { status: 400 },
      );
    }

    const supabase = await createSupabaseServerClient();
    const { data: result, error } = await supabase.auth.verifyOtp({
      email,
      token: data.otp,
      type: "email_change",
    });
    if (error) {
      return authErrorResponse(
        "POST /api/auth/email/verify",
        error,
        "验证失败",
      );
    }

    return NextResponse.json({ done: result.session !== null });
  },
  { requireCSRF: true },
);
