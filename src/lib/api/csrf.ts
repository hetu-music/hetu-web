"use client";

/**
 * 全站唯一的 CSRF token 获取入口。
 *
 * 此前 useCsrfToken / FavoritesContext / UserContext / AuthClient 各自
 * 直接 fetch 该接口并独立缓存，互相看不到对方的副本。配合旧版服务端
 * 「每次调用都重新签发」的行为，后取的一方会把 cookie 换掉，先取的一方
 * 手里的 token 随即失效，写操作报 403。
 *
 * 现在：服务端复用 cookie 中的现有 token，客户端也只保留这一份内存缓存，
 * 并发调用共享同一个 in-flight 请求。
 */

let cachedToken = "";
let inFlight: Promise<string> | null = null;

async function requestToken(): Promise<string> {
  const res = await fetch("/api/public/csrf-token", { cache: "no-store" });
  if (!res.ok) throw new Error("获取 CSRF Token 失败");

  const data: { csrfToken?: string } = await res.json();
  if (!data.csrfToken) throw new Error("CSRF Token 缺失");

  return data.csrfToken;
}

export async function getCsrfToken(): Promise<string> {
  if (cachedToken) return cachedToken;

  if (!inFlight) {
    inFlight = requestToken()
      .then((token) => {
        cachedToken = token;
        return token;
      })
      .finally(() => {
        inFlight = null;
      });
  }

  return inFlight;
}

/**
 * 丢弃内存中的 token，下次调用重新获取。
 * 写操作被判定为 CSRF 失败时调用——cookie 可能已过期或被清掉。
 */
export function resetCsrfToken(): void {
  cachedToken = "";
}
