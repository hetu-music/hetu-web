import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * csrf.ts 持有模块级缓存，每个用例都要拿一份全新的模块实例，
 * 否则上一个用例缓存下来的 token 会影响后续断言。
 */
async function freshModule() {
  vi.resetModules();
  return import("./csrf");
}

function mockTokenResponse(token: unknown, ok = true) {
  return vi.fn(async () => ({
    ok,
    json: async () => (token === undefined ? {} : { csrfToken: token }),
  })) as unknown as typeof fetch;
}

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("getCsrfToken", () => {
  it("首次调用向接口获取 token", async () => {
    const fetchMock = mockTokenResponse("token-abc");
    vi.stubGlobal("fetch", fetchMock);
    const { getCsrfToken } = await freshModule();

    expect(await getCsrfToken()).toBe("token-abc");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith("/api/public/csrf-token", {
      cache: "no-store",
    });
  });

  it("后续调用复用缓存，不再发请求", async () => {
    const fetchMock = mockTokenResponse("token-abc");
    vi.stubGlobal("fetch", fetchMock);
    const { getCsrfToken } = await freshModule();

    await getCsrfToken();
    await getCsrfToken();
    await getCsrfToken();

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  // 这是把四处独立获取收敛成一处的关键行为：并发时只能有一个请求在飞
  it("并发调用共享同一个进行中的请求", async () => {
    let resolveFetch: (value: unknown) => void = () => undefined;
    const pending = new Promise((resolve) => {
      resolveFetch = resolve;
    });
    const fetchMock = vi.fn(async () => {
      await pending;
      return { ok: true, json: async () => ({ csrfToken: "token-xyz" }) };
    });
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);
    const { getCsrfToken } = await freshModule();

    const all = Promise.all([getCsrfToken(), getCsrfToken(), getCsrfToken()]);
    resolveFetch(undefined);

    expect(await all).toEqual(["token-xyz", "token-xyz", "token-xyz"]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("接口返回非 2xx 时抛错", async () => {
    vi.stubGlobal("fetch", mockTokenResponse("x", false));
    const { getCsrfToken } = await freshModule();
    await expect(getCsrfToken()).rejects.toThrow("获取 CSRF Token 失败");
  });

  it("响应里没有 csrfToken 字段时抛错", async () => {
    vi.stubGlobal("fetch", mockTokenResponse(undefined));
    const { getCsrfToken } = await freshModule();
    await expect(getCsrfToken()).rejects.toThrow("CSRF Token 缺失");
  });

  it("失败后不会把失败的请求缓存住，下次可重试成功", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, json: async () => ({}) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ csrfToken: "token-retry" }),
      });
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);
    const { getCsrfToken } = await freshModule();

    await expect(getCsrfToken()).rejects.toThrow();
    expect(await getCsrfToken()).toBe("token-retry");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe("resetCsrfToken", () => {
  it("清掉缓存后会重新获取", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ csrfToken: "first" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ csrfToken: "second" }),
      });
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);
    const { getCsrfToken, resetCsrfToken } = await freshModule();

    expect(await getCsrfToken()).toBe("first");
    resetCsrfToken();
    expect(await getCsrfToken()).toBe("second");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
