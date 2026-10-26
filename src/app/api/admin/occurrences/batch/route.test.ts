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
  getOccurrencesForSong: vi.fn(async () => []),
}));

vi.mock("@/lib/server/server-revalidate", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/server/server-revalidate")>()),
  refreshImagery: vi.fn(async () => ({ failed: [] })),
}));

import {
  createOccurrencesBatch,
  getOccurrencesForSong,
} from "@/lib/server/service-imagery";
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
  category_id: 10,
};

beforeEach(() => {
  mockUser = { id: "admin-1", app_metadata: { is_admin: true } };
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

  it("写入后按这首歌现有的标注刷新缓存", async () => {
    vi.mocked(createOccurrencesBatch).mockResolvedValue({
      created: 1,
      skipped: 0,
      newImagery: 0,
    });
    vi.mocked(getOccurrencesForSong).mockResolvedValue([
      { imagery_id: 1 },
      { imagery_id: 7 },
    ] as Awaited<ReturnType<typeof getOccurrencesForSong>>);
    await POST(post({ song_id: 5, items: [validItem] }));
    expect(refreshImagery).toHaveBeenCalledWith({
      songIds: [5],
      imageryIds: [1, 7],
    });
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
        items: [{ imagery_name: " 孤灯 ", category_id: 10 }],
      }),
    );
    expect(res.status).toBe(200);
    expect(createOccurrencesBatch).toHaveBeenCalledWith(
      5,
      [{ imagery_name: "孤灯", category_id: 10 }],
      "test-token",
    );
  });

  it.each([
    ["空列表", { song_id: 5, items: [] }],
    [
      "新意象名为空",
      { song_id: 5, items: [{ imagery_name: "  ", category_id: 10 }] },
    ],
    [
      "既无 imagery_id 也无 imagery_name",
      { song_id: 5, items: [{ category_id: 10 }] },
    ],
  ])("%s 时返回 400", async (_, body) => {
    const res = await POST(post(body));
    expect(res.status).toBe(400);
    expect(createOccurrencesBatch).not.toHaveBeenCalled();
  });

  it("歌曲未发布时返回 400 和可读的错误信息", async () => {
    vi.mocked(createOccurrencesBatch).mockRejectedValue(
      Object.assign(new Error("歌曲尚未发布，发布后才能保存意象标注"), {
        code: "SONG_NOT_PUBLISHED",
      }),
    );
    const res = await POST(post({ song_id: 5, items: [validItem] }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain("尚未发布");
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
