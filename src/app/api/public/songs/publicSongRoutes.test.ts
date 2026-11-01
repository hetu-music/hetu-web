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
import { GET as getLyricsLines } from "./lyrics-lines/route";
import {
  lyricsVersion,
  resetLyricsLinesMemoForTests,
} from "@/lib/server/service-lyrics-lines";
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

  it("歌曲不存在返回 404，错误响应不进缓存", async () => {
    mockResult = { data: null, error: { message: "no rows" } };
    const res = await call("42");
    expect(res.status).toBe(404);
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
    expect((await call("abc")).headers.get("Cache-Control")).toBe(
      "private, no-store",
    );
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

describe("GET /api/public/songs/lyrics-lines", () => {
  const call = (query: string) =>
    getLyricsLines(
      new NextRequest(
        `http://localhost/api/public/songs/lyrics-lines?${query}`,
      ),
    );
  const LYRICS = [
    "[00:01.00]倾尽天下",
    "[00:03.00]作词：Vagary",
    "[00:20.00]血染江山的画",
    "[00:25.00]怎敌你眉间一点朱砂",
  ].join("\n");

  beforeEach(() => {
    resetLyricsLinesMemoForTests();
    mockResult = {
      data: [
        { id: 1, title: "倾尽天下", lyrics: LYRICS, lyrics_start: null },
        { id: 2, title: "空", lyrics: "", lyrics_start: null },
      ],
      error: null,
    };
  });

  it("按句切好，去掉署名区；没有句子的歌不返回", async () => {
    const body = await (await call("locale=zh-CN")).json();
    expect(body).toEqual([
      { id: 1, lines: ["血染江山的画", "怎敌你眉间一点朱砂"] },
    ]);
  });

  it("繁体逐句转换，句数不变", async () => {
    const body = await (await call("locale=zh-TW")).json();
    expect(body[0].lines).toEqual(["血染江山的畫", "怎敵你眉間一點硃砂"]);
  });

  it("版本号和当前数据对得上才长缓存；对不上、不带时只短暂缓存，Service Worker 也不存", async () => {
    // 这份假数据里没有 updated_at，当前版本号就是空表算出来的
    const current = lyricsVersion(new Map());
    const ok = await call(`locale=zh-CN&v=${current}`);
    expect(ok.headers.get("Cache-Control")).toContain("immutable");
    expect(ok.headers.get("X-Lyrics-Version-Match")).toBe("1");
    for (const query of ["locale=zh-CN&v=old", "locale=zh-CN"]) {
      const res = await call(query);
      expect(res.headers.get("Cache-Control")).not.toContain("immutable");
      expect(res.headers.get("X-Lyrics-Version-Match")).toBe("0");
      expect((await res.json())[0].id).toBe(1);
    }
  });

  it("service client 不可用时返回 500", async () => {
    mockServiceAvailable = false;
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const res = await call("locale=zh-CN");
    expect(res.status).toBe(500);
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
    spy.mockRestore();
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
