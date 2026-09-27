import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fetchNavidromeLibrary,
  fetchNavidromeSong,
  navidromeConfigFromEnv,
  NavidromeError,
} from "./client";

const config = { url: "https://nav.example.com", user: "u", password: "p" };

function subsonic(body: Record<string, unknown>, status = "ok") {
  return {
    ok: true,
    json: async () => ({ "subsonic-response": { status, ...body } }),
  };
}

function mockFetch(...responses: unknown[]) {
  const fn = vi.fn();
  for (const r of responses) fn.mockResolvedValueOnce(r);
  vi.stubGlobal("fetch", fn);
  return fn;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("navidromeConfigFromEnv", () => {
  it("读取三个环境变量并去掉 URL 末尾的斜杠", () => {
    expect(
      navidromeConfigFromEnv({
        NAVIDROME_URL: "https://nav.example.com/",
        NAVIDROME_USER: "u",
        NAVIDROME_PASSWORD: "p#1",
      }),
    ).toEqual({ url: "https://nav.example.com", user: "u", password: "p#1" });
  });

  it("任一变量缺失时返回 null", () => {
    expect(navidromeConfigFromEnv({ NAVIDROME_URL: "x" })).toBeNull();
  });
});

describe("fetchNavidromeLibrary", () => {
  it("分页拉取全部曲目并只保留需要的字段", async () => {
    const page = Array.from({ length: 500 }, (_, i) => ({
      id: `s${i}`,
      title: `t${i}`,
      bitRate: 320,
    }));
    const fetch = mockFetch(
      subsonic({ searchResult3: { song: page } }),
      subsonic({ searchResult3: { song: [{ id: "last", title: "末" }] } }),
    );

    const songs = await fetchNavidromeLibrary(config);

    expect(songs).toHaveLength(501);
    expect(songs[0]).not.toHaveProperty("bitRate");
    const secondUrl = new URL(fetch.mock.calls[1][0]);
    expect(secondUrl.pathname).toBe("/rest/search3");
    expect(secondUrl.searchParams.get("songOffset")).toBe("500");
    expect(secondUrl.searchParams.get("query")).toBe("");
    // 使用 token 认证，不在 URL 里带明文密码
    expect(secondUrl.searchParams.get("p")).toBeNull();
    expect(secondUrl.searchParams.get("t")).toMatch(/^[0-9a-f]{32}$/);
  });

  it("空曲库返回空数组", async () => {
    mockFetch(subsonic({ searchResult3: {} }));
    expect(await fetchNavidromeLibrary(config)).toEqual([]);
  });

  it("Subsonic 返回错误时抛出 NavidromeError", async () => {
    mockFetch(
      subsonic(
        { error: { code: 40, message: "Wrong username or password" } },
        "failed",
      ),
    );
    await expect(fetchNavidromeLibrary(config)).rejects.toMatchObject({
      name: "NavidromeError",
      code: 40,
      message: expect.stringContaining("Wrong username or password"),
    });
  });

  it("HTTP 失败时抛出 NavidromeError", async () => {
    mockFetch({ ok: false, status: 502 });
    await expect(fetchNavidromeLibrary(config)).rejects.toBeInstanceOf(
      NavidromeError,
    );
  });
});

describe("fetchNavidromeSong", () => {
  it("返回曲目", async () => {
    mockFetch(subsonic({ song: { id: "a", title: "歌", duration: 10 } }));
    expect(await fetchNavidromeSong(config, "a")).toMatchObject({
      id: "a",
      duration: 10,
    });
  });

  it("曲目不存在（错误码 70）时返回 null", async () => {
    mockFetch(
      subsonic({ error: { code: 70, message: "not found" } }, "failed"),
    );
    expect(await fetchNavidromeSong(config, "gone")).toBeNull();
  });

  it("其他错误照常抛出", async () => {
    mockFetch(subsonic({ error: { code: 40, message: "auth" } }, "failed"));
    await expect(fetchNavidromeSong(config, "a")).rejects.toBeInstanceOf(
      NavidromeError,
    );
  });
});
