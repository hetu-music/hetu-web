"use client";

import { addToast } from "@/components/ui/toast";
import { getCsrfToken, resetCsrfToken } from "@/lib/api/csrf";
import { CDN_PURGE_FAILED_HEADER, cdnPurgeWarning } from "@/lib/cdn-purge";

/**
 * 前端调站内接口的唯一底层：拼 JSON 请求体与 CSRF 请求头、读 JSON 响应。
 * 以前 client-api、收藏、批注、登录注册各自手写一遍 fetch + 请求头 + 读错误，
 * 有的读错误前不判断响应是不是 JSON，有的 CSRF 失效后不丢缓存。
 *
 * CSRF 令牌由这里从全站缓存取（lib/api/csrf），调用方不用拿着令牌到处传。
 * 服务端判定令牌失效时丢掉缓存，下次重新取。
 */
export interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  /** FormData 原样发出（上传文件），其余会被 JSON.stringify；不传就不带请求体 */
  body?: unknown;
  /**
   * 带不带 CSRF 令牌。默认写操作带、GET 不带；
   * 少数会替服务端去调外部服务的 GET（auto-complete、check-file）也校验，传 true
   */
  csrf?: boolean;
  cache?: RequestCache;
}

export interface RawResponse {
  ok: boolean;
  status: number;
  /** 响应不是 JSON（或为空）时为 {} */
  data: Record<string, unknown>;
}

export async function sendRequest(
  path: string,
  { method = "GET", body, csrf = method !== "GET", cache }: RequestOptions = {},
): Promise<RawResponse> {
  const headers: Record<string, string> = {};
  // FormData 的 Content-Type 要由浏览器带上 boundary，不能自己写
  const isForm = body instanceof FormData;
  if (body !== undefined && !isForm) {
    headers["Content-Type"] = "application/json";
  }
  if (csrf) headers["x-csrf-token"] = await getCsrfToken();

  const res = await fetch(path, {
    method,
    headers,
    body: isForm ? body : body === undefined ? undefined : JSON.stringify(body),
    cache,
  });
  const data = await res.json().catch(() => ({}));

  if (res.status === 403 && data?.error === "Invalid CSRF token") {
    resetCsrfToken();
  }
  // 后台写接口保存成功、但有 CDN 没刷新成功：在这里统一提示，调用方不用各自处理
  const purgeFailed = res.headers.get(CDN_PURGE_FAILED_HEADER);
  if (res.ok && purgeFailed) {
    addToast("error", cdnPurgeWarning(purgeFailed.split(",")));
  }
  return { ok: res.ok, status: res.status, data: data ?? {} };
}

/** 请求失败：message 已经是给用户看的话 */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * 发请求，成功返回响应体，失败抛 ApiError。
 *
 * 失败时用哪句话：默认用 fallback。serverMessage 为 true 时优先用服务端的 error；
 * 为状态码数组时只在这些状态下用（如 LLM 接口的 502/503 带着可读的原因，
 * 其余状态的 error 是给开发者看的英文）。
 */
export async function apiRequest<T>(
  path: string,
  options: RequestOptions & {
    fallback: string;
    serverMessage?: boolean | number[];
  },
): Promise<T> {
  const { fallback, serverMessage = false, ...request } = options;
  const { ok, status, data } = await sendRequest(path, request);
  if (ok) return data as T;

  const server = typeof data.error === "string" ? data.error : undefined;
  const useServer =
    serverMessage === true ||
    (Array.isArray(serverMessage) && serverMessage.includes(status));
  throw new ApiError(
    (useServer && server) || fallback,
    status,
    typeof data.code === "string" ? data.code : undefined,
  );
}
