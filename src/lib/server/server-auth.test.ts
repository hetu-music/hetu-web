import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { assertAdmin, getUserFromRequest, withAuth } from "./server-auth";

// withAuth 是全站 40+ 个 admin/auth API 路由共用的鉴权闸门，
// 这里对 {未登录, 普通用户, admin, superAdmin} × {requireAdmin, requireSuperAdmin, requireCSRF}
// 做完整的组合断言，防止未来重构时某个权限分支被误改。

type MockUser = {
  id: string;
  app_metadata?: Record<string, unknown>;
} | null;

let mockUser: MockUser = null;
let mockCsrfValid = true;
/** 模拟 Supabase 调用本身抛异常（比如数据库/网络挂了），而不是正常返回 error 字段 */
let mockThrowOnSupabaseCall = false;
/** 模拟 verifyCSRFToken 本身抛异常 */
let mockThrowOnCsrfCheck = false;

vi.mock("@/lib/db/supabase-auth", () => ({
  createSupabaseServerClient: vi.fn(async () => {
    if (mockThrowOnSupabaseCall) throw new Error("supabase unavailable");
    return {
      auth: {
        // getUserFromRequest 在没有 Authorization header 时走 session 分支
        getSession: vi.fn(async () => ({
          data: { session: mockUser ? { access_token: "test-token" } : null },
        })),
        getUser: vi.fn(async () => ({
          data: { user: mockUser },
        })),
      },
    };
  }),
}));

vi.mock("./server-utils", () => ({
  verifyCSRFToken: vi.fn(async () => {
    if (mockThrowOnCsrfCheck) throw new Error("csrf check exploded");
    return mockCsrfValid;
  }),
}));

function makeRequest() {
  return new NextRequest("http://localhost/api/test");
}

async function callWithAuth(options: Parameters<typeof withAuth>[1]) {
  const handler = withAuth(
    async () => NextResponse.json({ ok: true }, { status: 200 }),
    options,
  );
  return handler(makeRequest());
}

describe("withAuth 权限矩阵", () => {
  beforeEach(() => {
    mockUser = null;
    mockCsrfValid = true;
    mockThrowOnSupabaseCall = false;
    mockThrowOnCsrfCheck = false;
  });

  it("未登录访问 requireAdmin 接口 → 401", async () => {
    const res = await callWithAuth({ requireAdmin: true });
    expect(res.status).toBe(401);
  });

  it("未登录访问无权限要求的接口 → 仍然 401（withAuth 总是要求登录）", async () => {
    const res = await callWithAuth({});
    expect(res.status).toBe(401);
  });

  it("已登录但非 admin 访问 requireAdmin 接口 → 403", async () => {
    mockUser = { id: "u1", app_metadata: { is_admin: false } };
    const res = await callWithAuth({ requireAdmin: true });
    expect(res.status).toBe(403);
  });

  it("admin 访问 requireAdmin 接口 → 200", async () => {
    mockUser = { id: "u1", app_metadata: { is_admin: true } };
    const res = await callWithAuth({ requireAdmin: true });
    expect(res.status).toBe(200);
  });

  it("admin 但非 super 访问 requireSuperAdmin 接口 → 403", async () => {
    mockUser = {
      id: "u1",
      app_metadata: { is_admin: true, is_super: false },
    };
    const res = await callWithAuth({ requireSuperAdmin: true });
    expect(res.status).toBe(403);
  });

  it("superAdmin 访问 requireSuperAdmin 接口 → 200", async () => {
    mockUser = { id: "u1", app_metadata: { is_admin: true, is_super: true } };
    const res = await callWithAuth({ requireSuperAdmin: true });
    expect(res.status).toBe(200);
  });

  it("普通登录用户访问无权限要求的接口 → 200", async () => {
    mockUser = { id: "u1", app_metadata: {} };
    const res = await callWithAuth({});
    expect(res.status).toBe(200);
  });

  it("requireCSRF 校验失败 → 403，且不触达业务 handler（即使用户是 admin）", async () => {
    mockUser = { id: "u1", app_metadata: { is_admin: true } };
    mockCsrfValid = false;
    const res = await callWithAuth({ requireCSRF: true, requireAdmin: true });
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe("Invalid CSRF token");
  });

  it("requireCSRF 校验通过后正常走鉴权 → 200", async () => {
    mockUser = { id: "u1", app_metadata: { is_admin: true } };
    mockCsrfValid = true;
    const res = await callWithAuth({ requireCSRF: true, requireAdmin: true });
    expect(res.status).toBe(200);
  });

  it("鉴权过程本身抛异常（如数据库挂了）时兜底返回 500，而不是让异常冒泡", async () => {
    mockThrowOnSupabaseCall = true;
    const res = await callWithAuth({ requireAdmin: true });
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Authentication failed");
  });

  it("requireCSRF 校验本身抛异常时兜底返回 500", async () => {
    mockThrowOnCsrfCheck = true;
    const res = await callWithAuth({ requireCSRF: true, requireAdmin: true });
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Authentication failed");
  });
});

