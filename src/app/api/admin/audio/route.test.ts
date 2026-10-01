import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

let mockUser: { id: string; app_metadata?: Record<string, unknown> } | null;
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

vi.mock("@/lib/server/service-navidrome", () => ({
  getAudioOverview: vi.fn(),
  runAudioSync: vi.fn(),
  updateAudioMapping: vi.fn(),
  audioErrorResponse: vi.fn((_scope: string, error: unknown) =>
    Response.json({ error: (error as Error).message }, { status: 503 }),
  ),
}));

import {
  getAudioOverview,
  runAudioSync,
  updateAudioMapping,
} from "@/lib/server/service-navidrome";
import { PUT } from "./mapping/route";
import { GET } from "./route";
import { POST } from "./sync/route";

function request(method: string, body?: unknown) {
  return new NextRequest("http://localhost/api/admin/audio", {
    method,
    body:
      body === undefined
        ? undefined
        : typeof body === "string"
          ? body
          : JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockUser = {
    id: "super-1",
    app_metadata: { is_admin: true, is_super: true },
  };
  mockCsrfValid = true;
});

describe("超级管理员限定", () => {
  const plainAdmin = {
    id: "u1",
    app_metadata: { is_admin: true, is_super: false },
  };

  it.each([
    ["GET", () => GET(request("GET"))],
    ["POST sync", () => POST(request("POST"))],
    ["PUT mapping", () => PUT(request("PUT", { songId: 1, navidId: "a" }))],
  ])("普通管理员访问 %s 返回 403", async (_name, call) => {
    mockUser = plainAdmin;
    const res = await call();
    expect(res.status).toBe(403);
    expect(getAudioOverview).not.toHaveBeenCalled();
    expect(runAudioSync).not.toHaveBeenCalled();
    expect(updateAudioMapping).not.toHaveBeenCalled();
  });

  it("未登录返回 401", async () => {
    mockUser = null;
    expect((await GET(request("GET"))).status).toBe(401);
  });

  it("写操作缺少有效 CSRF token 时返回 403", async () => {
    mockCsrfValid = false;
    expect((await POST(request("POST"))).status).toBe(403);
    expect(runAudioSync).not.toHaveBeenCalled();
  });
});

describe("GET /api/admin/audio", () => {
  it("返回概览", async () => {
    vi.mocked(getAudioOverview).mockResolvedValue({
      library: [],
      songs: [],
      mappings: [],
      plan: {} as never,
    });
    const res = await GET(request("GET"));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ library: [] });
  });

  it("服务出错时交给 audioErrorResponse", async () => {
    vi.mocked(getAudioOverview).mockRejectedValue(new Error("未配置"));
    const res = await GET(request("GET"));
    expect(res.status).toBe(503);
  });
});

describe("POST /api/admin/audio/sync", () => {
  it("执行同步并返回结果", async () => {
    vi.mocked(runAudioSync).mockResolvedValue({
      upserted: 2,
      deleted: 1,
      mediaUpdated: 0,
      hasAudioChanged: [3],
    });
    const res = await POST(request("POST"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      upserted: 2,
      deleted: 1,
      mediaUpdated: 0,
      hasAudioChanged: [3],
    });
  });

  it("服务出错时交给 audioErrorResponse", async () => {
    vi.mocked(runAudioSync).mockRejectedValue(new Error("x"));
    expect((await POST(request("POST"))).status).toBe(503);
  });
});

describe("PUT /api/admin/audio/mapping", () => {
  it("关联曲目", async () => {
    vi.mocked(updateAudioMapping).mockResolvedValue({ nav: null });
    const res = await PUT(request("PUT", { songId: 1, navidId: " a " }));
    expect(res.status).toBe(200);
    expect(updateAudioMapping).toHaveBeenCalledWith(1, "a");
  });

  it("navidId 为 null 表示解除关联", async () => {
    vi.mocked(updateAudioMapping).mockResolvedValue({ nav: null });
    await PUT(request("PUT", { songId: 1, navidId: null }));
    expect(updateAudioMapping).toHaveBeenCalledWith(1, null);
  });

  it.each([
    ["非法 JSON", "{"],
    ["缺少 navidId", { songId: 1 }],
    ["songId 不是正整数", { songId: -1, navidId: "a" }],
    ["navidId 为空串", { songId: 1, navidId: "  " }],
  ])("%s 时返回 400", async (_name, body) => {
    const res = await PUT(request("PUT", body));
    expect(res.status).toBe(400);
    expect(updateAudioMapping).not.toHaveBeenCalled();
  });

  it("服务出错时交给 audioErrorResponse", async () => {
    vi.mocked(updateAudioMapping).mockRejectedValue(new Error("x"));
    const res = await PUT(request("PUT", { songId: 1, navidId: "a" }));
    expect(res.status).toBe(503);
  });
});
