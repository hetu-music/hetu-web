import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

let mockUser: { id: string; app_metadata?: Record<string, unknown> } | null = {
  id: "admin-1",
  app_metadata: { is_admin: true },
};
let mockCsrfValid = true;

vi.mock("@/lib/db/supabase-auth", () => ({
  createSupabaseServerClient: vi.fn(async () => ({
    auth: {
      getSession: vi.fn(async () => ({
        data: {
          session: mockUser ? { access_token: "test-token" } : null,
        },
      })),
      getUser: vi.fn(async () => ({ data: { user: mockUser } })),
    },
  })),
}));

vi.mock("@/lib/server/server-utils", () => ({
  verifyCSRFToken: vi.fn(async () => mockCsrfValid),
}));

vi.mock("@/lib/server/service-songs", () => ({
  getSongs: vi.fn(),
  createSong: vi.fn(),
  updateSong: vi.fn(),
}));

import { getSongs, createSong, updateSong } from "@/lib/server/service-songs";
import { GET, POST, PUT } from "./route";

function jsonRequest(method: string, body?: unknown) {
  return new NextRequest("http://localhost/api/admin/edit", {
    method,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    headers: { "content-type": "application/json" },
  });
}

beforeEach(() => {
  mockUser = { id: "admin-1", app_metadata: { is_admin: true } };
  mockCsrfValid = true;
  vi.mocked(getSongs).mockReset();
  vi.mocked(createSong).mockReset();
  vi.mocked(updateSong).mockReset();
});

describe("GET /api/admin/edit", () => {
  it("非 admin 用户被拒绝（withAuth 网关）", async () => {
    mockUser = { id: "u1", app_metadata: { is_admin: false } };
    const res = await GET(jsonRequest("GET"));
    expect(res.status).toBe(403);
  });

  it("正常返回歌曲列表", async () => {
    vi.mocked(getSongs).mockResolvedValue([{ id: 1 }] as never);
    const res = await GET(jsonRequest("GET"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([{ id: 1 }]);
  });

  it("service 层抛异常时返回 500 而不是让异常冒泡", async () => {
    vi.mocked(getSongs).mockRejectedValue(new Error("db down"));
    const res = await GET(jsonRequest("GET"));
    expect(res.status).toBe(500);
  });
});

describe("POST /api/admin/edit", () => {
  it("CSRF 校验失败时拒绝", async () => {
    mockCsrfValid = false;
    const res = await POST(jsonRequest("POST", { title: "新歌" }));
    expect(res.status).toBe(403);
  });

  it("缺少必填 title 时返回 400 及中文提示", async () => {
    const res = await POST(jsonRequest("POST", { album: "专辑" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/[一-鿿]/);
  });

  it("请求体不是合法 JSON 时返回 400", async () => {
    const res = await POST(
      new NextRequest("http://localhost/api/admin/edit", {
        method: "POST",
        body: "{oops",
        headers: { "content-type": "application/json" },
      }),
    );
    expect(res.status).toBe(400);
  });

  it("非法 URL 字段时返回 400", async () => {
    const res = await POST(
      jsonRequest("POST", { title: "新歌", kugolink: "not-a-url" }),
    );
    expect(res.status).toBe(400);
  });

  it("合法数据创建成功", async () => {
    vi.mocked(createSong).mockResolvedValue({ id: 1, title: "新歌" } as never);
    const res = await POST(jsonRequest("POST", { title: "新歌" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ id: 1, title: "新歌" });
  });
});

describe("PUT /api/admin/edit", () => {
  it("缺少 id 时返回 400", async () => {
    const res = await PUT(jsonRequest("PUT", { title: "改名" }));
    expect(res.status).toBe(400);
  });

  it("id 不是正整数时返回 400", async () => {
    const res = await PUT(jsonRequest("PUT", { id: -1, title: "改名" }));
    expect(res.status).toBe(400);
  });

  it("id 是浮点数时返回 400", async () => {
    const res = await PUT(jsonRequest("PUT", { id: 1.5, title: "改名" }));
    expect(res.status).toBe(400);
  });

  it("乐观锁冲突（updateSong 抛 409）时映射为友好提示", async () => {
    const conflictError = Object.assign(new Error("乐观锁冲突"), {
      status: 409,
    });
    vi.mocked(updateSong).mockRejectedValue(conflictError);
    const res = await PUT(
      jsonRequest("PUT", { id: 1, title: "改名", updated_at: "2024-01-01" }),
    );
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toBe("数据已被他人修改，请刷新页面后重试");
  });

  it("其他更新错误时返回 500", async () => {
    vi.mocked(updateSong).mockRejectedValue(new Error("db error"));
    const res = await PUT(jsonRequest("PUT", { id: 1, title: "改名" }));
    expect(res.status).toBe(500);
  });

  it("更新成功时返回最新数据", async () => {
    vi.mocked(updateSong).mockResolvedValue({ id: 1, title: "改名" } as never);
    const res = await PUT(jsonRequest("PUT", { id: 1, title: "改名" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ id: 1, title: "改名" });
  });
});
