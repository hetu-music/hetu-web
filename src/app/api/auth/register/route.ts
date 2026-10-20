import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/db/supabase-auth";
import { emailField, newPasswordField } from "@/lib/forms/account-rules";
import { authErrorResponse } from "@/lib/server/auth-errors";
import { withPublicAuth } from "@/lib/server/auth-route";

const schema = z.object({
  email: emailField,
  password: newPasswordField,
  turnstileToken: z.string().optional(),
});

export const POST = withPublicAuth(
  "POST /api/auth/register",
  schema,
  async ({ email, password }) => {
    const supabase = await createSupabaseServerClient();

    // 用验证码而不是确认链接：用户在页面上填邮件里的 6 位数字，不需要 emailRedirectTo。
    // 邮箱已注册且已验证时 GoTrue 也回成功、只是不发信（防账号枚举），
    // 前端在填码那一步提示「注册过的可以直接登录或找回密码」
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) {
      return authErrorResponse(
        "POST /api/auth/register",
        error,
        "注册失败，请检查填写信息",
      );
    }

    return NextResponse.json({ success: true });
  },
  { captcha: true },
);
