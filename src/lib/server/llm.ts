import { fetchWithTimeout } from "@/lib/utils/utils-common";

/**
 * OpenAI 兼容的 Chat Completions 客户端（POST {LLM_BASE_URL}/chat/completions）。
 *
 * 环境变量：
 *   LLM_API_KEY   必填，以 Bearer 方式发送
 *   LLM_MODEL     必填，如 gemini-3-flash
 *   LLM_BASE_URL  可选，默认 Gemini 的 OpenAI 兼容端点；换成其他兼容服务只改这一项
 *
 * 未配置 key 或模型时，依赖 LLM 的功能在界面上隐藏。
 */
const DEFAULT_BASE_URL =
  "https://generativelanguage.googleapis.com/v1beta/openai";
/** 整首歌词加候选的一次校验，快速模型通常十几秒；留足余量但不无限等待 */
const TIMEOUT_MS = 90_000;

export class LlmError extends Error {
  constructor(
    message: string,
    readonly code: "NOT_CONFIGURED" | "HTTP" | "BAD_RESPONSE",
  ) {
    super(message);
    this.name = "LlmError";
  }
}

function getConfig() {
  const apiKey = process.env.LLM_API_KEY?.trim();
  const model = process.env.LLM_MODEL?.trim();
  if (!apiKey || !model) return null;
  const baseUrl = (
    process.env.LLM_BASE_URL?.trim() || DEFAULT_BASE_URL
  ).replace(/\/+$/, "");
  return { apiKey, model, baseUrl };
}

export function isLlmConfigured(): boolean {
  return getConfig() !== null;
}

/**
 * 发送一次对话并按 JSON Schema 取回结构化结果（已 JSON.parse，未校验结构）。
 */
export async function chatJson(input: {
  system: string;
  user: string;
  schemaName: string;
  schema: object;
}): Promise<unknown> {
  const config = getConfig();
  if (!config) throw new LlmError("未配置 LLM", "NOT_CONFIGURED");

  const res = await fetchWithTimeout(
    `${config.baseUrl}/chat/completions`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages: [
          { role: "system", content: input.system },
          { role: "user", content: input.user },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: input.schemaName,
            schema: input.schema,
            strict: true,
          },
        },
      }),
    },
    TIMEOUT_MS,
  );

  if (!res.ok) {
    // 响应体里可能带有请求回显，只截取开头用于排查，不外传给前端
    const detail = (await res.text().catch(() => "")).slice(0, 500);
    console.error(`[llm] HTTP ${res.status}`, detail);
    throw new LlmError(`LLM 请求失败（HTTP ${res.status}）`, "HTTP");
  }

  const body = (await res.json().catch(() => null)) as {
    choices?: Array<{
      finish_reason?: string;
      message?: { content?: string | null };
    }>;
  } | null;
  const choice = body?.choices?.[0];
  const content = choice?.message?.content;
  if (!content) {
    throw new LlmError(
      `LLM 未返回内容（${choice?.finish_reason ?? "无 finish_reason"}）`,
      "BAD_RESPONSE",
    );
  }
  try {
    // 个别兼容服务会把 JSON 包在 ```json 代码块里
    return JSON.parse(content.replace(/^```(?:json)?\s*|\s*```$/g, ""));
  } catch {
    throw new LlmError(
      choice?.finish_reason === "length"
        ? "LLM 输出被截断"
        : "LLM 返回的不是合法 JSON",
      "BAD_RESPONSE",
    );
  }
}
