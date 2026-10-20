import { createServerClient } from "@supabase/ssr";
import { createClient, type AuthError } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import type { NextRequest, NextResponse } from "next/server";

/**
 * 📝 Supabase 客户端文件说明：
 *
 * - `supabase-auth.ts` (本文件) - 用于**认证和会话管理**的服务端客户端
 *   - 处理用户登录、会话、cookies
 *   - 使用 @supabase/ssr 包
 *   - 使用 NEXT_PUBLIC_SUPABASE_ANON_KEY
 *
 * - `supabase-server.ts` - 用于**数据访问**的服务端客户端
 *   - 查询数据库表（songs, users 等）
 *   - 可以使用高权限密钥（SUPABASE_SECRET_API）访问主表
 *   - 仅在服务端使用，包含运行时检查
 */

/**
 * 创建服务端 Supabase 客户端，用于处理认证和 cookies
 * 这个函数专门用于服务端组件和 API 路由中需要处理认证的场景
 */
export async function createSupabaseServerClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing Supabase environment variables");
  }

  const cookieStore = await cookies();

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, {
              ...options,
              httpOnly: true,
              secure: process.env.NODE_ENV === "production",
              sameSite: "lax",
              path: "/",
            });
          });
        } catch {
          // The `setAll` method was called from a Server Component or GET Route Handler.
        }
      },
    },
  });
}

/**
 * 核对当前密码（改密码、改邮箱前确认是本人），不碰现有会话。
 *
 * 以前直接用 createSupabaseServerClient 的 signInWithPassword 核对：每核对一次
 * 就新建一个会话并换掉 cookie，旧会话留在库里没人管。这里换一个只存在内存里的
 * 临时客户端去登录，核对完立刻注销这次会话。
 *
 * 返回 GoTrue 的错误；密码不对是 code === "invalid_credentials"。
 */
export async function verifyPassword(
  email: string,
  password: string,
): Promise<AuthError | null> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing Supabase environment variables");
  }

  const client = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) return error;

  // 注销失败不影响核对结果：这次会话的 refresh token 没人拿得到，到期自然作废
  await client.auth.signOut({ scope: "local" }).catch(() => undefined);
  return null;
}

/**
 * 创建用于 middleware 的 Supabase 客户端
 */
export function createSupabaseMiddlewareClient(
  request: NextRequest,
  response: NextResponse,
) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing Supabase environment variables");
  }

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, {
            ...options,
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            path: "/",
          });
        });
      },
    },
  });
}
