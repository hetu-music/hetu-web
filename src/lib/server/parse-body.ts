import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

// schema 里没写提示的规则（如 .max(100)、类型不符）用 zod 自带的中文文案，
// 不把「Too big: expected string to have <=100 characters」回给前端
z.config(z.locales.zhCN());

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
