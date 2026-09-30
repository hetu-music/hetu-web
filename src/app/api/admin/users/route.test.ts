import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import {
  createMockSupabaseClient,
  makeQueryBuilder,
} from "@/test/mockSupabase";

let mockUser: { id: string; app_metadata?: Record<string, unknown> } | null = {
  id: "super-1",
  app_metadata: { is_admin: true, is_super: true },
};
let mockCsrfValid = true;

vi.mock("@/lib/db/supabase-auth", () => ({
  createSupabaseServerClient: vi.fn(async () => ({
    auth: {
      getSession: vi.fn(async () => ({
        data: { session: mockUser ? { access_token: "test-token" } : null },
      })),
      getUser: vi.fn(async () => ({ data: { user: mockUser } })),
    },
  })),
}));

vi.mock("@/lib/server/server-utils", () => ({
  verifyCSRFToken: vi.fn(async () => mockCsrfValid),
}));

vi.mock("@/lib/db/supabase-server", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/db/supabase-server")>();
  return { ...actual, getServiceClient: vi.fn() };
});

import { getServiceClient } from "@/lib/db/supabase-server";
import { GET, PUT } from "./route";

function jsonRequest(method: string, body?: unknown) {
  return new NextRequest("http://localhost/api/admin/users", {
    method,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    headers: { "content-type": "application/json" },
  });
}

const VALID_UUID = "123e4567-e89b-12d3-a456-426614174000";

beforeEach(() => {
  mockUser = {
    id: "super-1",
    app_metadata: { is_admin: true, is_super: true },
  };
  mockCsrfValid = true;
  vi.mocked(getServiceClient).mockReset();
});

describe("GET /api/admin/users", () => {
  it("普通 admin（非 super）被拒绝", async () => {
    mockUser = { id: "u1", app_metadata: { is_admin: true, is_super: false } };
    const res = await GET(jsonRequest("GET"));
    expect(res.status).toBe(403);
  });

  it("service client 不可用时返回 503", async () => {
    vi.mocked(getServiceClient).mockReturnValue(null);
    const res = await GET(jsonRequest("GET"));
    expect(res.status).toBe(503);
  });

  it("superAdmin 正常获取用户列表", async () => {
    vi.mocked(getServiceClient).mockReturnValue(
      createMockSupabaseClient([
        makeQueryBuilder({ data: [{ id: "u1", name: "张三" }], error: null }),
      ]),
    );
    const res = await GET(jsonRequest("GET"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.users).toEqual([{ id: "u1", name: "张三" }]);
  });
});

describe("PUT /api/admin/users（防止超管权限被误撤销）", () => {
  it("id 不是合法 UUID 时返回 400", async () => {
    const res = await PUT(jsonRequest("PUT", { id: "not-a-uuid" }));
    expect(res.status).toBe(400);
  });

  it("不提供任何更新字段时返回 400", async () => {
    const res = await PUT(jsonRequest("PUT", { id: VALID_UUID }));
    expect(res.status).toBe(400);
  });

  it("试图撤销超级管理员的 is_admin 时拒绝", async () => {
    vi.mocked(getServiceClient).mockReturnValue(
      createMockSupabaseClient([
        // 第一次查询：目标用户 is_super
        makeQueryBuilder({ data: { is_super: true }, error: null }),
      ]),
    );
    const res = await PUT(
      jsonRequest("PUT", { id: VALID_UUID, is_admin: false }),
    );
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe("不能撤销超级管理员的管理权限");
  });

  it("撤销普通管理员的 is_admin 时允许", async () => {
    vi.mocked(getServiceClient).mockReturnValue(
      createMockSupabaseClient([
        makeQueryBuilder({ data: { is_super: false }, error: null }), // 目标用户不是超管
        makeQueryBuilder({ data: null, error: null }), // 更新
      ]),
    );
    const res = await PUT(
      jsonRequest("PUT", { id: VALID_UUID, is_admin: false }),
    );
    expect(res.status).toBe(200);
  });

  it("不再保存 Navidrome 密码：旧客户端传来的 navid_pw 被忽略", async () => {
    const client = createMockSupabaseClient([
      makeQueryBuilder({ data: null, error: null }),
    ]);
    vi.mocked(getServiceClient).mockReturnValue(client);

    await PUT(
      jsonRequest("PUT", { id: VALID_UUID, name: "新名字", navid_pw: "x" }),
    );

    const builder = client.from.mock.results[0].value;
    const updateCall = builder.update.mock.calls[0][0];
    expect(updateCall).not.toHaveProperty("navid_pw");
    expect(updateCall).toMatchObject({ name: "新名字" });
  });

  it("收回权益：can_stream 写入 false，旧的账号字段被忽略", async () => {
    const client = createMockSupabaseClient([
      makeQueryBuilder({ data: null, error: null }),
    ]);
    vi.mocked(getServiceClient).mockReturnValue(client);

    await PUT(
      jsonRequest("PUT", {
        id: VALID_UUID,
        can_stream: false,
        navid_id: null,
        endpoint: null,
      }),
    );

    const builder = client.from.mock.results[0].value;
    const updateCall = builder.update.mock.calls[0][0];
    expect(updateCall).toEqual({ can_stream: false });
  });
});
