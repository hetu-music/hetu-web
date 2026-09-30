import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { makeQueryBuilder } from "@/test/mockSupabase";

let mockUser: { id: string } | null = { id: "user-1" };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mockUserRow: any = { can_stream: true };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mockUserRowError: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mockNavidRow: any = { navid_id: "track-abc" };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mockNavidError: any = null;
let mockServiceClientAvailable = true;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mockGrant: { data: any; error: any } = { data: "ok", error: null };
const rpc = vi.fn(async () => mockGrant);

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
            rpc,
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

async function getUrl(query?: string) {
  const body = (await (await GET(makeRequest(query))).json()) as {
    url: string;
  };
  return new URL(body.url);
}

beforeEach(() => {
  mockUser = { id: "user-1" };
  mockUserRow = { can_stream: true };
  mockUserRowError = null;
  mockNavidRow = { navid_id: "track-abc" };
  mockNavidError = null;
  mockServiceClientAvailable = true;
  mockGrant = { data: "ok", error: null };
  rpc.mockClear();
  vi.stubEnv("STREAM_BASE_URL", "https://relay.example.com/");
  vi.stubEnv("STREAM_LINK_SECRET", "link-secret");
  vi.stubEnv("NAVIDROME_URL", "http://navidrome.internal:4533");
  vi.stubEnv("NAVIDROME_USER", "svc");
  vi.stubEnv("NAVIDROME_PASSWORD", "svc-pass");
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: true,
      json: async () => ({
        "subsonic-response": {
          status: "ok",
          song: { id: "track-abc", title: "歌", duration: 245 },
        },
      }),
    })),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("GET /api/navidrome/stream-url — 访问控制", () => {
  it("未登录返回 401", async () => {
    mockUser = null;
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
  });

  it("没有试听权益时返回 403", async () => {
    mockUserRow = { can_stream: false };
    const res = await GET(makeRequest());
    expect(res.status).toBe(403);
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

  it("没配签名密钥时返回 503", async () => {
    vi.stubEnv("STREAM_LINK_SECRET", "");
    const res = await GET(makeRequest());
    expect(res.status).toBe(503);
  });
});

describe("GET /api/navidrome/stream-url — 限流", () => {
  it("按用户与歌曲登记，额度由接口传入", async () => {
    await GET(makeRequest());
    expect(rpc).toHaveBeenCalledWith("claim_stream_grant", {
      p_user_id: "user-1",
      p_song_id: 42,
      p_hour_limit: expect.any(Number),
      p_day_limit: expect.any(Number),
    });
  });

  it.each(["hour", "day"])("额度用完（%s）时返回 429", async (window) => {
    mockGrant = { data: window, error: null };
    const res = await GET(makeRequest());
    expect(res.status).toBe(429);
  });

  it("限流查询出错时放行，不挡播放", async () => {
    mockGrant = { data: null, error: { message: "function does not exist" } };
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    spy.mockRestore();
  });
});

describe("GET /api/navidrome/stream-url — 播放链接", () => {
  it("返回中继上的签名路径，不带任何 Navidrome 凭证", async () => {
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const body = (await res.json()) as { url: string };
    const url = new URL(body.url);

    expect(url.origin + url.pathname).toBe(
      "https://relay.example.com/stream/track-abc",
    );
    expect(url.searchParams.get("u")).toBe("user-1");
    expect(url.searchParams.get("e")).toMatch(/^[0-9]+$/);
    expect(url.searchParams.get("s")).toMatch(/^[A-Za-z0-9_-]{22}$/);
    for (const leaked of ["svc", "svc-pass", "link-secret"]) {
      expect(body.url).not.toContain(leaked);
    }
    // 格式、码率由 nginx 固定，浏览器端改不了
    expect(url.searchParams.has("format")).toBe(false);
  });

  it("过期时间按剩余时长加余量计算", async () => {
    const before = Math.floor(Date.now() / 1000);
    const url = await getUrl();
    const expires = Number(url.searchParams.get("e"));
    // 245 秒的歌，外加 1 小时余量
    expect(expires - before).toBeGreaterThanOrEqual(245 + 3600);
    expect(expires - before).toBeLessThanOrEqual(245 + 3600 + 2);
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
    expect(body.url).toContain("/stream/track-abc");
  });

  it("传入 timeOffset 时写入取整后的秒数", async () => {
    const url = await getUrl("?songId=42&timeOffset=63.8");
    expect(url.searchParams.get("t")).toBe("63");
  });

  it("timeOffset 为 0、负数或非数字时不写入该参数", async () => {
    for (const t of ["0", "-5", "abc"]) {
      const url = await getUrl(`?songId=42&timeOffset=${t}`);
      expect(url.searchParams.has("t")).toBe(false);
    }
  });
});
