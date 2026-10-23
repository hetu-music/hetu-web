/**
 * 歌曲基调的 AI 预标（规则见 IMAGERY.md「基调」一节）：提示词、输出结构与解析。
 * 纯逻辑，服务端接口与评测脚本共用。
 */
import { z } from "zod";
import type { Emotion } from "@/lib/types";
import { parseLrcLines } from "./suggest";

export const MAX_EMOTIONS = 3;

export interface EmotionSuggestion {
  /** 主基调在前 */
  emotionIds: number[];
  reason: string;
}

export function buildEmotionSystemPrompt(emotions: readonly Emotion[]): string {
  const vocabulary = emotions
    .map((e) => `- ${e.name}（${e.tone}·${e.energy}）：${e.description}`)
    .join("\n");
  return `你是中文歌词的鉴赏助手，为古风歌手河图的作品标注「基调」：整首歌的情绪底色。

只能从下面的词表里选：
${vocabulary}

规则：
1. 选 1 个主基调，另可加 0–2 个副基调；主基调放第一个。副基调只在确实贯穿较多段落时才加，宁缺毋滥。
2. 读完全曲再判断，对白、旁白也算，不要只看副歌或歌名。
3. 怅惘只在整首都在回望时选：歌里的「现在」只是回忆的引子。只有几句提到往事的，往事是思念、执守等的底色，不选怅惘。
4. 思念要有具体的对象（人、故乡）；离愁是分别当下或将要分别的痛；死别、国破这类强烈的痛选悲怆。
5. 以身赴死、慷慨悲凉的歌用「豪迈 + 悲怆」表达。

理由用中文，一句话，不超过 40 字，引歌词里的关键句作依据。`;
}

/** 模型输出的 JSON Schema；基调名限定在词表内 */
export function emotionOutputSchema(emotions: readonly Emotion[]) {
  return {
    type: "object",
    properties: {
      emotions: {
        type: "array",
        items: { type: "string", enum: emotions.map((e) => e.name) },
        description: "主基调在前，最多 3 个",
      },
      reason: { type: "string" },
    },
    required: ["emotions", "reason"],
    additionalProperties: false,
  } as const;
}

/**
 * 歌词正文：有时间轴时去掉制作名单、按文本去重（副歌只留一遍）；
 * 没有时间轴时用原文的非空行。
 */
export function lyricsForPrompt(lyrics: string | null | undefined): string[] {
  const lines = parseLrcLines(lyrics);
  const texts =
    lines.length > 0
      ? lines.map((l) => l.text)
      : (lyrics ?? "")
          .split("\n")
          .map((t) => t.trim())
          .filter(Boolean);
  return [...new Set(texts)];
}

export function buildEmotionPrompt(input: {
  title: string;
  lyrics: string | null | undefined;
}): string {
  return `歌名：${input.title}

## 歌词
${lyricsForPrompt(input.lyrics).join("\n")}`;
}

const outputSchema = z.object({
  emotions: z.array(z.string()),
  reason: z.string(),
});

/** 校验模型输出：去掉词表外与重复的名字，最多取 3 个；一个都不剩时抛错 */
export function parseEmotionOutput(
  raw: unknown,
  emotions: readonly Emotion[],
): EmotionSuggestion {
  const parsed = outputSchema.parse(raw);
  const idByName = new Map(emotions.map((e) => [e.name, e.id]));
  const emotionIds = [
    ...new Set(
      parsed.emotions
        .map((n) => idByName.get(n.trim()))
        .filter((id): id is number => id !== undefined),
    ),
  ].slice(0, MAX_EMOTIONS);
  if (emotionIds.length === 0) throw new Error("模型没有给出词表内的基调");
  return { emotionIds, reason: parsed.reason.trim().slice(0, 80) };
}
