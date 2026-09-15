import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { makeQueryBuilder } from "@/test/mockSupabase";

let mockUser: {
  id: string;
  app_metadata?: Record<string, unknown>;
} | null = { id: "admin-1", app_metadata: { is_admin: true } };
let mockCsrfValid = true;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mockExistingRequest: any = { type: "song_feedback" };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mockExistingError: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mockUpdateError: any = null;

vi.mock("@/lib/db/supabase-auth", () => ({
  createSupabaseServerClient: vi.fn(async () => ({
    auth: {
      getSession: vi.fn(async () => ({
        data: { session: mockUser ? { access_token: "t" } : null },
      })),
      getUser: vi.fn(async () => ({ data: { user: mockUser } })),
    },
    from: vi.fn(() => makeQueryBuilder({ data: null, error: mockUpdateError })),
  })),
}));

vi.mock("@/lib/server/server-utils", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/server/server-utils")>();
  return { ...actual, verifyCSRFToken: vi.fn(async () => mockCsrfValid) };
});

vi.mock("@/lib/db/supabase-server", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/db/supabase-server")>();
  return {
    ...actual,
    getServiceClient: vi.fn(() => ({
      from: vi.fn(() =>
        makeQueryBuilder({
          data: mockExistingRequest,
          error: mockExistingError,
        }),
      ),
    })),
  };
});

import { PUT } from "./route";

const VALID_ID = "3f2504e0-4f89-11d3-9a0c-0305e82c3301";

function makeRequest(body: unknown) {
  return new NextRequest("http://localhost/api/admin/requests", {
    method: "PUT",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

function validBody(overrides: Record<string, unknown> = {}) {
  return { id: VALID_ID, reply: "已处理", status: "replied", ...overrides };
}

beforeEach(() => {
  mockUser = { id: "admin-1", app_metadata: { is_admin: true } };
  mockCsrfValid = true;
  mockExistingRequest = { type: "song_feedback" };
  mockExistingError = null;
  mockUpdateError = null;
});

describe("PUT /api/admin/requests — 鉴权", () => {
  it("非管理员返回 403", async () => {
    mockUser = { id: "u", app_metadata: { is_admin: false } };
    expect((await PUT(makeRequest(validBody()))).status).toBe(403);
  });

  it("未登录返回 401", async () => {
    mockUser = null;
    expect((await PUT(makeRequest(validBody()))).status).toBe(401);
  });

  it("CSRF 校验失败返回 403", async () => {
    mockCsrfValid = false;
    expect((await PUT(makeRequest(validBody()))).status).toBe(403);
  });
});

describe("PUT /api/admin/requests — 参数校验", () => {
  it("id 非 UUID 返回 400", async () => {
    expect((await PUT(makeRequest(validBody({ id: "123" })))).status).toBe(400);
  });

  it("回复内容为空返回 400", async () => {
    expect((await PUT(makeRequest(validBody({ reply: "" })))).status).toBe(400);
  });

  it("status 取值非法返回 400", async () => {
    expect(
      (await PUT(makeRequest(validBody({ status: "deleted" })))).status,
    ).toBe(400);
  });

  it("请求体不是合法 JSON 返回 400", async () => {
    const res = await PUT(
      new NextRequest("http://localhost/api/admin/requests", {
        method: "PUT",
        body: "not json",
        headers: { "content-type": "application/json" },
      }),
    );
    expect(res.status).toBe(400);
  });
});

describe("PUT /api/admin/requests — 分级权限", () => {
  it("目标请求不存在返回 404", async () => {
    mockExistingRequest = null;
    expect((await PUT(makeRequest(validBody()))).status).toBe(404);
  });

  it("普通管理员可以处理歌曲纠错", async () => {
    mockExistingRequest = { type: "song_feedback" };
    expect((await PUT(makeRequest(validBody()))).status).toBe(200);
  });

  // 权益/管理员申请涉及授权，普通管理员不得处理
  it("普通管理员处理权益申请返回 403", async () => {
    mockExistingRequest = { type: "benefit_apply" };
    const res = await PUT(makeRequest(validBody()));
    expect(res.status).toBe(403);
    expect((await res.json()).error).toContain("权限不足");
  });

  it("普通管理员处理管理员申请返回 403", async () => {
    mockExistingRequest = { type: "admin_apply" };
    expect((await PUT(makeRequest(validBody()))).status).toBe(403);
  });

  it("超级管理员可以处理权益申请", async () => {
    mockUser = {
      id: "super-1",
      app_metadata: { is_admin: true, is_super: true },
    };
    mockExistingRequest = { type: "benefit_apply" };
    expect((await PUT(makeRequest(validBody()))).status).toBe(200);
  });
});

describe("PUT /api/admin/requests — 错误处理", () => {
  it("更新失败时不泄漏数据库原始错误", async () => {
    mockUpdateError = {
      message: 'relation "user_requests" does not exist',
      code: "42P01",
    };
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const res = await PUT(makeRequest(validBody()));
    const body = JSON.stringify(await res.json());

    expect(res.status).toBe(500);
    expect(body).not.toContain("user_requests");
    expect(body).not.toContain("42P01");
    spy.mockRestore();
  });
});