describe("withAuth — Authorization header 与 accessToken", () => {
  beforeEach(() => {
    mockUser = { id: "u1", app_metadata: { is_admin: true } };
    mockCsrfValid = false;
    mockThrowOnSupabaseCall = false;
    mockThrowOnCsrfCheck = false;
  });

  /** 跑一遍 withAuth，返回响应与 handler 收到的 accessToken（没进 handler 为 undefined） */
  async function run(headers: Record<string, string>) {
    let received: string | undefined;
    const handler = withAuth(
      async (_req, _user, { accessToken }) => {
        received = accessToken;
        return NextResponse.json({ ok: true });
      },
      { requireCSRF: true, requireAdmin: true },
    );
    const res = await handler(
      new NextRequest("http://localhost/api/test", { method: "POST", headers }),
    );
    return { status: res.status, received };
  }

  it("带合法 Bearer 头时免 CSRF，handler 拿到的是头里的 token", async () => {
    const { status, received } = await run({
      authorization: "Bearer abc.def-ghi_123",
    });
    expect(status).toBe(200);
    expect(received).toBe("abc.def-ghi_123");
  });

  it("Authorization 头格式不对时判未登录，不会退回 cookie 会话绕过 CSRF", async () => {
    const { status, received } = await run({ authorization: "Basic xyz" });
    expect(status).toBe(401);
    expect(received).toBeUndefined();
  });

  it("没有 Authorization 头时仍要 CSRF", async () => {
    const { status } = await run({});
    expect(status).toBe(403);
  });

  it("cookie 会话通过 CSRF 后，handler 拿到会话里的 token", async () => {
    mockCsrfValid = true;
    const { status, received } = await run({});
    expect(status).toBe(200);
    expect(received).toBe("test-token");
  });
});

describe("getUserFromRequest — Authorization header 分支", () => {
  beforeEach(() => {
    mockUser = null;
    mockCsrfValid = true;
    mockThrowOnSupabaseCall = false;
    mockThrowOnCsrfCheck = false;
  });

  it("合法 Bearer token 格式时直接用该 token 查用户，不依赖 session", async () => {
    mockUser = { id: "u1", app_metadata: { is_admin: true } };
    const request = new NextRequest("http://localhost/api/test", {
      headers: { authorization: "Bearer abc.def-ghi_123" },
    });
    const user = await getUserFromRequest(request);
    expect(user?.id).toBe("u1");
  });

  it("非法 Bearer token 格式时直接判定未登录，不查询 session/getUser", async () => {
    const request = new NextRequest("http://localhost/api/test", {
      headers: { authorization: "Basic not-a-bearer-token" },
    });
    const user = await getUserFromRequest(request);
    expect(user).toBeNull();
  });
});

describe("assertAdmin（用于 Server Actions）", () => {
  beforeEach(() => {
    mockUser = null;
    mockThrowOnSupabaseCall = false;
    mockThrowOnCsrfCheck = false;
  });

  it("未登录时抛出“未登录或登录已过期”", async () => {
    await expect(assertAdmin()).rejects.toThrow("未登录或登录已过期");
  });

  it("已登录但非 admin 时抛出“无权进行此操作”", async () => {
    mockUser = { id: "u1", app_metadata: { is_admin: false } };
    await expect(assertAdmin()).rejects.toThrow("无权进行此操作");
  });

  it("admin 用户返回该用户对象", async () => {
    mockUser = { id: "u1", app_metadata: { is_admin: true } };
    const user = await assertAdmin();
    expect(user.id).toBe("u1");
  });
});
