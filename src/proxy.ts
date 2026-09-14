import { routing } from "@/i18n/routing";
import { createSupabaseMiddlewareClient } from "@/lib/db/supabase-auth";
import createIntlMiddleware from "next-intl/middleware";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

// next-intl 中间件：处理 locale 探测和重定向
const intlMiddleware = createIntlMiddleware(routing);

export async function proxy(request: NextRequest) {
  // Generate a random nonce for CSP
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");

  // Development environment check
  const isDev = process.env.NODE_ENV === "development";
  const pathname = request.nextUrl.pathname;

  // 跳过 next-intl 不需要处理的路径（API、静态资源等由 matcher 过滤）
  // 对所有页面路由先走 next-intl，再做 CSP 和 Auth 处理

  // Determine the route type based on the new structure
  // (admin) group: Starts with /admin or is /login or /zh-TW/admin etc. -> Strict CSP
  // (public) group: /, /song/*, /zh-TW/* etc. -> Relaxed CSP (Static/ISR)
  const strippedPathname = pathname
    .replace(/^\/(zh-TW)/, "")
    .replace(/^\/(zh-CN)/, "");
  const isStrictRoute =
    strippedPathname.startsWith("/admin") ||
    strippedPathname === "/login" ||
    strippedPathname === "/register";

  // Only use Nonce in Production on Strict routes
  const useNonce = isStrictRoute && !isDev;

  // ─── Cloudflare 相关来源说明（勿随手清理）────────────────────────────────
  //
  // challenges.cloudflare.com     — Turnstile。登录/注册页显式使用；此外 CF
  //                                 边缘也可能向任意页面注入挑战组件，故公开
  //                                 页面同样保留 script-src 与 frame-src。
  // static.cloudflareinsights.com — CF Web Analytics 的 beacon，由 CDN 自动注入，
  //                                 应用代码里搜不到引用，但线上确实会出现。
  // cloudflareinsights.com        — beacon 的上报目标。只放开 script-src 而不放开
  //                                 connect-src，脚本能加载却发不出数据，且浏览器
  //                                 只在控制台报错，表现为「统计一直没数据」。
  //
  // 严格 CSP 里同时带 'strict-dynamic' 和这些 host：支持 CSP3 的浏览器会忽略
  // host 白名单只认 nonce，不支持的老浏览器则回退到 host 白名单——这是规范
  // 推荐的向后兼容写法，两者都要留。
  let cspHeader = "";

  if (useNonce) {
    cspHeader = `
      default-src 'self';
      script-src 'self' 'nonce-${nonce}' 'strict-dynamic' 'sha256-n46vPwSWuMC0W703pBofImv82Z26xo4LXymv0E9caPk=' https://challenges.cloudflare.com https://static.cloudflareinsights.com;
      worker-src 'self' blob:;
      style-src 'self' 'unsafe-inline';
      img-src 'self' blob: data: https://cover.hetu-music.com;
      font-src 'self';
      media-src 'self' https://pre.hetu-music.com;
      connect-src 'self' https://cloudflareinsights.com;
      object-src 'none';
      base-uri 'self';
      form-action 'self';
      frame-ancestors 'none';
      frame-src 'self' https://challenges.cloudflare.com;
      block-all-mixed-content;
      upgrade-insecure-requests;
    `
      .replace(/\s{2,}/g, " ")
      .trim();
  } else {
    cspHeader = `
      default-src 'self';
      script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com https://static.cloudflareinsights.com;
      worker-src 'self' blob:;
      style-src 'self' 'unsafe-inline';
      img-src 'self' blob: data: https://cover.hetu-music.com;
      font-src 'self';
      media-src 'self' https://pre.hetu-music.com;
      connect-src 'self' https://cloudflareinsights.com;
      object-src 'none';
      base-uri 'self';
      form-action 'self';
      frame-ancestors 'none';
      frame-src 'self' https://challenges.cloudflare.com;
      block-all-mixed-content;
      upgrade-insecure-requests;
    `
      .replace(/\s{2,}/g, " ")
      .trim();
  }

  // 先运行 next-intl 中间件（处理 locale 路由）
  const intlResponse = intlMiddleware(request);

  // 如果 next-intl 要做重定向（如 locale 探测），直接返回并附上 CSP
  if (intlResponse.status !== 200) {
    intlResponse.headers.set("Content-Security-Policy", cspHeader);
    return intlResponse;
  }

  // 需要 nonce 的路由：走 Next 文档化的「向下游请求注入 header」通道。
  //
  // 这里必须重建响应而不能沿用 intlResponse：请求头注入只能通过
  // NextResponse.next({ request }) 完成。此前的写法是直接往响应上写
  // x-middleware-request-* ——那是 Next 的内部约定，既未公开，又会把这些
  // 内部头原样发给浏览器（线上可见 x-middleware-request-content-security-policy）。
  //
  // content-security-policy 这个请求头是必需的，不是冗余：Next 会读取它、
  // 取出其中的 nonce 并自动加到自己生成的 <script> 上（线上 19 个 script 的
  // nonce 都来自这里）。删掉它会导致除 Turnstile 外所有脚本失去 nonce。
  let response: NextResponse;

  if (useNonce) {
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-nonce", nonce);
    requestHeaders.set("content-security-policy", cspHeader);

    response = NextResponse.next({ request: { headers: requestHeaders } });

    // 保留 next-intl 在响应上设置的内容（locale cookie、alternate link 等），
    // 但不要把它的内部 x-middleware-* 约定头一起搬过来。
    intlResponse.headers.forEach((value, key) => {
      if (!key.toLowerCase().startsWith("x-middleware-")) {
        response.headers.set(key, value);
      }
    });
    intlResponse.cookies.getAll().forEach((cookie) => {
      response.cookies.set(cookie);
    });
  } else {
    // 公开页面是 ISR，不用 nonce，直接沿用 intl 响应
    response = intlResponse;
  }

  // Apply Security Headers to Response
  response.headers.set("Content-Security-Policy", cspHeader);

  // Always refresh the Supabase session
  try {
    const supabase = createSupabaseMiddlewareClient(request, response);
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    // Admin-only: redirect to login if not authenticated or not admin
    // 兼容 locale 前缀：/admin 和 /zh-TW/admin 都要保护
    if (strippedPathname.startsWith("/admin")) {
      if (error || !user) {
        console.warn("Auth middleware: User not authenticated", error?.message);
        // 重定向到带 locale 前缀的 /login（localePrefix: always 下两个 locale 都有前缀）
        const loginPath = pathname.startsWith("/zh-TW")
          ? "/zh-TW/login"
          : "/zh-CN/login";
        const redirectResponse = NextResponse.redirect(
          new URL(loginPath, request.url),
        );
        redirectResponse.headers.set("Content-Security-Policy", cspHeader);
        return redirectResponse;
      }

      const isAdmin = user.app_metadata?.is_admin === true;

      if (!isAdmin) {
        console.warn("Auth middleware: User is not admin", user.id);
        const homePath = pathname.startsWith("/zh-TW") ? "/zh-TW" : "/zh-CN";
        const redirectResponse = NextResponse.redirect(
          new URL(homePath, request.url),
        );
        redirectResponse.headers.set("Content-Security-Policy", cspHeader);
        return redirectResponse;
      }
    }
  } catch (error) {
    console.error("Auth middleware error:", error);
    if (strippedPathname.startsWith("/admin")) {
      const loginPath = pathname.startsWith("/zh-TW")
        ? "/zh-TW/login"
        : "/zh-CN/login";
      const redirectResponse = NextResponse.redirect(
        new URL(loginPath, request.url),
      );
      redirectResponse.headers.set("Content-Security-Policy", cspHeader);
      return redirectResponse;
    }
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - metadata files or static assets with extensions (containing a dot, e.g. favicon.ico, sitemap.xml, robots.txt, manifest.json, sw.js, image.png, LXGWMono.woff2)
     */
    "/((?!api|_next/static|_next/image|.*\\..*).*)",
  ],
};
