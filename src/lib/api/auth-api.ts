"use client";

import { sendRequest } from "@/lib/api/request";

/**
 * 登录、注册、个人中心各表单调 /api/auth/* 的入口：不抛错，
 * 把结果收成 { ok, data } 或 { ok: false, error, code }，表单按 code 分辨走哪条路
 * （如 email_not_confirmed 转去填验证码），比 try/catch 一个 ApiError 顺手。
 *
 * error 是服务端给的中文提示；网络断了或响应不是 JSON 时为空，由调用方换成
 * 自己的文案（各表单的失败文案不一样）。status 为 0 表示请求没发出去。
 */
export type AuthApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error?: string; code?: string; status: number };

export async function postAuth<T = { success: true }>(
  path: string,
  body?: unknown,
): Promise<AuthApiResult<T>> {
  try {
    const { ok, status, data } = await sendRequest(path, {
      method: "POST",
      body,
      cache: "no-store",
    });
    if (ok) return { ok: true, data: data as T };
    return {
      ok: false,
      error: typeof data.error === "string" ? data.error : undefined,
      code: typeof data.code === "string" ? data.code : undefined,
      status,
    };
  } catch {
    return { ok: false, status: 0 };
  }
}
