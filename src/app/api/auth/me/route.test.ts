import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { makeQueryBuilder } from "@/test/mockSupabase";

let mockUser: {
  id: string;
  email?: string;
  app_metadata?: Record<string, unknown>;
} | null = { id: "user-1", email: "someone@example.com" };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mockRow: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mockRowError: any = null;

vi.mock("@/lib/db/supabase-auth", () => ({
  createSupabaseServerClient: vi.fn(async () => ({
    auth: {
      getSession: vi.fn(async () => ({
        data: { session: mockUser ? { access_token: "t" } : null },
      })),
      getUser: vi.fn(async () => ({ data: { user: mockUser } })),
    },
    from: vi.fn(() => makeQueryBuilder({ data: mockRow, error: mockRowError })),
  })),
}));

import { GET } from "./route";

const request = () =>
  new NextRequest("http://localhost/api/auth/me", { method: "GET" });

beforeEach(() => {
  mockUser = { id: "user-1", email: "someone@example.com" };
  mockRow = {
    name: "荼靡",
    display: true,
    intro: "简介",
    is_admin: false,
    is_super: false,
    can_stream: false,
  };
  mockRowError = null;
});

describe("GET /api/auth/me", () => {
  it("未登录返回 401", async () => {
    mockUser = null;
    expect((await GET(request())).status).toBe(401);
  });

  it("返回资料，权益只给出布尔值", async () => {
    mockRow = { ...mockRow, can_stream: true };

    const res = await GET(request());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.name).toBe("荼靡");
    expect(body.hasBenefits).toBe(true);
    expect(body).not.toHaveProperty("can_stream");
  });

  it("没有试听权益时 hasBenefits 为 false", async () => {
    expect((await (await GET(request())).json()).hasBenefits).toBe(false);
  });

  it("用户表无对应行时回退为默认值而非报错", async () => {
    mockRow = null;
    const body = await (await GET(request())).json();
    expect(body.name).toBe("未设置用户名");
    expect(body.isAdmin).toBe(false);
    expect(body.hasBenefits).toBe(false);
  });

  it("查询出错时不泄漏数据库原始错误", async () => {
    mockRowError = { message: 'column "can_stream" does not exist' };
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const res = await GET(request());
    const body = JSON.stringify(await res.json());

    expect(res.status).toBe(500);
    expect(body).not.toContain("can_stream");
    spy.mockRestore();
  });
});
