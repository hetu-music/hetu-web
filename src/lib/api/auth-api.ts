"use client";

import { getCsrfToken, resetCsrfToken } from "@/lib/api/csrf";

/**
 * 登录、注册、个人中心各表单调 /api/auth/* 的统一入口：带上 CSRF 令牌，
 * 把响应收成 { ok, data } 或 { ok: false, error, code }。
 *
 * error 是服务端给的中文提示；网络断了或响应不是 JSON 时为空，由调用方换成
 * 自己的文案（各表单的失败文案不一样）。code 是 GoTrue 的错误码，用来分辨走哪条路。
 */
export type AuthApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error?: string; code?: string; status: number };

export async function postAuth<T = { success: true }>(
  path: string,
  body?: unknown,
): Promise<AuthApiResult<T>> {
  try {
    const csrfToken = await getCsrfToken();
    const res = await fetch(path, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-csrf-token": csrfToken,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) return { ok: true, data: data as T };

    // cookie 里的令牌过期或被清掉了：丢掉缓存，下次重新取
    if (res.status === 403 && data.error === "Invalid CSRF token") {
      resetCsrfToken();
    }
    return {
      ok: false,
      error: typeof data.error === "string" ? data.error : undefined,
      code: typeof data.code === "string" ? data.code : undefined,
      status: res.status,
    };
  } catch {
    return { ok: false, status: 0 };
  }
}
