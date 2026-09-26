import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { chatJson, isLlmConfigured, LlmError } from "./llm";

const request = {
  system: "sys",
  user: "user",
  schemaName: "test",
  schema: { type: "object" },
};

function reply(content: string | null, finish = "stop") {
  return new Response(
    JSON.stringify({
      choices: [{ finish_reason: finish, message: { content } }],
    }),
    { status: 200 },
  );
}

beforeEach(() => {
  vi.stubEnv("LLM_API_KEY", "key");
  vi.stubEnv("LLM_MODEL", "gemini-test");
  vi.stubEnv("LLM_BASE_URL", "");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("isLlmConfigured", () => {
  it("缺少 key 或模型时视为未配置", () => {
    expect(isLlmConfigured()).toBe(true);
    vi.stubEnv("LLM_MODEL", "");
    expect(isLlmConfigured()).toBe(false);
  });
});

describe("chatJson", () => {
  it("默认发往 Gemini 的 OpenAI 兼容端点，带 JSON Schema", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(reply('{"ok":true}'));
    expect(await chatJson(request)).toEqual({ ok: true });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(
      "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
    );
    expect((init?.headers as Record<string, string>).Authorization).toBe(
      "Bearer key",
    );
    const body = JSON.parse(init?.body as string);
    expect(body.model).toBe("gemini-test");
    expect(body.response_format).toEqual({
      type: "json_schema",
      json_schema: { name: "test", schema: { type: "object" }, strict: true },
    });
  });

  it("LLM_BASE_URL 可替换端点，末尾斜杠会被去掉", async () => {
    vi.stubEnv("LLM_BASE_URL", "https://example.com/v1/");
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(reply("{}"));
    await chatJson(request);
    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://example.com/v1/chat/completions",
    );
  });

  it("去掉包裹 JSON 的代码块", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      reply('```json\n{"a":1}\n```'),
    );
    expect(await chatJson(request)).toEqual({ a: 1 });
  });

  it("未配置时不发请求", async () => {
    vi.stubEnv("LLM_API_KEY", "");
    const fetchMock = vi.spyOn(globalThis, "fetch");
    await expect(chatJson(request)).rejects.toMatchObject({
      code: "NOT_CONFIGURED",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("HTTP 错误时抛 LlmError，不外传响应体", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("secret detail", { status: 429 }),
    );
    const error = await chatJson(request).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(LlmError);
    expect((error as LlmError).message).toBe("LLM 请求失败（HTTP 429）");
  });

  it("输出被截断时给出明确提示", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      reply('{"verdicts": [', "length"),
    );
    await expect(chatJson(request)).rejects.toThrow("LLM 输出被截断");
  });

  it("没有返回内容时抛错", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(reply(null));
    await expect(chatJson(request)).rejects.toMatchObject({
      code: "BAD_RESPONSE",
    });
  });
});
