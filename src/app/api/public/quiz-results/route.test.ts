import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { QUESTIONS, encodeResultSlug } from "@/lib/quiz";

let mockUser: { id: string } | null = null;
// vi.mock 会提升到文件顶部，里面引用的值要用 vi.hoisted 定义
const { SAVED } = vi.hoisted(() => ({
  SAVED: { id: "aB3dE6gH9k", savedAt: "2026-10-28T00:00:00Z" },
}));

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

vi.mock("@/lib/server/server-utils", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/server/server-utils")>();
  return { ...actual, verifyCSRFToken: vi.fn(async () => true) };
});

// 乱码解码用真的，读写数据库的几个函数换成假的
vi.mock("@/lib/server/service-quiz", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/server/service-quiz")>()),
  listQuizRecords: vi.fn(async () => []),
  findQuizRecord: vi.fn(async () => SAVED),
  getQuizResult: vi.fn(async () => ({ slug: "aB3dE6gH9k" })),
  saveQuizRecord: vi.fn(async () => SAVED),
  deleteQuizRecord: vi.fn(async () => undefined),
}));

import {
  deleteQuizRecord,
  findQuizRecord,
  getQuizResult,
  listQuizRecords,
  saveQuizRecord,
} from "@/lib/server/service-quiz";
import { DELETE, GET, POST } from "./route";

const URL = "http://localhost/api/public/quiz-results";
const answers = QUESTIONS.map(() => 1);
const slug = encodeResultSlug(
  answers,
  QUESTIONS.map((q) => q.options.length),
);

function request(method: string, body?: unknown, query = "") {
  return new NextRequest(URL + query, {
    method,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    headers: { "content-type": "application/json" },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  mockUser = { id: "u1" };
});

describe("/api/public/quiz-results", () => {
  it("未登录时 401", async () => {
    mockUser = null;
    expect((await GET(request("GET"))).status).toBe(401);
    expect((await POST(request("POST", { slug }))).status).toBe(401);
    expect(saveQuizRecord).not.toHaveBeenCalled();
  });

  it("GET 带乱码时查这份作答存过的记录", async () => {
    const res = await GET(request("GET", undefined, `?slug=${slug}`));
    expect(await res.json()).toEqual({
      records: [],
      savedId: "aB3dE6gH9k",
      latest: null,
    });
    expect(vi.mocked(findQuizRecord).mock.calls[0].slice(1)).toEqual([
      "u1",
      answers,
    ]);
  });

  it("GET 不带或带坏的乱码时不查", async () => {
    const res = await GET(request("GET", undefined, "?slug=zzzzzzz"));
    expect(await res.json()).toEqual({
      records: [],
      savedId: null,
      latest: null,
    });
    expect(findQuizRecord).not.toHaveBeenCalled();
  });

  it("GET ?latest=1 给出最近一条的完整结果", async () => {
    vi.mocked(listQuizRecords).mockResolvedValueOnce([
      {
        id: "aB3dE6gH9k",
        savedAt: "2026-10-01T00:00:00Z",
        persona: { motto: "仰观天象", label: "天象" },
        secondary: null,
      },
    ]);
    const res = await GET(request("GET", undefined, "?latest=1"));
    expect((await res.json()).latest).toEqual({ slug: "aB3dE6gH9k" });
    expect(getQuizResult).toHaveBeenCalledWith("aB3dE6gH9k", "zh-CN");
  });

  it("POST 解码乱码后保存，返回记录 id", async () => {
    const res = await POST(request("POST", { slug }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(SAVED);
    expect(vi.mocked(saveQuizRecord).mock.calls[0].slice(1)).toEqual([
      "u1",
      answers,
    ]);
  });

  it("POST 乱码无效时 400，算不出结果时 503", async () => {
    expect((await POST(request("POST", { slug: "zzzzzzz" }))).status).toBe(400);
    expect((await POST(request("POST", { slug: "aB3dE6gH9k" }))).status).toBe(
      400,
    );
    expect(saveQuizRecord).not.toHaveBeenCalled();

    vi.mocked(saveQuizRecord).mockResolvedValueOnce(null);
    expect((await POST(request("POST", { slug }))).status).toBe(503);
  });

  it("DELETE 只收 10 位 id", async () => {
    expect((await DELETE(request("DELETE", { id: "short" }))).status).toBe(400);
    const res = await DELETE(request("DELETE", { id: "aB3dE6gH9k" }));
    expect(res.status).toBe(200);
    expect(vi.mocked(deleteQuizRecord).mock.calls[0].slice(1)).toEqual([
      "u1",
      "aB3dE6gH9k",
    ]);
  });

  it("数据库出错时 500，不把原文回给客户端", async () => {
    vi.mocked(saveQuizRecord).mockRejectedValueOnce({
      message: 'duplicate key "quiz_results_pkey"',
    });
    const res = await POST(request("POST", { slug }));
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("quiz_results");
  });
});
