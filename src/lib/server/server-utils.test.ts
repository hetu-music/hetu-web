import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  clearAuthCookies,
  generateCSRFToken,
  getCSRFCookie,
  purgeCloudflareCache,
  purgeEdgeOneCache,
  safeCompareSecret,
  serverErrorResponse,
  setCSRFCookie,
  verifyCSRFToken,
  verifyTurnstileToken,
} from "./server-utils";

// ─── mock next/headers 的 cookies() ────────────────────────────────────────
// 测试环境不在真实的 Next.js 请求作用域内，用一个内存 Map 模拟 cookie jar。
// vi.mock 会被 Vitest 自动提升到文件顶部，先于上面的 import 执行。
const cookieStore = new Map<string, string>();
let mockThrowOnCookies = false;

function makeCookieJar() {
  return {
    get: (name: string) => {
      const value = cookieStore.get(name);
      return value === undefined ? undefined : { value };
    },
    getAll: () =>
      Array.from(cookieStore.entries()).map(([name, value]) => ({
        name,
        value,
      })),
    set: (name: string, value: string) => {
      cookieStore.set(name, value);
    },
    delete: (arg: string | { name: string }) => {
      const name = typeof arg === "string" ? arg : arg.name;
      cookieStore.delete(name);
    },
  };
}

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => {
    if (mockThrowOnCookies) throw new Error("no request scope");
    return makeCookieJar();
  }),
}));

function makeRequest(headerToken?: string): Request {
  const headers = new Headers();
  if (headerToken !== undefined) headers.set("x-csrf-token", headerToken);
  return { headers } as unknown as Request;
}

describe("verifyCSRFToken", () => {
  beforeEach(() => {
    cookieStore.clear();
    mockThrowOnCookies = false;
  });

  it("cookie 与 header 一致时通过", async () => {
    cookieStore.set("csrf-token", "abc123");
    expect(await verifyCSRFToken(makeRequest("abc123"))).toBe(true);
  });

  it("cookie 与 header 不一致时拒绝", async () => {
    cookieStore.set("csrf-token", "abc123");
    expect(await verifyCSRFToken(makeRequest("wrong-token"))).toBe(false);
  });

  it("缺少 header 时拒绝", async () => {
    cookieStore.set("csrf-token", "abc123");
    expect(await verifyCSRFToken(makeRequest())).toBe(false);
  });

  it("缺少 cookie 时拒绝", async () => {
    expect(await verifyCSRFToken(makeRequest("abc123"))).toBe(false);
  });

  it("header 为空白字符串时拒绝（不能用空白绕过校验）", async () => {
    cookieStore.set("csrf-token", "abc123");
    expect(await verifyCSRFToken(makeRequest("   "))).toBe(false);
  });

  it("cookie 为空白字符串时拒绝", async () => {
    cookieStore.set("csrf-token", "   ");
    expect(await verifyCSRFToken(makeRequest("   "))).toBe(false);
  });

  it("支持传入 plain object 形式的 headers（非 Headers 实例）", async () => {
    cookieStore.set("csrf-token", "abc123");
    const result = await verifyCSRFToken({
      headers: { "x-csrf-token": "abc123" },
    });
    expect(result).toBe(true);
  });

  it("读取 cookie 本身抛异常时降级为校验失败，不向上抛出", async () => {
    mockThrowOnCookies = true;
    expect(await verifyCSRFToken(makeRequest("abc123"))).toBe(false);
  });
});

describe("generateCSRFToken", () => {
  it("生成 64 位十六进制字符串（32 字节）", () => {
    const token = generateCSRFToken();
    expect(token).toMatch(/^[0-9a-f]{64}$/);
  });

  it("每次调用生成不同的 token", () => {
    expect(generateCSRFToken()).not.toBe(generateCSRFToken());
  });
});

describe("setCSRFCookie / getCSRFCookie", () => {
  beforeEach(() => {
    cookieStore.clear();
    mockThrowOnCookies = false;
  });

  it("写入后可以读回相同的 token", async () => {
    await setCSRFCookie("my-token");
    expect(await getCSRFCookie()).toBe("my-token");
  });

  it("未设置时读取返回 undefined", async () => {
    expect(await getCSRFCookie()).toBeUndefined();
  });
});

