import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/db/supabase-auth";
import { emailField, passwordField } from "@/lib/forms/account-rules";
import { authErrorResponse } from "@/lib/server/auth-errors";
import { withPublicAuth } from "@/lib/server/auth-route";

const schema = z.object({
  email: emailField,
  password: passwordField,
  turnstileToken: z.string().optional(),
});

export const POST = withPublicAuth(
  "POST /api/auth/login",
  schema,
  async ({ email, password }) => {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (!error) return NextResponse.json({ success: true });

    // 注册后没填验证码就走了的账号：GoTrue 先核对密码、再查是否已验证，
    // 走到这里说明密码是对的，告诉用户实情不会泄露账号是否存在。
    // 顺手重发一封验证码，前端直接转到填码那一步；重发被限流也照样转过去，
    // 上一封多半还在有效期内
    if (error.code === "email_not_confirmed") {
      const { error: resendError } = await supabase.auth.resend({
        type: "signup",
        email,
      });
      if (resendError) {
        console.error("[POST /api/auth/login] resend", resendError.message);
      }
      return NextResponse.json(
        { error: "邮箱尚未验证", code: "email_not_confirmed" },
        { status: 403 },
      );
    }

    // 不区分「邮箱不存在」与「密码错误」，避免账号枚举
    return authErrorResponse(
      "POST /api/auth/login",
      error,
      "邮箱或密码错误",
      401,
    );
  },
  { captcha: true },
);
