import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { z } from "zod";

let mockUser: { id: string; app_metadata?: Record<string, unknown> } | null =
  null;
let mockCsrfValid = true;
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

vi.mock("@/lib/server/server-utils", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/server/server-utils")>()),
  verifyCSRFToken: vi.fn(async () => mockCsrfValid),
}));

vi.mock("@/lib/server/service-collations", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/server/service-collations")>()),
  createCollation: vi.fn(),
  updateCollation: vi.fn(),
  deleteCollation: vi.fn(),
}));

vi.mock("@/lib/server/server-revalidate", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/server/server-revalidate")>()),
  refreshCollations: vi.fn(async () => ({ failed: [] })),
}));

import {
  CollationError,
  createCollation,
  deleteCollation,
  songRow,
  updateCollation,
} from "@/lib/server/service-collations";
import { refreshCollations } from "@/lib/server/server-revalidate";
import { CDN_PURGE_FAILED_HEADER } from "@/lib/cdn-purge";
import { deleteEntryHandler, entryWriteHandlers } from "./collation-routes";

const ROUTE = "/api/admin/test-entries";
const schema = z.object({ kind: z.literal("note"), body: z.string().min(1) });
const toRow = vi.fn((input: z.infer<typeof schema>) =>
  songRow({ kind: input.kind, date: null, body: input.body }),
);
const { POST, PUT } = entryWriteHandlers(ROUTE, schema, toRow);
const DELETE = deleteEntryHandler(ROUTE);

const entry = { kind: "note", body: "说明" };

function jsonRequest(method: string, body?: unknown) {
  return new NextRequest(`http://localhost${ROUTE}`, {
    method,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    headers: { "content-type": "application/json" },
  });
}

beforeEach(() => {
  mockUser = { id: "admin-1", app_metadata: { is_admin: true } };
  mockCsrfValid = true;
  mockSessionAccessToken = "test-token";
  vi.mocked(createCollation).mockReset();
  vi.mocked(updateCollation).mockReset();
  vi.mocked(deleteCollation).mockReset();
  vi.mocked(refreshCollations).mockClear();
  vi.mocked(refreshCollations).mockResolvedValue({ failed: [] });
  toRow.mockClear();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("鉴权", () => {
  it("非管理员返回 403", async () => {
    mockUser = { id: "u1", app_metadata: {} };
    const res = await POST(jsonRequest("POST", { song_id: 1, entry }));
    expect(res.status).toBe(403);
    expect(createCollation).not.toHaveBeenCalled();
  });

  it("CSRF 校验失败时拒绝", async () => {
    mockCsrfValid = false;
    const res = await DELETE(jsonRequest("DELETE", { id: 1 }));
    expect(res.status).toBe(403);
    expect(deleteCollation).not.toHaveBeenCalled();
  });
});

describe("POST（新增）", () => {
  it("成功时经 toRow 写入、刷新所在歌页并返回新 id", async () => {
    vi.mocked(createCollation).mockResolvedValue(42);
    const res = await POST(jsonRequest("POST", { song_id: 7, entry }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ id: 42 });
    expect(toRow).toHaveBeenCalledWith(entry);
    expect(createCollation).toHaveBeenCalledWith(
      7,
      songRow({ kind: "note", date: null, body: "说明" }),
      "test-token",
    );
    expect(refreshCollations).toHaveBeenCalledWith(7);
    expect(res.headers.get(CDN_PURGE_FAILED_HEADER)).toBeNull();
  });

  it("CDN 刷新失败时在响应头注明", async () => {
    vi.mocked(createCollation).mockResolvedValue(42);
    vi.mocked(refreshCollations).mockResolvedValue({ failed: ["/song/7"] });
    const res = await POST(jsonRequest("POST", { song_id: 7, entry }));
    expect(res.status).toBe(200);
    expect(res.headers.get(CDN_PURGE_FAILED_HEADER)).toBe("/song/7");
  });

  it("song_id 非正整数时返回 400", async () => {
    const res = await POST(jsonRequest("POST", { song_id: 0, entry }));
    expect(res.status).toBe(400);
    expect(createCollation).not.toHaveBeenCalled();
  });

  it("entry 不符合 schema 时返回 400", async () => {
    const res = await POST(
      jsonRequest("POST", { song_id: 7, entry: { kind: "note", body: "" } }),
    );
    expect(res.status).toBe(400);
  });

  it("拿不到会话 token 时返回 401", async () => {
    mockSessionAccessToken = null;
    const res = await POST(jsonRequest("POST", { song_id: 7, entry }));
    expect(res.status).toBe(401);
    expect(createCollation).not.toHaveBeenCalled();
  });

  it("CollationError 按其 status 和 message 返回", async () => {
    vi.mocked(createCollation).mockRejectedValue(
      new CollationError("歌曲尚未发布，发布后才能录入", 400),
    );
    const res = await POST(jsonRequest("POST", { song_id: 7, entry }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "歌曲尚未发布，发布后才能录入" });
    expect(refreshCollations).not.toHaveBeenCalled();
  });

  it("其它异常返回 500，不泄露内部信息", async () => {
    vi.mocked(createCollation).mockRejectedValue(new Error("db down"));
    const res = await POST(jsonRequest("POST", { song_id: 7, entry }));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "保存失败" });
  });
});