describe("clearAuthCookies", () => {
  beforeEach(() => {
    cookieStore.clear();
    mockThrowOnCookies = false;
  });

  it("清除所有 sb- 前缀 cookie 和 csrf-token，保留其他 cookie", async () => {
    cookieStore.set("sb-access-token", "token-value");
    cookieStore.set("sb-refresh-token", "refresh-value");
    cookieStore.set("csrf-token", "csrf-value");
    cookieStore.set("theme", "dark"); // 无关 cookie，不应被清除

    await clearAuthCookies();

    expect(cookieStore.get("sb-access-token")).toBe("");
    expect(cookieStore.get("sb-refresh-token")).toBe("");
    expect(cookieStore.get("csrf-token")).toBe("");
    expect(cookieStore.get("theme")).toBe("dark");
  });
});

describe("verifyTurnstileToken", () => {
  beforeEach(() => {
    vi.stubEnv("TURNSTILE_SECRET_KEY", "test-secret");
    vi.stubGlobal("fetch", vi.fn());
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("缺少 token 时直接拒绝，不发起请求", async () => {
    const result = await verifyTurnstileToken("");
    expect(result.success).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("缺少密钥配置时拒绝", async () => {
    vi.stubEnv("TURNSTILE_SECRET_KEY", "");
    const result = await verifyTurnstileToken("some-token");
    expect(result.success).toBe(false);
    expect(result.error).toBe("服务器配置错误");
  });

  it("Cloudflare 返回 success:true 时通过", async () => {
    vi.mocked(fetch).mockResolvedValue({
      json: async () => ({ success: true }),
    } as Response);

    const result = await verifyTurnstileToken("valid-token");
    expect(result.success).toBe(true);
    expect(fetch).toHaveBeenCalledWith(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("Cloudflare 返回 success:false 时携带 errorCodes", async () => {
    vi.mocked(fetch).mockResolvedValue({
      json: async () => ({
        success: false,
        "error-codes": ["invalid-input-response"],
      }),
    } as Response);

    const result = await verifyTurnstileToken("bad-token");
    expect(result.success).toBe(false);
    expect(result.errorCodes).toEqual(["invalid-input-response"]);
  });

  it("网络请求异常时降级为失败而不抛异常", async () => {
    vi.mocked(fetch).mockRejectedValue(new Error("network down"));
    const result = await verifyTurnstileToken("token");
    expect(result.success).toBe(false);
    expect(result.error).toBe("验证服务异常");
  });
});

describe("purgeCloudflareCache", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("环境变量未配置时跳过，不发起请求", async () => {
    vi.stubEnv("CLOUDFLARE_ZONE_ID", "");
    vi.stubEnv("CLOUDFLARE_API_TOKEN", "");
    await purgeCloudflareCache(["/"]);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("环境变量齐全时按 zoneId 拼接 purge_cache 请求，携带 Bearer token", async () => {
    vi.stubEnv("CLOUDFLARE_ZONE_ID", "zone123");
    vi.stubEnv("CLOUDFLARE_API_TOKEN", "token456");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://example.com");
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({}),
    } as Response);

    await purgeCloudflareCache(["/song/1", "/"]);

    expect(fetch).toHaveBeenCalledWith(
      "https://api.cloudflare.com/client/v4/zones/zone123/purge_cache",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "Bearer token456" }),
      }),
    );
    const [, init = {}] = vi.mocked(fetch).mock.calls[0];
    const body = JSON.parse(init.body as string);
    expect(body.files).toEqual([
      "https://example.com/song/1",
      "https://example.com/",
    ]);
  });

  it("Cloudflare 返回非 2xx 时记录失败但不抛异常（不影响调用方主流程）", async () => {
    vi.stubEnv("CLOUDFLARE_ZONE_ID", "zone123");
    vi.stubEnv("CLOUDFLARE_API_TOKEN", "token456");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://example.com");
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      text: async () => "invalid token",
    } as Response);

    await expect(purgeCloudflareCache(["/"])).resolves.toBeUndefined();
  });

  it("fetch 本身抛异常（网络故障）时不向上抛出", async () => {
    vi.stubEnv("CLOUDFLARE_ZONE_ID", "zone123");
    vi.stubEnv("CLOUDFLARE_API_TOKEN", "token456");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://example.com");
    vi.mocked(fetch).mockRejectedValue(new Error("network down"));

    await expect(purgeCloudflareCache(["/"])).resolves.toBeUndefined();
  });
});

