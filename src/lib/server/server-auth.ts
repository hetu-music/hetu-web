import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/db/supabase-auth";
import { verifyCSRFToken } from "@/lib/server/server-utils";

export interface AuthenticatedUser {
  id: string;
  email?: string;
  /** 改邮箱验证到一半时的新邮箱 */
  new_email?: string;
  app_metadata?: {
    is_admin?: boolean;
    is_super?: boolean;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface AuthResult {
  success: boolean;
  user?: AuthenticatedUser;
  /** 已验签的 JWT，交给 getUserClient 以该用户身份过 RLS */
  accessToken?: string;
  error?: string;
  response?: NextResponse;
}

/** withAuth 交给 handler 的第三个参数 */
export interface AuthContext {
  /**
   * 本次请求已验签的 JWT：来自 Authorization 头，或 cookie 里的会话。
   * 路由不要再自己 getSession() 取 token——只带 Authorization 头的请求
   * （脚本、agent）没有 cookie 会话，那样取到的是空的。
   */
  accessToken: string;
}

const BEARER_PATTERN = /^Bearer ([A-Za-z0-9-._~+/]+=*)$/;

/**
 * 请求是否自带 Authorization 头。带了就只认这个头（格式不对直接判未登录），
 * 不再看 cookie——所以这类请求不受 CSRF 影响：浏览器不会替跨站页面
 * 自动附上 Authorization 头，跨站带它还得先过 CORS 预检。
 */
function hasAuthorizationHeader(request: NextRequest): boolean {
  return request.headers.has("authorization");
}

/** 取出本次请求的 token 并向 Supabase 验签，返回用户与这个 token */
async function resolveRequestAuth(
  request: NextRequest,
): Promise<{ user: AuthenticatedUser; accessToken: string } | null> {
  const supabase = await createSupabaseServerClient();

  let token: string | undefined;
  const authHeader = request.headers.get("authorization");

  if (authHeader !== null) {
    // 严格校验 Bearer token 格式
    const match = authHeader.match(BEARER_PATTERN);
    if (!match) return null;
    token = match[1];
  } else {
    // 没有 header 时，取 session 里的 access_token
    const {
      data: { session },
    } = await supabase.auth.getSession();
    token = session?.access_token;
  }

  if (!token) return null;

  const {
    data: { user },
  } = await supabase.auth.getUser(token);

  if (!user) return null;
  return { user: user as unknown as AuthenticatedUser, accessToken: token };
}

/**
 * 从请求中获取用户信息
 */
export async function getUserFromRequest(
  request: NextRequest,
): Promise<AuthenticatedUser | null> {
  return (await resolveRequestAuth(request))?.user ?? null;
}

/**
 * 验证用户身份（仅验证登录状态）
 */
export async function authenticateUser(
  request: NextRequest,
): Promise<AuthResult> {
  try {
    const auth = await resolveRequestAuth(request);

    if (!auth) {
      return {
        success: false,
        error: "Unauthorized",
        response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      };
    }

    return {
      success: true,
      user: auth.user,
      accessToken: auth.accessToken,
    };
  } catch (error) {
    console.error("Authentication error:", error);
    return {
      success: false,
      error: "Authentication failed",
      response: NextResponse.json(
        { error: "Authentication failed" },
        { status: 500 },
      ),
    };
  }
}

/**
 * 验证用户身份和 CSRF token（用于需要 CSRF 保护的请求）
 *
 * 带 Authorization 头的请求跳过 CSRF：凭据不是浏览器自动附带的 cookie，
 * 没有跨站伪造的问题（见 hasAuthorizationHeader）。
 */
export async function authenticateUserWithCSRF(
  request: NextRequest,
): Promise<AuthResult> {
  try {
    // 先验证 CSRF token
    if (!hasAuthorizationHeader(request) && !(await verifyCSRFToken(request))) {
      return {
        success: false,
        error: "Invalid CSRF token",
        response: NextResponse.json(
          { error: "Invalid CSRF token" },
          { status: 403 },
        ),
      };
    }

    // 再验证用户身份
    return await authenticateUser(request);
  } catch (error) {
    console.error("Authentication with CSRF error:", error);
    return {
      success: false,
      error: "Authentication failed",
      response: NextResponse.json(
        { error: "Authentication failed" },
        { status: 500 },
      ),
    };
  }
}

/**
 * 高阶函数：为 API 路由添加身份验证
 *
 * options.requireCSRF       — 同时验证 CSRF token（写操作必须开启；带 Authorization 头的请求免检）
 * options.requireAdmin      — 额外校验 JWT app_metadata.is_admin=true（管理后台操作必须开启）
 * options.requireSuperAdmin — 额外校验 JWT app_metadata.is_super=true（超级管理员操作）
 *
 * 鉴权方式两种：浏览器用 cookie 会话；脚本、agent 用 `Authorization: Bearer <JWT>`。
 * handler 的第三个参数带已验签的 accessToken，两种方式都有。
 *
 * 权限来源：Supabase JWT 的 app_metadata，由数据库触发器 sync_user_claims_to_auth 同步写入，
 * 无需额外查询 users 表，性能更好且不受 RLS 影响。
 */
export function withAuth(
  handler: (
    request: NextRequest,
    user: AuthenticatedUser,
    auth: AuthContext,
  ) => Promise<NextResponse>,
  options: {
    requireCSRF?: boolean;
    requireAdmin?: boolean;
    requireSuperAdmin?: boolean;
  } = {},
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    const authResult = options.requireCSRF
      ? await authenticateUserWithCSRF(request)
      : await authenticateUser(request);

    if (!authResult.success) {
      return (
        authResult.response ||
        NextResponse.json({ error: "Authentication failed" }, { status: 500 })
      );
    }

    if (!authResult.user || !authResult.accessToken) {
      return NextResponse.json({ error: "User not found" }, { status: 401 });
    }

    // 从 JWT app_metadata 读取权限，由触发器 sync_user_claims_to_auth 保持同步
    if (options.requireAdmin || options.requireSuperAdmin) {
      const appMeta = authResult.user.app_metadata;
      const isAdmin = appMeta?.is_admin === true;
      const isSuper = appMeta?.is_super === true;

      if (!isAdmin) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      if (options.requireSuperAdmin && !isSuper) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    return handler(request, authResult.user, {
      accessToken: authResult.accessToken,
    });
  };
}

export interface AdminPageSession {
  user: AuthenticatedUser;
  /** 供 getUserClient() 以该用户身份访问受 RLS 约束的表 */
  accessToken: string | undefined;
}

/**
 * 后台页面用：校验登录态与管理员身份，并返回可用于 RLS 查询的 accessToken。
 *
 * 必须先 getUser() 再取 token——getUser() 会向 Supabase 校验 JWT 签名，
 * 而 getSession() 只读 cookie、不验签（@supabase/ssr 对此有明确警告）。
 * 页面自身完成校验，不把授权完全交给 middleware：matcher 一旦改动，
 * 仅靠 middleware 的页面会失去保护。
 *
 * 校验失败返回 null，由调用方决定跳转目标。
 */
export async function getAdminPageSession(): Promise<AdminPageSession | null> {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) return null;
  if (user.app_metadata?.is_admin !== true) return null;

  // 身份已验签，这里只是取 token 交给 RLS 客户端使用
  const {
    data: { session },
  } = await supabase.auth.getSession();

  return {
    user: user as unknown as AuthenticatedUser,
    accessToken: session?.access_token,
  };
}

/**
 * 需要登录的公开页面用（如个人中心）：返回已验签的当前用户，未登录返回 null。
 * 与 getAdminPageSession 一样用 getUser()，不信任只读 cookie 的 getSession()。
 */
export async function getPageUser(): Promise<AuthenticatedUser | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) return null;
  return user as unknown as AuthenticatedUser;
}

/**
 * 验证当前用户是否为管理员（适用于 Server Actions）
 * 如果验证失败则抛出错误，成功则返回当前登录的 AuthenticatedUser 对象。
 */
export async function assertAdmin(): Promise<AuthenticatedUser> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new Error("未登录或登录已过期");
  }

  const isAdmin = user.app_metadata?.is_admin === true;
  if (!isAdmin) {
    throw new Error("无权进行此操作");
  }

  return user as unknown as AuthenticatedUser;
}
