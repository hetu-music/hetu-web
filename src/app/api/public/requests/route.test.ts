import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { makeQueryBuilder } from "@/test/mockSupabase";

let mockUser: { id: string; app_metadata?: Record<string, unknown> } | null = {
  id: "user-1",
};
let mockCsrfValid = true;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mockFromBuilders: any[] = [];
let fromCallIndex = 0;

vi.mock("@/lib/db/supabase-auth", () => ({
  createSupabaseServerClient: vi.fn(async () => ({
    auth: {
      getSession: vi.fn(async () => ({
        data: { session: mockUser ? { access_token: "t" } : null },
      })),
      getUser: vi.fn(async () => ({ data: { user: mockUser } })),
    },
    from: vi.fn(() => {
      const builder =
        mockFromBuilders[Math.min(fromCallIndex, mockFromBuilders.length - 1)];
      fromCallIndex += 1;
      return builder;
    }),
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
  return { ...actual, getServiceClient: vi.fn(() => null) };
});

import { POST } from "./route";

function makeRequest(body: unknown) {
  return new NextRequest("http://localhost/api/public/requests", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

beforeEach(() => {
  mockUser = { id: "user-1" };
  mockCsrfValid = true;
  mockFromBuilders = [];
  fromCallIndex = 0;
});

describe("POST /api/public/requests — 校验", () => {
  it("未登录返回 401", async () => {
    mockUser = null;
    const res = await POST(
      makeRequest({ type: "song_feedback", song_id: 1, content: "有错字" }),
    );
    expect(res.status).toBe(401);
  });

  it("CSRF 校验失败返回 403", async () => {
    mockCsrfValid = false;
    const res = await POST(
      makeRequest({ type: "song_feedback", song_id: 1, content: "有错字" }),
    );
    expect(res.status).toBe(403);
  });

  it("未知的请求类型返回 400", async () => {
    const res = await POST(
      makeRequest({ type: "not_a_type", content: "内容" }),
    );
    expect(res.status).toBe(400);
  });

  it("内容为空返回 400", async () => {
    const res = await POST(makeRequest({ type: "benefit_apply", content: "" }));
    expect(res.status).toBe(400);
  });

  it("内容超过 2000 字返回 400", async () => {
    const res = await POST(
      makeRequest({ type: "benefit_apply", content: "字".repeat(2001) }),
    );
    expect(res.status).toBe(400);
  });

  it("歌曲纠错缺少 song_id 返回 400", async () => {
    const res = await POST(
      makeRequest({ type: "song_feedback", content: "有错字" }),
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain("歌曲");
  });
});

describe("POST /api/public/requests — 重复申请守卫", () => {
  it("已有同类待处理申请时返回 409", async () => {
    mockFromBuilders = [
      makeQueryBuilder({ data: { id: "existing-id" }, error: null }),
    ];
    const res = await POST(
      makeRequest({ type: "benefit_apply", content: "申请试听权限" }),
    );
    expect(res.status).toBe(409);
  });

  it("没有待处理申请时创建成功并返回 201", async () => {
    mockFromBuilders = [
      makeQueryBuilder({ data: null, error: null }), // 查重：无结果
      makeQueryBuilder({ data: { id: "new-id" }, error: null }), // 插入
    ];
    const res = await POST(
      makeRequest({ type: "benefit_apply", content: "申请试听权限" }),
    );
    expect(res.status).toBe(201);
  });

  // 纠错可以提多条，不受待处理申请限制
  it("歌曲纠错不做重复限制，可连续提交", async () => {
    mockFromBuilders = [
      makeQueryBuilder({ data: { id: "created" }, error: null }),
    ];
    const res = await POST(
      makeRequest({ type: "song_feedback", song_id: 7, content: "第二处错字" }),
    );
    expect(res.status).toBe(201);
  });
});
