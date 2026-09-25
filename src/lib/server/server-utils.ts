import crypto from "crypto";
import { cookies as nextCookies } from "next/headers";
import { NextResponse } from "next/server";
import { fetchWithTimeout } from "@/lib/utils/utils-common";

// 两家 CDN 的刷新接口串在发布流程的 Promise.all 上，卡住就卡住整个发布
const PURGE_TIMEOUT_MS = 10000;

const CSRF_COOKIE_NAME = "csrf-token";
const CSRF_HEADER_NAME = "x-csrf-token";

/**
 * 把服务端错误转成不泄漏内部细节的响应。
 *
 * PostgREST 的 error.message 原文里带表名、列名和约束名，直接回给客户端
 * 等于把 schema 送出去。这里把原文留在服务端日志，响应体只给通用文案。
 *
 * @param scope         - 日志定位用的标识，如 "GET /api/public/requests"
 * @param error         - 原始错误对象，只进日志
 * @param clientMessage - 回给客户端的文案
 */
export function serverErrorResponse(
  scope: string,
  error: unknown,
  clientMessage = "服务器错误，请稍后重试",
  status = 500,
): NextResponse {
  console.error(`[${scope}]`, error);
  return NextResponse.json({ error: clientMessage }, { status });
}

/**
 * 常量时间比较两个密钥字符串。
 * 先做 SHA-256 再比较，以规避 timingSafeEqual 对等长的要求
 * （长度不等会直接抛错，本身也是一种泄漏）。
 */
export function safeCompareSecret(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  if (!a || !b) return false;
  const ha = crypto.createHash("sha256").update(a).digest();
  const hb = crypto.createHash("sha256").update(b).digest();
  return crypto.timingSafeEqual(ha, hb);
}

// 生成安全的 CSRF token
export function generateCSRFToken(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// 设置 CSRF token 到 cookie
export async function setCSRFCookie(token: string) {
  const cookies = await nextCookies();
  cookies.set(CSRF_COOKIE_NAME, token, {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    path: "/",
  });
}

// 获取 cookie 中的 CSRF token
export async function getCSRFCookie(): Promise<string | undefined> {
  const cookies = await nextCookies();
  return cookies.get(CSRF_COOKIE_NAME)?.value;
}

// 校验 CSRF token
export async function verifyCSRFToken(
  request: Request | { headers: Record<string, string> | Headers },
): Promise<boolean> {
  try {
    const cookieToken = await getCSRFCookie();
    let headerToken: string | undefined = undefined;
    if (
      request.headers &&
      typeof (request.headers as Headers).get === "function"
    ) {
      headerToken =
        (request.headers as Headers).get(CSRF_HEADER_NAME) ?? undefined;
    } else if (request.headers && typeof request.headers === "object") {
      headerToken = (request.headers as Record<string, string>)[
        CSRF_HEADER_NAME
      ];
    }

    // 更严格的校验：token 必须为非空字符串且不能全为空白
    const isValidToken = (token: unknown): token is string =>
      typeof token === "string" && token.trim().length > 0;

    return (
      isValidToken(cookieToken) &&
      isValidToken(headerToken) &&
      cookieToken === headerToken
    );
  } catch (error) {
    console.error("CSRF token verification error:", error);
    return false;
  }
}

// 清理认证相关的 cookies
export async function clearAuthCookies() {
  const cookies = await nextCookies();
  const authCookies = cookies
    .getAll()
    .filter(
      (cookie) =>
        cookie.name.startsWith("sb-") || cookie.name === CSRF_COOKIE_NAME,
    );

  authCookies.forEach(({ name }) => {
    // 使用 delete 方法删除 cookie
    cookies.delete({
      name,
      path: "/",
    });

    // 备用方法：同时设置过期的空值
    cookies.set(name, "", {
      path: "/",
      expires: new Date(0),
      maxAge: 0,
    });
  });
}

/**
 * Turnstile 验证结果接口
 */
export interface TurnstileVerifyResult {
  success: boolean;
  error?: string;
  errorCodes?: string[];
}

/**
 * 验证 Cloudflare Turnstile token
 * @param token - Turnstile token (从客户端获取)
 * @returns 验证结果
 */
export async function verifyTurnstileToken(
  token: string | null | undefined,
): Promise<TurnstileVerifyResult> {
  // 检查 token 是否存在
  if (!token || typeof token !== "string" || token.trim().length === 0) {
    return {
      success: false,
      error: "缺少验证令牌",
    };
  }

  // 检查环境变量
  const secretKey = process.env.TURNSTILE_SECRET_KEY;
  if (!secretKey) {
    console.error("TURNSTILE_SECRET_KEY 未配置");
    return {
      success: false,
      error: "服务器配置错误",
    };
  }

  try {
    // 调用 Cloudflare Turnstile API 验证
    const verifyResponse = await fetchWithTimeout(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          secret: secretKey,
          response: token,
        }),
      },
      // 用户正卡在表单提交上等这个结果
      5000,
    );

    const verifyData = await verifyResponse.json();

    if (verifyData.success) {
      return { success: true };
    } else {
      return {
        success: false,
        error: "验证失败",
        errorCodes: verifyData["error-codes"],
      };
    }
  } catch (error) {
    console.error("Turnstile 验证错误:", error);
    return {
      success: false,
      error: "验证服务异常",
    };
  }
}

/**
 * 清除 Cloudflare CDN 的指定绝对路径缓存
 * @param paths 相对地址路径数组，如 ['/', '/song/123']
 */
