import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/db/supabase-auth";
import { emailField } from "@/lib/forms/account-rules";
import { authErrorResponse } from "@/lib/server/auth-errors";
import { withPublicAuth } from "@/lib/server/auth-route";

const schema = z.object({
  email: emailField,
  turnstileToken: z.string().optional(),
});

/**
 * 找回密码第一步：向邮箱发 6 位验证码（首次与重发都走这里）。
 * 邮箱没注册时 GoTrue 也回成功，不让人借此探出哪些邮箱注册过。
 * 邮件模板「Reset Password」要写 {{ .Token }}，默认模板只有链接。
 */
export const POST = withPublicAuth(
  "POST /api/auth/recovery",
  schema,
  async ({ email }) => {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) {
      return authErrorResponse("POST /api/auth/recovery", error, "发送失败");
    }
    return NextResponse.json({ success: true });
  },
  { captcha: true },
);