describe("PUT（修改）", () => {
  it("成功时刷新 service 返回的那首歌", async () => {
    vi.mocked(updateCollation).mockResolvedValue(9);
    const res = await PUT(jsonRequest("PUT", { id: 3, entry }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
    expect(updateCollation).toHaveBeenCalledWith(
      3,
      expect.objectContaining({ anchor: "song", body: "说明" }),
      "test-token",
    );
    expect(refreshCollations).toHaveBeenCalledWith(9);
  });

  it("缺 id 时返回 400", async () => {
    const res = await PUT(jsonRequest("PUT", { entry }));
    expect(res.status).toBe(400);
  });

  it("拿不到会话 token 时返回 401", async () => {
    mockSessionAccessToken = null;
    const res = await PUT(jsonRequest("PUT", { id: 3, entry }));
    expect(res.status).toBe(401);
  });

  it("记录已不存在时返回 404", async () => {
    vi.mocked(updateCollation).mockRejectedValue(
      new CollationError("这条校记已不存在", 404),
    );
    const res = await PUT(jsonRequest("PUT", { id: 3, entry }));
    expect(res.status).toBe(404);
  });

  it("其它异常返回 500", async () => {
    vi.mocked(updateCollation).mockRejectedValue(new Error("boom"));
    const res = await PUT(jsonRequest("PUT", { id: 3, entry }));
    expect(res.status).toBe(500);
  });
});

describe("DELETE", () => {
  it("成功时刷新 service 返回的那首歌", async () => {
    vi.mocked(deleteCollation).mockResolvedValue(9);
    const res = await DELETE(jsonRequest("DELETE", { id: 3 }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
    expect(deleteCollation).toHaveBeenCalledWith(3, "test-token");
    expect(refreshCollations).toHaveBeenCalledWith(9);
  });

  it("id 非法时返回 400", async () => {
    const res = await DELETE(jsonRequest("DELETE", { id: "x" }));
    expect(res.status).toBe(400);
  });

  it("拿不到会话 token 时返回 401", async () => {
    mockSessionAccessToken = null;
    const res = await DELETE(jsonRequest("DELETE", { id: 3 }));
    expect(res.status).toBe(401);
  });

  it("记录已不存在时返回 404", async () => {
    vi.mocked(deleteCollation).mockRejectedValue(
      new CollationError("这条校记已不存在", 404),
    );
    const res = await DELETE(jsonRequest("DELETE", { id: 3 }));
    expect(res.status).toBe(404);
  });

  it("其它异常返回 500", async () => {
    vi.mocked(deleteCollation).mockRejectedValue(new Error("boom"));
    const res = await DELETE(jsonRequest("DELETE", { id: 3 }));
    expect(res.status).toBe(500);
  });
});
