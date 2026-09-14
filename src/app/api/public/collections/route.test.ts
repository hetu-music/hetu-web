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
        data: { session: mockUser ? { access_token: "test-token" } : null },
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

vi.mock("@/lib/server/server-utils", () => ({
  verifyCSRFToken: vi.fn(async () => mockCsrfValid),
}));

vi.mock("@/lib/server/service-songs", () => ({
  getSongsByIds: vi.fn(async () => []),
}));

import { getSongsByIds } from "@/lib/server/service-songs";
import { DELETE, GET, POST } from "./route";

function makeRequest(
  method: string,
  body?: unknown,
  cookies?: Record<string, string>,
) {
  const req = new NextRequest("http://localhost/api/public/collections", {
    method,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    headers: { "content-type": "application/json" },
  });
  if (cookies) {
    for (const [name, value] of Object.entries(cookies)) {
      req.cookies.set(name, value);
    }
  }
  return req;
}

beforeEach(() => {
  mockUser = { id: "user-1" };
  mockCsrfValid = true;
  mockFromBuilders = [];
  fromCallIndex = 0;
  vi.mocked(getSongsByIds).mockReset();
  vi.mocked(getSongsByIds).mockResolvedValue([]);
});

describe("GET /api/public/collections", () => {
  it("查询出错时返回 500", async () => {
    mockFromBuilders = [
      makeQueryBuilder({ data: null, error: { message: "boom" } }),
    ];
    const res = await GET(makeRequest("GET"));
    expect(res.status).toBe(500);
  });

  it("没有收藏时直接返回空数组，不查询歌曲数据", async () => {
    mockFromBuilders = [makeQueryBuilder({ data: [], error: null })];
    const res = await GET(makeRequest("GET"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ songIds: [], songs: [] });
    expect(getSongsByIds).not.toHaveBeenCalled();
  });

  it("有收藏时把收藏行信息（review/snippet等）合并进对应歌曲", async () => {
    mockFromBuilders = [
      makeQueryBuilder({
        data: [
          {
            song_id: 1,
            created_at: "2024-01-01",
            review: "很好听",
            snippet: null,
          },
        ],
        error: null,
      }),
    ];
    vi.mocked(getSongsByIds).mockResolvedValue([
      { id: 1, title: "标题" },
    ] as never);

    const res = await GET(makeRequest("GET"));
    const body = await res.json();
    expect(body.songIds).toEqual([1]);
    expect(body.songs[0]).toMatchObject({
      id: 1,
      collectionInfo: { review: "很好听" },
    });
  });
});

describe("POST /api/public/collections", () => {
  it("CSRF 校验失败时拒绝", async () => {
    mockCsrfValid = false;
    const res = await POST(makeRequest("POST", { songId: 1 }));
    expect(res.status).toBe(403);
  });

  it("songId 非法（非正整数）时返回 400", async () => {
    const res = await POST(makeRequest("POST", { songId: 0 }));
    expect(res.status).toBe(400);
  });

  it("songId 非数字时返回 400", async () => {
    const res = await POST(makeRequest("POST", { songId: "abc" }));
    expect(res.status).toBe(400);
  });

  it("重复收藏（唯一约束冲突 23505）时视为成功，而不是报错", async () => {
    mockFromBuilders = [
      makeQueryBuilder({ data: null, error: { code: "23505" } }),
    ];
    const res = await POST(makeRequest("POST", { songId: 1 }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
  });

  it("其他数据库错误时返回 500", async () => {
    mockFromBuilders = [
      makeQueryBuilder({ data: null, error: { code: "OTHER", message: "x" } }),
    ];
    const res = await POST(makeRequest("POST", { songId: 1 }));
    expect(res.status).toBe(500);
  });

  it("正常收藏成功", async () => {
    mockFromBuilders = [makeQueryBuilder({ data: null, error: null })];
    const res = await POST(makeRequest("POST", { songId: 1 }));
    expect(res.status).toBe(200);
  });
});

describe("DELETE /api/public/collections", () => {
  it("songId 非法时返回 400", async () => {
    const res = await DELETE(makeRequest("DELETE", { songId: -1 }));
    expect(res.status).toBe(400);
  });

  it("取消收藏成功", async () => {
    mockFromBuilders = [makeQueryBuilder({ data: null, error: null })];
    const res = await DELETE(makeRequest("DELETE", { songId: 1 }));
    expect(res.status).toBe(200);
  });

  it("数据库出错时返回 500", async () => {
    mockFromBuilders = [
      makeQueryBuilder({ data: null, error: { message: "boom" } }),
    ];
    const res = await DELETE(makeRequest("DELETE", { songId: 1 }));
    expect(res.status).toBe(500);
  });
});
