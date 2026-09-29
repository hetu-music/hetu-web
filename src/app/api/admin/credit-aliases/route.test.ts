import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

let mockUser: { id: string; app_metadata?: Record<string, unknown> } | null =
  null;

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

vi.mock("@/lib/server/server-revalidate", () => ({
  refreshSongPages: vi.fn(async () => undefined),
}));

vi.mock("@/lib/server/service-credit-aliases", () => ({
  listCreditAliases: vi.fn(),
  listCreditNames: vi.fn(),
  createCreditAlias: vi.fn(),
  deleteCreditAlias: vi.fn(),
  getPublishedSongIdsCreditedAs: vi.fn(async () => [3, 7]),
}));

import { refreshSongPages } from "@/lib/server/server-revalidate";
import {
  createCreditAlias,
  deleteCreditAlias,
  listCreditAliases,
  listCreditNames,
} from "@/lib/server/service-credit-aliases";
import { DELETE, GET, POST } from "./route";

const URL = "http://localhost/api/admin/credit-aliases";

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
  mockUser = { id: "a1", app_metadata: { is_admin: true, is_super: false } };
});

describe("GET /api/admin/credit-aliases", () => {
  it("普通用户被拒绝", async () => {
    mockUser = { id: "u1", app_metadata: {} };
    const res = await GET(request("GET"));
    expect(res.status).toBe(403);
  });

  it("管理员（非超管）可以读取别名与署名用法", async () => {
    vi.mocked(listCreditAliases).mockResolvedValue([
      { alias: "萧忆情Alex", name: "萧忆情", created_at: "" },
    ]);
    vi.mocked(listCreditNames).mockResolvedValue([
      { name: "萧忆情Alex", songs: 2, roles: ["artist"] },
    ]);
    const res = await GET(request("GET"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.aliases).toHaveLength(1);
    expect(body.names[0].songs).toBe(2);
    expect(listCreditAliases).toHaveBeenCalledWith("test-token");
  });
});

describe("POST /api/admin/credit-aliases", () => {
  it("去掉首尾空白后登记，并刷新署有该别名的歌曲页面", async () => {
    vi.mocked(createCreditAlias).mockResolvedValue({
      alias: "萧忆情Alex",
      name: "萧忆情",
      created_at: "",
    });
    const res = await POST(
      request("POST", { alias: " 萧忆情Alex ", name: "萧忆情" }),
    );
    expect(res.status).toBe(200);
    expect(createCreditAlias).toHaveBeenCalledWith(
      "萧忆情Alex",
      "萧忆情",
      "test-token",
    );
    expect(refreshSongPages).toHaveBeenCalledWith([3, 7]);
  });

  it("别名与主名相同时 400，不写库", async () => {
    const res = await POST(request("POST", { alias: "河图", name: "河图 " }));
    expect(res.status).toBe(400);
    expect(createCreditAlias).not.toHaveBeenCalled();
  });

  it("数据库拒绝的情形映射成 4xx 并带回原因", async () => {
    vi.mocked(createCreditAlias).mockRejectedValue(
      Object.assign(new Error("「萧忆情Alex」已登记过别名"), {
        code: "ALIAS_EXISTS",
      }),
    );
    const res = await POST(
      request("POST", { alias: "萧忆情Alex", name: "萧忆情" }),
    );
    expect(res.status).toBe(409);
    expect((await res.json()).error).toContain("已登记过");
    expect(refreshSongPages).not.toHaveBeenCalled();
  });

  it("其他错误返回 500，不外泄细节", async () => {
    vi.mocked(createCreditAlias).mockRejectedValue(new Error("boom"));
    const res = await POST(request("POST", { alias: "a", name: "b" }));
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe("登记失败");
  });
});

describe("DELETE /api/admin/credit-aliases", () => {
  it("删除后刷新页面", async () => {
    vi.mocked(deleteCreditAlias).mockResolvedValue(true);
    const res = await DELETE(
      request(
        "DELETE",
        undefined,
        `?alias=${encodeURIComponent("萧忆情Alex")}`,
      ),
    );
    expect(res.status).toBe(200);
    expect(deleteCreditAlias).toHaveBeenCalledWith("萧忆情Alex", "test-token");
    expect(refreshSongPages).toHaveBeenCalledWith([3, 7]);
  });

  it("别名不存在时 404", async () => {
    vi.mocked(deleteCreditAlias).mockResolvedValue(false);
    const res = await DELETE(request("DELETE", undefined, "?alias=x"));
    expect(res.status).toBe(404);
  });

  it("缺少别名参数时 400", async () => {
    const res = await DELETE(request("DELETE"));
    expect(res.status).toBe(400);
  });
});
