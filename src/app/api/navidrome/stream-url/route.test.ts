import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { makeQueryBuilder } from "@/test/mockSupabase";

let mockUser: { id: string } | null = { id: "user-1" };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mockUserRow: any = {
  navid_id: "navi-user",
  navid_pw: "navi-pass",
  endpoint: "https://pre.example.com/",
};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mockUserRowError: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mockNavidRow: any = { navid_id: "track-abc" };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mockNavidError: any = null;
let mockServiceClientAvailable = true;

vi.mock("@/lib/db/supabase-auth", () => ({
  createSupabaseServerClient: vi.fn(async () => ({
    auth: {
      getSession: vi.fn(async () => ({
        data: { session: mockUser ? { access_token: "test-token" } : null },
      })),
      getUser: vi.fn(async () => ({ data: { user: mockUser } })),
    },
    from: vi.fn(() =>
      makeQueryBuilder({ data: mockUserRow, error: mockUserRowError }),
    ),
  })),
}));

vi.mock("@/lib/db/supabase-server", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/db/supabase-server")>();
  return {
    ...actual,
    getServiceClient: vi.fn(() =>
      mockServiceClientAvailable
        ? {
            from: vi.fn(() =>
              makeQueryBuilder({ data: mockNavidRow, error: mockNavidError }),
            ),
          }
        : null,
    ),
  };
});

import { GET } from "./route";

function makeRequest(query = "?songId=42") {
  return new NextRequest(`http://localhost/api/navidrome/stream-url${query}`, {
    method: "GET",
  });
}

beforeEach(() => {
  mockUser = { id: "user-1" };
  mockUserRow = {
    navid_id: "navi-user",
    navid_pw: "navi-pass",
    endpoint: "https://pre.example.com/",
  };
  mockUserRowError = null;
  mockNavidRow = { navid_id: "track-abc" };
  mockNavidError = null;
  mockServiceClientAvailable = true;
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: true,
      json: async () => ({
        "subsonic-response": { song: { duration: 245 } },
      }),
    })),
  );
});

afterEach(() => vi.unstubAllGlobals());

describe("GET /api/navidrome/stream-url — 访问控制", () => {
  it("未登录返回 401", async () => {
    mockUser = null;
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
  });

  it("用户未配置 Navidrome 凭证时返回 403", async () => {
    mockUserRow = { navid_id: null, navid_pw: null, endpoint: null };
    const res = await GET(makeRequest());
    expect(res.status).toBe(403);
  });

  it("仅缺少 endpoint 也返回 403", async () => {
    mockUserRow = {
      navid_id: "navi-user",
      navid_pw: "navi-pass",
      endpoint: null,
    };
    expect((await GET(makeRequest())).status).toBe(403);
  });
});

describe("GET /api/navidrome/stream-url — 参数与数据", () => {
  it("缺少 songId 返回 400", async () => {
    const res = await GET(makeRequest(""));
    expect(res.status).toBe(400);
  });

  it("songId 非数字返回 400", async () => {
    const res = await GET(makeRequest("?songId=abc"));
    expect(res.status).toBe(400);
  });

  it("该歌曲没有对应音频映射时返回 404", async () => {
    mockNavidRow = { navid_id: null };
    const res = await GET(makeRequest());
    expect(res.status).toBe(404);
  });

  it("service client 不可用时返回 503", async () => {
    mockServiceClientAvailable = false;
    const res = await GET(makeRequest());
    expect(res.status).toBe(503);
  });
});

describe("GET /api/navidrome/stream-url — 串流地址", () => {
  it("返回带盐值鉴权参数的串流地址，且不泄漏明文密码", async () => {
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);

    const body = (await res.json()) as { url: string; duration: number | null };
    const url = new URL(body.url);

    expect(url.origin + url.pathname).toBe(
      "https://pre.example.com/rest/stream",
    );
    expect(url.searchParams.get("u")).toBe("navi-user");
    expect(url.searchParams.get("id")).toBe("track-abc");
    expect(url.searchParams.get("format")).toBe("opus");
    // t 为 md5(密码+盐)，s 为盐；明文密码不得出现在 URL 中
    expect(url.searchParams.get("t")).toMatch(/^[0-9a-f]{32}$/);
    expect(url.searchParams.get("s")).toMatch(/^[0-9a-f]+$/);
    expect(body.url).not.toContain("navi-pass");
  });

  it("endpoint 末尾斜杠不会产生双斜杠", async () => {
    mockUserRow = { ...mockUserRow, endpoint: "https://pre.example.com/" };
    const body = (await (await GET(makeRequest())).json()) as { url: string };
    expect(body.url).not.toContain("com//rest");
  });

  it("带上 Navidrome 返回的时长", async () => {
    const body = (await (await GET(makeRequest())).json()) as {
      duration: number | null;
    };
    expect(body.duration).toBe(245);
  });

  it("获取时长失败时降级为 null，不影响播放地址", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network down");
      }),
    );
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const body = (await res.json()) as { url: string; duration: number | null };
    expect(body.duration).toBeNull();
    expect(body.url).toContain("/rest/stream");
  });

  it("传入 timeOffset 时写入取整后的秒数", async () => {
    const body = (await (
      await GET(makeRequest("?songId=42&timeOffset=63.8"))
    ).json()) as { url: string };
    expect(new URL(body.url).searchParams.get("timeOffset")).toBe("63");
  });

  it("timeOffset 为 0 或负数时不写入该参数", async () => {
    const body = (await (
      await GET(makeRequest("?songId=42&timeOffset=0"))
    ).json()) as { url: string };
    expect(new URL(body.url).searchParams.has("timeOffset")).toBe(false);
  });

  it("每次请求使用不同的盐值", async () => {
    const first = (await (await GET(makeRequest())).json()) as { url: string };
    const second = (await (await GET(makeRequest())).json()) as { url: string };
    const saltOf = (u: string) => new URL(u).searchParams.get("s");
    expect(saltOf(first.url)).not.toBe(saltOf(second.url));
  });
});
