import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

let mockUser: { id: string; app_metadata?: Record<string, unknown> } | null = {
  id: "admin-1",
  app_metadata: { role: "admin" },
};
let mockCsrfValid = true;

vi.mock("@/lib/db/supabase-auth", () => ({
  createSupabaseServerClient: vi.fn(async () => ({
    auth: {
      getSession: vi.fn(async () => ({
        data: { session: { access_token: "test-token" } },
      })),
      getUser: vi.fn(async () => ({ data: { user: mockUser } })),
    },
  })),
}));

vi.mock("@/lib/server/server-utils", () => ({
  verifyCSRFToken: vi.fn(async () => mockCsrfValid),
}));

vi.mock("@/lib/server/service-imagery", () => ({
  createOccurrencesBatch: vi.fn(),
}));

vi.mock("@/lib/server/server-revalidate", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/server/server-revalidate")>()),
  refreshImagery: vi.fn(async () => ({ failed: [] })),
}));

import { createOccurrencesBatch } from "@/lib/server/service-imagery";
import { refreshImagery } from "@/lib/server/server-revalidate";
import { POST } from "./route";

function post(body: unknown) {
  return new NextRequest("http://localhost/api/admin/occurrences/batch", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

const validItem = {
  imagery_id: 1,
  motif_id: 10,
};

beforeEach(() => {
  mockUser = { id: "admin-1", app_metadata: { role: "admin" } };
  mockCsrfValid = true;
  vi.mocked(createOccurrencesBatch).mockReset();
  vi.mocked(refreshImagery).mockClear();
});

describe("POST /api/admin/occurrences/batch", () => {
  it("校验通过时调用 service 并返回结果", async () => {
    const result = { created: 1, skipped: 0, newImagery: 0 };
    vi.mocked(createOccurrencesBatch).mockResolvedValue(result);
    const res = await POST(post({ song_id: 5, items: [validItem] }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(result);
    expect(createOccurrencesBatch).toHaveBeenCalledWith(
      5,
      [validItem],
      "test-token",
    );
  });

  it("写在草稿上，线上不变，不刷新公开页的缓存", async () => {
    vi.mocked(createOccurrencesBatch).mockResolvedValue({
      created: 1,
      skipped: 0,
      newImagery: 0,
    });
    const res = await POST(post({ song_id: 5, items: [validItem] }));
    expect(res.status).toBe(200);
    expect(refreshImagery).not.toHaveBeenCalled();
  });

  it("全部跳过时不刷新缓存", async () => {
    vi.mocked(createOccurrencesBatch).mockResolvedValue({
      created: 0,
      skipped: 1,
      newImagery: 0,
    });
    await POST(post({ song_id: 5, items: [validItem] }));
    expect(refreshImagery).not.toHaveBeenCalled();
  });

  it("接受新意象名并去掉首尾空白", async () => {
    vi.mocked(createOccurrencesBatch).mockResolvedValue({
      created: 1,
      skipped: 0,
      newImagery: 1,
    });
    const res = await POST(
      post({
        song_id: 5,
        items: [{ imagery_name: " 孤灯 ", motif_id: 10 }],
      }),
    );
    expect(res.status).toBe(200);
    expect(createOccurrencesBatch).toHaveBeenCalledWith(
      5,
      [{ imagery_name: "孤灯", motif_id: 10 }],
      "test-token",
    );
  });

  it.each([
    ["空列表", { song_id: 5, items: [] }],
    [
      "新意象名为空",
      { song_id: 5, items: [{ imagery_name: "  ", motif_id: 10 }] },
    ],
    [
      "既无 imagery_id 也无 imagery_name",
      { song_id: 5, items: [{ motif_id: 10 }] },
    ],
  ])("%s 时返回 400", async (_, body) => {
    const res = await POST(post(body));
    expect(res.status).toBe(400);
    expect(createOccurrencesBatch).not.toHaveBeenCalled();
  });

  it("歌曲不存在时返回 404", async () => {
    vi.mocked(createOccurrencesBatch).mockRejectedValue(
      Object.assign(new Error("歌曲不存在"), { code: "SONG_NOT_FOUND" }),
    );
    const res = await POST(post({ song_id: 5, items: [validItem] }));
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe("歌曲不存在");
  });

  it("词不在歌词里时返回 400 和可读的错误信息", async () => {
    vi.mocked(createOccurrencesBatch).mockRejectedValue(
      Object.assign(new Error("歌词里没有「孤灯」"), {
        code: "IMAGERY_NOT_IN_LYRICS",
      }),
    );
    const res = await POST(post({ song_id: 5, items: [validItem] }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain("孤灯");
  });

  it("未知错误返回 500", async () => {
    vi.mocked(createOccurrencesBatch).mockRejectedValue(new Error("boom"));
    const res = await POST(post({ song_id: 5, items: [validItem] }));
    expect(res.status).toBe(500);
  });

  it("CSRF 校验失败时拒绝", async () => {
    mockCsrfValid = false;
    const res = await POST(post({ song_id: 5, items: [validItem] }));
    expect(res.status).toBe(403);
  });

  it("非管理员拒绝", async () => {
    mockUser = { id: "user-1", app_metadata: {} };
    const res = await POST(post({ song_id: 5, items: [validItem] }));
    expect(res.status).toBe(403);
  });
});
