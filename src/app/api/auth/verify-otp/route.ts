import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/db/supabase-auth";
import { emailField, otpCodeField } from "@/lib/forms/account-rules";
import { authErrorResponse } from "@/lib/server/auth-errors";
import { withPublicAuth } from "@/lib/server/auth-route";

const schema = z.object({ email: emailField, otp: otpCodeField });

/**
 * 注册验证码：注册后（或未验证的账号登录时）邮件里的 6 位数字。
 * 验证成功即建立会话，用户自动登录。
 */
export const POST = withPublicAuth(
  "POST /api/auth/verify-otp",
  schema,
  async ({ email, otp }) => {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.verifyOtp({
      email,
      token: otp,
      type: "signup",
    });

    if (error) {
      return authErrorResponse("POST /api/auth/verify-otp", error, "验证失败");
    }
    return NextResponse.json({ success: true });
  },
);