describe("purgeEdgeOneCache", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("环境变量未配置时跳过，不发起请求", async () => {
    vi.stubEnv("EDGEONE_SECRET_ID", "");
    await purgeEdgeOneCache(["/"]);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("环境变量齐全时提交带 TC3 签名的请求", async () => {
    vi.stubEnv("EDGEONE_SECRET_ID", "id123");
    vi.stubEnv("EDGEONE_SECRET_KEY", "key456");
    vi.stubEnv("EDGEONE_ZONE_ID", "zone789");
    vi.stubEnv("EDGEONE_SITE_URL", "https://example.com");
    vi.mocked(fetch).mockResolvedValue({
      json: async () => ({ Response: { JobId: "job-1" } }),
    } as Response);

    await purgeEdgeOneCache(["/song/1"]);

    expect(fetch).toHaveBeenCalledWith(
      "https://teo.intl.tencentcloudapi.com",
      expect.objectContaining({ method: "POST" }),
    );
    const [, init = {}] = vi.mocked(fetch).mock.calls[0];
    const headers = init.headers as Record<string, string>;
    expect(headers["X-TC-Action"]).toBe("CreatePurgeTask");
    expect(headers.Authorization).toMatch(
      /^TC3-HMAC-SHA256 Credential=id123\//,
    );
    const body = JSON.parse(init.body as string);
    expect(body.Targets).toEqual(["https://example.com/song/1"]);
  });

  it("EdgeOne 返回业务错误（Response.Error）时记录失败但不抛异常", async () => {
    vi.stubEnv("EDGEONE_SECRET_ID", "id123");
    vi.stubEnv("EDGEONE_SECRET_KEY", "key456");
    vi.stubEnv("EDGEONE_ZONE_ID", "zone789");
    vi.stubEnv("EDGEONE_SITE_URL", "https://example.com");
    vi.mocked(fetch).mockResolvedValue({
      json: async () => ({
        Response: { Error: { Code: "AuthFailure", Message: "签名错误" } },
      }),
    } as Response);

    await expect(purgeEdgeOneCache(["/"])).resolves.toBeUndefined();
  });

  it("fetch 本身抛异常时不向上抛出", async () => {
    vi.stubEnv("EDGEONE_SECRET_ID", "id123");
    vi.stubEnv("EDGEONE_SECRET_KEY", "key456");
    vi.stubEnv("EDGEONE_ZONE_ID", "zone789");
    vi.stubEnv("EDGEONE_SITE_URL", "https://example.com");
    vi.mocked(fetch).mockRejectedValue(new Error("network down"));

    await expect(purgeEdgeOneCache(["/"])).resolves.toBeUndefined();
  });
});

describe("safeCompareSecret", () => {
  it("相同字符串返回 true", () => {
    expect(safeCompareSecret("s3cret-value", "s3cret-value")).toBe(true);
  });

  it("不同字符串返回 false", () => {
    expect(safeCompareSecret("s3cret-value", "s3cret-valu3")).toBe(false);
  });

  it("长度不同也不抛异常，返回 false", () => {
    expect(safeCompareSecret("short", "a-much-longer-secret")).toBe(false);
  });

  it("任一侧为空/未定义时返回 false", () => {
    expect(safeCompareSecret(null, "x")).toBe(false);
    expect(safeCompareSecret("x", undefined)).toBe(false);
    expect(safeCompareSecret("", "")).toBe(false);
  });
});

describe("serverErrorResponse", () => {
  it("响应体不含原始数据库错误信息", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const dbError = {
      message: 'relation "users" does not exist',
      code: "42P01",
    };

    const res = serverErrorResponse("GET /api/test", dbError);
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(JSON.stringify(body)).not.toContain("users");
    expect(JSON.stringify(body)).not.toContain("42P01");
    expect(body.error).toBe("服务器错误，请稍后重试");
    spy.mockRestore();
  });

  it("原始错误写入服务端日志", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const dbError = { message: 'column "navid_pw" does not exist' };

    serverErrorResponse("PUT /api/test", dbError);

    expect(spy).toHaveBeenCalledWith("[PUT /api/test]", dbError);
    spy.mockRestore();
  });

  it("可自定义客户端文案与状态码", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const res = serverErrorResponse("X", new Error("boom"), "更新失败", 503);
    expect(res.status).toBe(503);
    expect((await res.json()).error).toBe("更新失败");
    spy.mockRestore();
  });
});
