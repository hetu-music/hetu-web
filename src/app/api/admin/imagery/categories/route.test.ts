import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

let mockUser: { id: string; app_metadata?: Record<string, unknown> } | null = {
  id: "admin-1",
  app_metadata: { is_admin: true },
};
let mockCsrfValid = true;
/** withAuth 的登录态和路由自己再查一次的 session 理论上可能不一致（如 session cookie 缺失但 JWT 仍有效） */
let mockSessionAccessToken: string | null = "test-token";

vi.mock("@/lib/db/supabase-auth", () => ({
  createSupabaseServerClient: vi.fn(async () => ({
    auth: {
      getSession: vi.fn(async () => ({
        data: {
          session: mockSessionAccessToken
            ? { access_token: mockSessionAccessToken }
            : null,
        },
      })),
      getUser: vi.fn(async () => ({ data: { user: mockUser } })),
    },
  })),
}));

vi.mock("@/lib/server/server-utils", () => ({
  verifyCSRFToken: vi.fn(async () => mockCsrfValid),
}));

vi.mock("@/lib/server/service-imagery", () => ({
  getImageryCategories: vi.fn(),
  createImageryCategory: vi.fn(),
}));

vi.mock("@/lib/server/server-revalidate", () => ({
  refreshImagery: vi.fn(async () => undefined),
}));

import {
  createImageryCategory,
  getImageryCategories,
} from "@/lib/server/service-imagery";
import { GET, POST } from "./route";

function jsonRequest(method: string, body?: unknown) {
  return new NextRequest("http://localhost/api/admin/imagery/categories", {
    method,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    headers: { "content-type": "application/json" },
  });
}

beforeEach(() => {
  mockUser = { id: "admin-1", app_metadata: { is_admin: true } };
  mockCsrfValid = true;
  mockSessionAccessToken = "test-token";
  vi.mocked(getImageryCategories).mockReset();
  vi.mocked(createImageryCategory).mockReset();
});

describe("GET /api/admin/imagery/categories", () => {
  it("正常返回分类列表", async () => {
    vi.mocked(getImageryCategories).mockResolvedValue([
      { id: 1, name: "自然", parent_id: null, level: 1, description: null },
    ]);
    const res = await GET(jsonRequest("GET"));
    expect(res.status).toBe(200);
  });

  it("service 层抛异常时返回 500", async () => {
    vi.mocked(getImageryCategories).mockRejectedValue(new Error("boom"));
    const res = await GET(jsonRequest("GET"));
    expect(res.status).toBe(500);
  });
});

describe("POST /api/admin/imagery/categories", () => {
  it("name 为空时返回 400", async () => {
    const res = await POST(jsonRequest("POST", { name: "" }));
    expect(res.status).toBe(400);
  });

  it("parent_id 为非正整数时返回 400", async () => {
    const res = await POST(
      jsonRequest("POST", { name: "分类", parent_id: -1 }),
    );
    expect(res.status).toBe(400);
  });

  it("层级超限（MAX_DEPTH_EXCEEDED）时映射为 400 而不是 500", async () => {
    vi.mocked(createImageryCategory).mockRejectedValue(
      Object.assign(new Error("分类最多支持 3 层"), {
        code: "MAX_DEPTH_EXCEEDED",
      }),
    );
    const res = await POST(
      jsonRequest("POST", { name: "子分类", parent_id: 1 }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("分类最多支持 3 层");
  });

  it("其他未预期错误时返回 500，不泄露内部错误码", async () => {
    vi.mocked(createImageryCategory).mockRejectedValue(new Error("db down"));
    const res = await POST(jsonRequest("POST", { name: "分类" }));
    expect(res.status).toBe(500);
  });

  it("经 Authorization header 鉴权通过、但 cookie session 缺失时返回 401（不会带着空 token 调用 service 层）", async () => {
    // withAuth 支持用 Authorization header 鉴权（不依赖 cookie session）。
    // 这条路径下，路由自己再查一次 supabase.auth.getSession() 时可能拿不到
    // cookie session —— 这里验证这种不一致场景会被安全地拦截。
    mockSessionAccessToken = null;
    const request = new NextRequest(
      "http://localhost/api/admin/imagery/categories",
      {
        method: "POST",
        body: JSON.stringify({ name: "分类" }),
        headers: {
          "content-type": "application/json",
          authorization: "Bearer valid.header.token",
        },
      },
    );
    const res = await POST(request);
    expect(res.status).toBe(401);
    expect(createImageryCategory).not.toHaveBeenCalled();
  });

  it("创建成功返回新分类", async () => {
    vi.mocked(createImageryCategory).mockResolvedValue({
      id: 1,
      name: "分类",
      parent_id: null,
      level: 1,
    } as never);
    const res = await POST(jsonRequest("POST", { name: "分类" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ id: 1, name: "分类" });
  });
});
