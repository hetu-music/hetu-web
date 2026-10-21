import { NextRequest, NextResponse } from "next/server";
import type { z } from "zod";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { verifyPassword } from "@/lib/db/supabase-auth";
import { authErrorResponse } from "@/lib/server/auth-errors";
import {
  serverErrorResponse,
  verifyCSRFToken,
  verifyTurnstileToken,
} from "@/lib/server/server-utils";
import { parseJsonBody } from "@/lib/server/parse-body";

/**
 * 未登录也能调的认证接口（登录、注册、验证码、找回密码）的公共外壳：
 * 校验 CSRF → 读请求体 → 需要时校验人机验证 → 交给 handler；handler 抛错回 500。
 * 已登录的接口用 server-auth 的 withAuth，请求体同样用 server-utils 的 parseJsonBody 读。
 *
 * 人机验证放在字段校验之后：令牌只能用一次，字段不合法时不该先把它耗掉。
 */
export function withPublicAuth<S extends z.ZodType>(
  scope: string,
  schema: S,
  handler: (body: z.infer<S>, request: NextRequest) => Promise<NextResponse>,
  options: { captcha?: boolean } = {},
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    try {
      if (!(await verifyCSRFToken(request))) {
        return NextResponse.json(
          { error: "Invalid CSRF token" },
          { status: 403 },
        );
      }

      const { data, response } = await parseJsonBody(request, schema);
      if (response) return response;

      if (options.captcha) {
        const token = (data as { turnstileToken?: unknown }).turnstileToken;
        const result = await verifyTurnstileToken(
          typeof token === "string" ? token : undefined,
        );
        if (!result.success) {
          return NextResponse.json(
            { error: result.error || "人机验证失败" },
            { status: 403 },
          );
        }
      }

      return await handler(data, request);
    } catch (error) {
      return serverErrorResponse(scope, error);
    }
  };
}

/**
 * 改邮箱前核对当前密码（改密码由 GoTrue 核对，见 change-password）。通过返回 null，否则返回要回给前端的响应。
 * 密码不对单独说「当前密码错误」；被限流等别的原因如实转告，不冒充密码错误。
 */
export async function checkCurrentPassword(
  user: Pick<User, "email">,
  password: string,
  scope: string,
): Promise<NextResponse | null> {
  if (!user.email) {
    return NextResponse.json(
      { error: "账号没有邮箱，无法核对密码" },
      { status: 400 },
    );
  }
  const error = await verifyPassword(user.email, password);
  if (!error) return null;
  if (error.code === "invalid_credentials") {
    return NextResponse.json({ error: "当前密码错误" }, { status: 400 });
  }
  return authErrorResponse(scope, error, "核对密码失败");
}

/**
 * 改密码、找回密码成功后顺带退出其他设备。主操作已经成功，这一步失败只记日志，
 * 不把整个操作报成失败。
 */
export async function signOutOtherSessions(
  supabase: SupabaseClient,
  scope: string,
): Promise<void> {
  const { error } = await supabase.auth.signOut({ scope: "others" });
  if (error) console.error(`[${scope}] sign out others`, error);
}
