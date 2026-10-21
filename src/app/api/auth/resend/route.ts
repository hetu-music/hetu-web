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
 * 重发注册验证码。要人机验证：不然谁都能拿这个接口给别人的邮箱刷信，
 * 还会耗光 GoTrue 全站的发信额度，连带别人收不到注册邮件。
 * 找回密码的重发直接再调一次 /api/auth/recovery。
 */
export const POST = withPublicAuth(
  "POST /api/auth/resend",
  schema,
  async ({ email }) => {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.resend({ type: "signup", email });
    if (error) {
      return authErrorResponse("POST /api/auth/resend", error, "发送失败");
    }
    return NextResponse.json({ success: true });
  },
  { captcha: true },
);
