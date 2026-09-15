/**
 * 📝 supabase-server.ts — 服务端 Supabase 数据客户端
 *
 * ⚠️ 警告：本文件只能在服务端使用（Server Component、API Route 等），
 *    包含密钥，绝对不得暴露给客户端浏览器。
 *
 * === 两种权限客户端 ===
 *
 * getServiceClient()
 *   使用 Service Role Key（SUPABASE_SECRET_API），绕过 RLS。
 *   适用于：公共展示数据的全量读取（music、imagery 相关表）。
 *
 * getUserClient(accessToken?)
 *   使用 Anon Key（NEXT_PUBLIC_SUPABASE_ANON_KEY），受 RLS 约束。
 *   使用 accessToken 时以登录用户身份执行，适用于后台操作（temp 表、users 表）。
 *
 * === 表名常量 ===
 *
 * TABLES.MUSIC   — 公开歌曲表（只读，高权限访问）
 * TABLES.ADMIN   — 后台暂存表（增删改，用户权限访问）
 */

// 构建期护栏：任何客户端组件（含其依赖链）引用本模块都会直接构建失败。
// 下方的 assertServerOnly() 只能在运行时发现问题，这一行把它提前到构建期。
import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// ─── 表名常量 — 全站唯一数据源，禁止在业务代码中硬编码表名字符串 ──────────────
//
// 权限说明：
//   getServiceClient()  — 高权限 (绕过 RLS)，仅用于服务端公共数据的只读展示
//   getUserClient()     — 用户权限 (受 RLS 约束)，所有写操作和用户关联读操作
//
// 各表对应的默认访问权限：
//   MUSIC              → getServiceClient (公开只读)    ★ 写入时必须改用 getUserClient
//   ADMIN              → getUserClient    (管理员读写)
//   IMAGERY / _CAT / _OCC → getServiceClient (公开只读)
//   USERS              → getUserClient    (用户本人读写，RLS 隔离)
//   COLLECTIONS        → getUserClient    (用户本人读写，RLS 隔离)
export const TABLES = {
  // 核心业务表
  MUSIC: "music", // 正式歌曲库
  ADMIN: "temp", // 管理员暂存/审核表

  // 意象系统表
  IMAGERY: "imagery",
  IMAGERY_SUMMARY: "imagery_summary",
  IMAGERY_CAT: "imagery_categories",
  IMAGERY_MEANINGS: "imagery_meanings",
  IMAGERY_OCC: "imagery_occurrences",

  // 用户与互动表
  USERS: "users",
  COLLECTIONS: "collections",

  // 故事页专用表
  STORY_QJTX: "story_qjtx",

  // 审计日志
  AUDIT_LOGS: "audit_logs",

  // Navidrome 歌曲映射表
  NAVID_SONG: "navid_song",

  // 用户请求/反馈表
  USER_REQUESTS: "user_requests",
} as const;

// ─── 服务端运行时检查 ──────────────────────────────────────────────────────

function assertServerOnly() {
  if (typeof window !== "undefined") {
    throw new Error(
      "[supabase-server] 此模块只能在服务端使用，包含密钥，不得暴露给客户端。",
    );
  }
}

// ─── 客户端缓存（进程级单例）───────────────────────────────────────────────
//
// 只缓存不带用户身份的客户端（service / 匿名）。带 accessToken 的客户端一律
// 新建：此前是以 JWT 本身作为 Map 的 key，等于把一批用户令牌长期挂在进程全局
// 变量上；而且上限 20 的 FIFO 淘汰在并发管理员较多时会反复失效，缓存本身也没
// 起到作用。supabase-js 的 REST 客户端只是配置对象、不持有连接，新建成本极低。

const clientCache = new Map<string, SupabaseClient>();

function getCachedClient(url: string, key: string): SupabaseClient {
  const cacheKey = `${url}::${key}`;
  let client = clientCache.get(cacheKey);
  if (!client) {
    client = createClient(url, key);
    clientCache.set(cacheKey, client);
  }
  return client;
}

// ─── 公共 API ──────────────────────────────────────────────────────────────

let hasWarnedService = false;
let hasWarnedUser = false;

/**
 * 高权限客户端（Service Role Key）
 *
 * 绕过 RLS，可读取所有 data，仅用于公共展示数据的服务端全量读取。
 * 环境变量缺失时返回 null（构建时降级为空数据而不是抛异常）。
 */
export function getServiceClient(): SupabaseClient | null {
  assertServerOnly();

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_API;

  if (!url || !key || url === "placeholder" || key === "placeholder") {
    if (!hasWarnedService) {
      const isPlaceholder = url === "placeholder" || key === "placeholder";
      console.warn(
        `[supabase-server] SUPABASE_URL / SUPABASE_SECRET_API ${
          isPlaceholder ? "为占位符，已启用构建期降级模式" : "未配置"
        }`,
      );
      hasWarnedService = true;
    }
    return null;
  }

  return getCachedClient(url, key);
}

/**
 * 用户权限客户端（Anon Key + 可选 accessToken）
 *
 * 受 RLS 约束，用于后台操作（temp 表）和用户相关查询（users 表）。
 * 传入 accessToken 时以该登录用户身份执行请求。
 */
export function getUserClient(accessToken?: string): SupabaseClient | null {
  assertServerOnly();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key || url === "placeholder" || key === "placeholder") {
    if (!hasWarnedUser) {
      const isPlaceholder = url === "placeholder" || key === "placeholder";
      console.warn(
        `[supabase-server] NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY ${
          isPlaceholder ? "为占位符，已启用构建期降级模式" : "未配置"
        }`,
      );
      hasWarnedUser = true;
    }
    return null;
  }

  // 带用户身份的客户端不进缓存，避免把 JWT 挂在进程级 Map 上
  if (accessToken) {
    return createClient(url, key, {
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
    });
  }

  return getCachedClient(url, key);
}

// ─── 分页工具 ──────────────────────────────────────────────────────────────

const PAGE_SIZE = 1000;

/**
 * 全量分页获取（Supabase/PostgREST 单次最多返回 1000 行）
 *
 * 循环 range 请求直到取完所有行，适用于超过 1000 行的大表。
 *
 * @param supabase     - Supabase 客户端实例
 * @param table        - 要查询的表名
 * @param selectFields - 查询字段（逗号分隔字符串）
 * @param extraFilter  - 可选的额外过滤/排序条件函数
 */
export async function fetchAll<T>(
  supabase: SupabaseClient,
  table: string,
  selectFields: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  extraFilter?: (query: any) => any,
): Promise<T[]> {
  const results: T[] = [];
  let from = 0;

  while (true) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query: any = supabase
      .from(table)
      .select(selectFields)
      .range(from, from + PAGE_SIZE - 1);

    if (extraFilter) {
      query = extraFilter(query);
    }

    const { data, error } = await query;

    if (error) {
      console.error(
        `[fetchAll] 获取 "${table}" 失败 (range ${from}–${from + PAGE_SIZE - 1}):`,
        error,
      );
      break;
    }

    if (!data || data.length === 0) break;
    results.push(...(data as T[]));
    if (data.length < PAGE_SIZE) break; // 最后一页
    from += PAGE_SIZE;
  }

  return results;
}