export async function purgeCloudflareCache(paths: string[]) {
  const zoneId = process.env.CLOUDFLARE_ZONE_ID;
  const token = process.env.CLOUDFLARE_API_TOKEN;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;

  // 如果未配置环境变量，则静默跳过（如本地开发环境）
  if (!zoneId || !token || !siteUrl) {
    console.warn(
      "[Cloudflare] 未配置 Zone ID 或 API Token，跳过 CDN 缓存刷新。",
    );
    return;
  }

  // 拼接绝对 URL 列表
  const urls = paths.map((p) => {
    const cleanPath = p.startsWith("/") ? p : `/${p}`;
    return `${siteUrl.replace(/\/$/, "")}${cleanPath}`;
  });

  try {
    const res = await fetchWithTimeout(
      `https://api.cloudflare.com/client/v4/zones/${zoneId}/purge_cache`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ files: urls }),
      },
      PURGE_TIMEOUT_MS,
    );

    if (!res.ok) {
      const errText = await res.text();
      console.error("[Cloudflare] 刷新 CDN 缓存失败:", errText);
    } else {
      // eslint-disable-next-line no-console
      console.log("[Cloudflare] 成功刷新 CDN 缓存:", urls);
    }
  } catch (err) {
    console.error("[Cloudflare] 刷新 CDN 缓存出错:", err);
  }
}

/**
 * 清除腾讯云 EdgeOne (TEO) CDN 的指定路径缓存
 * @param paths 相对地址路径数组，如 ['/', '/song/123']
 */
export async function purgeEdgeOneCache(paths: string[]) {
  const secretId = process.env.EDGEONE_SECRET_ID;
  const secretKey = process.env.EDGEONE_SECRET_KEY;
  const zoneId = process.env.EDGEONE_ZONE_ID;
  const siteUrl = process.env.EDGEONE_SITE_URL;

  // 如果未配置完整环境变量，则静默跳过
  if (!secretId || !secretKey || !zoneId || !siteUrl) {
    console.warn(
      "[EdgeOne] 未配置完整凭证 (SecretId/SecretKey/ZoneId/SiteUrl)，跳过 CDN 缓存刷新。",
    );
    return;
  }

  // 拼接 EdgeOne 对应的绝对 URL 列表
  const urls = paths.map((p) => {
    const cleanPath = p.startsWith("/") ? p : `/${p}`;
    return `${siteUrl.replace(/\/$/, "")}${cleanPath}`;
  });

  const host = "teo.intl.tencentcloudapi.com"; // 对应 edgeone.ai 国际站的 API 域名
  const service = "teo";
  const action = "CreatePurgeTask";
  const version = "2022-09-01";
  const region = "ap-singapore";
  const timestamp = Math.floor(Date.now() / 1000);
  const payload = {
    ZoneId: zoneId,
    Type: "purge_url",
    Targets: urls,
    Method: "delete", // 直接物理删除缓存 (hard purge)，确保客户端下一次访问强行获取最新数据
  };

  try {
    const date = new Date(timestamp * 1000).toISOString().split("T")[0];

    // 1. 构建规范请求串 (Canonical Request)
    const httpRequestMethod = "POST";
    const canonicalUri = "/";
    const canonicalQueryString = "";
    const canonicalHeaders = `content-type:application/json; charset=utf-8\nhost:${host}\n`;
    const signedHeaders = "content-type;host";

    const payloadHash = crypto
      .createHash("sha256")
      .update(JSON.stringify(payload))
      .digest("hex");

    const canonicalRequest = `${httpRequestMethod}\n${canonicalUri}\n${canonicalQueryString}\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;

    // 2. 构建待签名字符串 (String to Sign)
    const credentialScope = `${date}/${service}/tc3_request`;
    const hashedCanonicalRequest = crypto
      .createHash("sha256")
      .update(canonicalRequest)
      .digest("hex");

    const stringToSign = `TC3-HMAC-SHA256\n${timestamp}\n${credentialScope}\n${hashedCanonicalRequest}`;

    // 3. 计算签名 (Signature)
    const sign = (
      key: crypto.BinaryLike | crypto.KeyObject,
      msg: string | Uint8Array,
    ) => crypto.createHmac("sha256", key).update(msg).digest();

    const kDate = sign(`TC3${secretKey}`, date);
    const kService = sign(kDate, service);
    const kSigning = sign(kService, "tc3_request");

    const signature = crypto
      .createHmac("sha256", kSigning)
      .update(stringToSign)
      .digest("hex");

    // 4. 构建 Authorization 头部
    const authorization = `TC3-HMAC-SHA256 Credential=${secretId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

    const res = await fetchWithTimeout(
      `https://${host}`,
      {
        method: "POST",
        headers: {
          Authorization: authorization,
          "Content-Type": "application/json; charset=utf-8",
          Host: host,
          "X-TC-Action": action,
          "X-TC-Version": version,
          "X-TC-Timestamp": String(timestamp),
          "X-TC-Region": region,
        },
        body: JSON.stringify(payload),
      },
      PURGE_TIMEOUT_MS,
    );

    const resData = await res.json();
    if (resData.Response?.Error) {
      console.error(
        "[EdgeOne] 提交刷新任务失败:",
        resData.Response.Error.Code,
        resData.Response.Error.Message,
      );
    } else {
      // eslint-disable-next-line no-console
      console.log(
        "[EdgeOne] 成功提交刷新任务，任务 ID:",
        resData.Response?.JobId,
      );
    }
  } catch (err) {
    console.error("[EdgeOne] 刷新 CDN 缓存出错:", err);
  }
}
