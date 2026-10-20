import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withAuth, type AuthenticatedUser } from "@/lib/server/server-auth";
import { createSupabaseServerClient } from "@/lib/db/supabase-auth";
import { emailField, passwordField } from "@/lib/forms/account-rules";
import { authErrorResponse } from "@/lib/server/auth-errors";
import { checkCurrentPassword } from "@/lib/server/auth-route";
import { parseJsonBody } from "@/lib/server/server-utils";

const SCOPE = "POST /api/auth/email";

const schema = z.object({ email: emailField, password: passwordField });

/**
 * 改邮箱第一步：核对当前密码，再让 GoTrue 发验证码。
 *
 * 要密码是防会话被盗：拿到会话的人能把邮箱换成自己的，再用找回密码接管账号。
 * 开了「安全改邮箱」（GoTrue 默认开）时，新旧两个邮箱各收到一个验证码，
 * 两个都验过才生效，见 ./verify。邮件模板「Change Email Address」要写 {{ .Token }}。
 */
export const POST = withAuth(
  async (request: NextRequest, user: AuthenticatedUser) => {
    const { data, response } = await parseJsonBody(request, schema);
    if (response) return response;

    if (data.email.toLowerCase() === user.email?.toLowerCase()) {
      return NextResponse.json(
        { error: "新邮箱与当前邮箱相同" },
        { status: 400 },
      );
    }

    const rejected = await checkCurrentPassword(user, data.password, SCOPE);
    if (rejected) return rejected;

    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.updateUser({ email: data.email });
    if (error) return authErrorResponse(SCOPE, error, "发送失败");

    return NextResponse.json({ success: true });
  },
  { requireCSRF: true },
);
