/**
 * 公开只读接口的集中测试：贡献者、歌词、歌词索引、歌曲搜索。
 * 这几个路由都很小且共用同一套 mock，放在一起避免重复搭脚手架。
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { makeQueryBuilder } from "@/test/mockSupabase";

let mockUser: { id: string } | null = { id: "user-1" };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mockResult: any = { data: [], error: null };
let mockServiceAvailable = true;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let lastBuilder: any = null;

vi.mock("@/lib/db/supabase-auth", () => ({
  createSupabaseServerClient: vi.fn(async () => ({
    auth: {
      getSession: vi.fn(async () => ({
        data: { session: mockUser ? { access_token: "t" } : null },
      })),
      getUser: vi.fn(async () => ({ data: { user: mockUser } })),
    },
  })),
}));

vi.mock("@/lib/db/supabase-server", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/db/supabase-server")>();
  return {
    ...actual,
    getServiceClient: vi.fn(() =>
      mockServiceAvailable
        ? {
            from: vi.fn(() => {
              lastBuilder = makeQueryBuilder(mockResult);
              return lastBuilder;
            }),
          }
        : null,
    ),
  };
});

import { GET as getContributors } from "../contributors/route";
import { GET as getLyrics } from "./[id]/lyrics/route";
import { GET as searchSongs } from "./search/route";

beforeEach(() => {
  mockUser = { id: "user-1" };
  mockResult = { data: [], error: null };
  mockServiceAvailable = true;
  lastBuilder = null;
});

describe("GET /api/public/contributors", () => {
  it("只返回 display 为 true 的贡献者，并按 sort_order 排序", async () => {
    mockResult = {
      data: [{ name: "甲", display: true, intro: null, sort_order: 1 }],
      error: null,
    };

    const res = await getContributors();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.contributors).toHaveLength(1);
    expect(lastBuilder.eq).toHaveBeenCalledWith("display", true);
    expect(lastBuilder.order).toHaveBeenCalledWith("sort_order", {
      ascending: true,
    });
  });

  it("service client 不可用时返回 500", async () => {
    mockServiceAvailable = false;
    expect((await getContributors()).status).toBe(500);
  });

  it("查询出错时不泄漏数据库原始错误", async () => {
    mockResult = { data: null, error: { message: 'relation "users" ...' } };
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const res = await getContributors();
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("users");
    spy.mockRestore();
  });
});

describe("GET /api/public/songs/[id]/lyrics", () => {
  const call = (id: string) =>
    getLyrics(new Request("http://localhost"), {
      params: Promise.resolve({ id }),
    });

  it("id 非数字返回 400", async () => {
    expect((await call("abc")).status).toBe(400);
  });

  it("歌曲不存在返回 404", async () => {
    mockResult = { data: null, error: { message: "no rows" } };
    expect((await call("42")).status).toBe(404);
  });

  it("返回歌词并带上 CDN 缓存头", async () => {
    mockResult = { data: { lyrics: "[00:01.00]词" }, error: null };

    const res = await call("42");

    expect(res.status).toBe(200);
    expect((await res.json()).lyrics).toBe("[00:01.00]词");
    expect(res.headers.get("Cache-Control")).toContain("s-maxage=21600");
  });

  it("歌曲存在但没有歌词时返回 null 而非 404", async () => {
    mockResult = { data: { lyrics: null }, error: null };
    const res = await call("42");
    expect(res.status).toBe(200);
    expect((await res.json()).lyrics).toBeNull();
  });
});

describe("GET /api/public/songs/search", () => {
  const call = (query: string) =>
    searchSongs(
      new NextRequest(`http://localhost/api/public/songs/search${query}`),
    );

  it("未登录返回 401", async () => {
    mockUser = null;
    expect((await call("?q=倾")).status).toBe(401);
  });

  it("关键词为空时直接返回空列表，不查库", async () => {
    const res = await call("");
    expect(res.status).toBe(200);
    expect((await res.json()).songs).toEqual([]);
    expect(lastBuilder).toBeNull();
  });

  it("按标题模糊匹配", async () => {
    mockResult = { data: [{ id: 1, title: "倾尽天下" }], error: null };

    const res = await call("?q=倾尽");

    expect(res.status).toBe(200);
    expect((await res.json()).songs).toHaveLength(1);
    expect(lastBuilder.ilike).toHaveBeenCalledWith("title", "%倾尽%");
  });

  it("limit 最大不超过 20", async () => {
    await call("?q=倾&limit=999");
    expect(lastBuilder.limit).toHaveBeenCalledWith(20);
  });

  it("limit 最小为 1，非法值回退到默认", async () => {
    await call("?q=倾&limit=0");
    expect(lastBuilder.limit).toHaveBeenCalledWith(1);
  });
});
