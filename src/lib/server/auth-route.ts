import { NextRequest, NextResponse } from "next/server";
import type { z } from "zod";
import {
  serverErrorResponse,
  verifyCSRFToken,
  verifyTurnstileToken,
} from "@/lib/server/server-utils";

type Parsed<T> =
  | { data: T; response?: undefined }
  | { data?: undefined; response: NextResponse };

/**
 * 读请求体并按 schema 校验。坏 JSON 与校验不过都回 400，提示取第一条。
 * 空请求体按 {} 处理：像退出登录这种可以不带参数的请求，前端不必特意写 body。
 */
export async function parseJsonBody<S extends z.ZodType>(
  request: NextRequest,
  schema: S,
): Promise<Parsed<z.infer<S>>> {
  let body: unknown = {};
  const text = await request.text();
  if (text.trim()) {
    try {
      body = JSON.parse(text);
    } catch {
      return {
        response: NextResponse.json(
          { error: "请求体格式无效" },
          { status: 400 },
        ),
      };
    }
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return {
      response: NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "参数校验失败" },
        { status: 400 },
      ),
    };
  }
  return { data: parsed.data };
}

/**
 * 未登录也能调的认证接口（登录、注册、验证码、找回密码）的公共外壳：
 * 校验 CSRF → 读请求体 → 需要时校验人机验证 → 交给 handler；handler 抛错回 500。
 * 已登录的接口用 server-auth 的 withAuth，请求体同样用 parseJsonBody 读。
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
