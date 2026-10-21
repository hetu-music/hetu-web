import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const resetCsrfTokenMock = vi.fn();
vi.mock("@/lib/api/csrf", () => ({
  getCsrfToken: vi.fn(async () => "cached-token"),
  resetCsrfToken: () => resetCsrfTokenMock(),
}));

const addToastMock = vi.fn();
vi.mock("@/components/ui/toast", () => ({
  addToast: (...args: unknown[]) => addToastMock(...args),
}));

import { ApiError, apiRequest, sendRequest } from "./request";

const fetchMock = vi.fn();

function respond(status: number, body?: unknown) {
  fetchMock.mockResolvedValue(
    new Response(body === undefined ? null : JSON.stringify(body), { status }),
  );
}

function sentHeaders(): Record<string, string> {
  return fetchMock.mock.calls[0][1].headers;
}

beforeEach(() => {
  fetchMock.mockReset();
  resetCsrfTokenMock.mockClear();
  addToastMock.mockClear();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("sendRequest", () => {
  it("保存成功但有 CDN 没刷新时提示管理员", async () => {
    fetchMock.mockResolvedValue(
      new Response("{}", {
        status: 200,
        headers: { "x-cdn-purge-failed": "Cloudflare,CloudFront" },
      }),
    );
    await sendRequest("/x", { method: "POST", body: {} });
    expect(addToastMock).toHaveBeenCalledWith(
      "error",
      expect.stringContaining("Cloudflare、CloudFront"),
    );
  });

  it("没有这个响应头时不提示", async () => {
    respond(200, {});
    await sendRequest("/x", { method: "POST", body: {} });
    expect(addToastMock).not.toHaveBeenCalled();
  });

  it("GET 不带请求体，也不取 CSRF 令牌", async () => {
    respond(200, { a: 1 });
    const res = await sendRequest("/x");
    expect(res).toEqual({ ok: true, status: 200, data: { a: 1 } });
    expect(sentHeaders()).toEqual({});
  });

  it("写操作自己取 CSRF 令牌，并把请求体转成 JSON", async () => {
    respond(200, {});
    await sendRequest("/x", { method: "POST", body: { a: 1 } });
    expect(sentHeaders()).toEqual({
      "Content-Type": "application/json",
      "x-csrf-token": "cached-token",
    });
    expect(fetchMock.mock.calls[0][1].body).toBe('{"a":1}');
  });

  it("csrf: true 时 GET 也带上令牌", async () => {
    respond(200, {});
    await sendRequest("/x", { csrf: true });
    expect(sentHeaders()).toEqual({ "x-csrf-token": "cached-token" });
  });

  it("FormData 原样发出，不写 Content-Type（由浏览器带上 boundary）", async () => {
    respond(200, {});
    const form = new FormData();
    form.append("file", "x");
    await sendRequest("/upload", { method: "POST", body: form });
    expect(sentHeaders()).toEqual({ "x-csrf-token": "cached-token" });
    expect(fetchMock.mock.calls[0][1].body).toBe(form);
  });

  it("响应不是 JSON 时 data 为空对象，不抛错", async () => {
    fetchMock.mockResolvedValue(new Response("oops", { status: 502 }));
    expect(await sendRequest("/x")).toEqual({
      ok: false,
      status: 502,
      data: {},
    });
  });

  it("服务端判定 CSRF 令牌失效时丢掉缓存", async () => {
    respond(403, { error: "Invalid CSRF token" });
    await sendRequest("/x", { method: "POST" });
    expect(resetCsrfTokenMock).toHaveBeenCalledTimes(1);
  });

  it("别的 403 不动缓存", async () => {
    respond(403, { error: "Forbidden" });
    await sendRequest("/x", { method: "POST" });
    expect(resetCsrfTokenMock).not.toHaveBeenCalled();
  });
});

describe("apiRequest", () => {
  it("成功时返回响应体", async () => {
    respond(200, [1, 2]);
    expect(await apiRequest("/x", { fallback: "失败" })).toEqual([1, 2]);
  });

  it("默认用 fallback，不把服务端的原文给用户", async () => {
    respond(500, { error: "Internal server error" });
    await expect(apiRequest("/x", { fallback: "获取失败" })).rejects.toThrow(
      "获取失败",
    );
  });

  it("serverMessage: true 时优先用服务端的提示，没有才用 fallback", async () => {
    respond(400, { error: "别名已存在" });
    await expect(
      apiRequest("/x", { fallback: "失败", serverMessage: true }),
    ).rejects.toThrow("别名已存在");

    respond(400, {});
    await expect(
      apiRequest("/x", { fallback: "失败", serverMessage: true }),
    ).rejects.toThrow("失败");
  });

  it("serverMessage 为状态码数组时只在这些状态下用服务端的提示", async () => {
    respond(502, { error: "模型服务暂时不可用" });
    await expect(
      apiRequest("/x", { fallback: "AI 校验失败", serverMessage: [502, 503] }),
    ).rejects.toThrow("模型服务暂时不可用");

    respond(500, { error: "stack trace" });
    await expect(
      apiRequest("/x", { fallback: "AI 校验失败", serverMessage: [502, 503] }),
    ).rejects.toThrow("AI 校验失败");
  });

  it("抛出的 ApiError 带着状态码与错误码", async () => {
    respond(429, { error: "太频繁", code: "over_request_rate_limit" });
    const error: unknown = await apiRequest("/x", { fallback: "失败" }).then(
      () => null,
      (e: unknown) => e,
    );
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 429,
      code: "over_request_rate_limit",
    });
  });
});
