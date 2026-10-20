import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withAuth, type AuthenticatedUser } from "@/lib/server/server-auth";
import {
  createSupabaseServerClient,
  verifyPassword,
} from "@/lib/db/supabase-auth";
import { emailField, passwordField } from "@/lib/forms/account-rules";
import { authErrorResponse } from "@/lib/server/auth-errors";
import { parseJsonBody } from "@/lib/server/auth-route";

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

    if (!user.email) {
      return NextResponse.json(
        { error: "账号没有邮箱，无法核对密码" },
        { status: 400 },
      );
    }
    if (data.email.toLowerCase() === user.email.toLowerCase()) {
      return NextResponse.json(
        { error: "新邮箱与当前邮箱相同" },
        { status: 400 },
      );
    }

    const verifyError = await verifyPassword(user.email, data.password);
    if (verifyError) {
      if (verifyError.code === "invalid_credentials") {
        return NextResponse.json({ error: "当前密码错误" }, { status: 400 });
      }
      return authErrorResponse("POST /api/auth/email", verifyError, "发送失败");
    }

    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.updateUser({ email: data.email });
    if (error) {
      return authErrorResponse("POST /api/auth/email", error, "发送失败");
    }

    return NextResponse.json({ success: true });
  },
  { requireCSRF: true },
);
