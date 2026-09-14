import { NextResponse } from "next/server";
import {
  getCSRFCookie,
  setCSRFCookie,
  generateCSRFToken,
} from "@/lib/server/server-utils";

/**
 * 返回当前会话的 CSRF token。
 *
 * cookie 中已有有效 token 时直接复用，不重新签发——每次调用都轮换会让
 * 先前取过 token 的组件持有的副本失效（cookie 已是新值），后续写操作
 * 全部 403。token 随会话 cookie 生命周期存在，双提交模式下无需轮换。
 */
export async function GET() {
  const existing = await getCSRFCookie();

  if (typeof existing === "string" && existing.trim().length > 0) {
    return NextResponse.json({ csrfToken: existing });
  }

  const token = generateCSRFToken();
  await setCSRFCookie(token);
  return NextResponse.json({ csrfToken: token });
}
