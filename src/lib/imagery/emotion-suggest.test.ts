import { describe, expect, it } from "vitest";
import type { Emotion } from "@/lib/types";
import {
  buildEmotionSystemPrompt,
  emotionOutputSchema,
  lyricsForPrompt,
  parseEmotionOutput,
} from "./emotion-suggest";

const emotions: Emotion[] = [
  {
    id: 1,
    name: "思念",
    description: "念人",
    tone: "暗",
    energy: "抑",
    sort: 1,
  },
  {
    id: 6,
    name: "悲怆",
    description: "死别",
    tone: "暗",
    energy: "扬",
    sort: 6,
  },
  {
    id: 7,
    name: "执守",
    description: "不放手",
    tone: "暗",
    energy: "扬",
    sort: 7,
  },
  {
    id: 8,
    name: "豪迈",
    description: "快意",
    tone: "明",
    energy: "扬",
    sort: 8,
  },
];

describe("lyricsForPrompt", () => {
  it("有时间轴时去掉制作名单，副歌只留一遍", () => {
    expect(
      lyricsForPrompt(
        "[00:01.00]词：河图\n[00:02.00]明月照我\n[00:03.00]风起\n[00:04.00]明月照我",
      ),
    ).toEqual(["明月照我", "风起"]);
  });

  it("没有时间轴时用原文的非空行", () => {
    expect(lyricsForPrompt("明月照我\n\n 风起 ")).toEqual(["明月照我", "风起"]);
    expect(lyricsForPrompt(null)).toEqual([]);
  });
});

describe("提示词与输出结构", () => {
  it("系统提示列出全部基调及其定义，输出只允许词表内的名字", () => {
    const system = buildEmotionSystemPrompt(emotions);
    expect(system).toContain("- 悲怆（暗·扬）：死别");
    expect(
      emotionOutputSchema(emotions).properties.emotions.items.enum,
    ).toEqual(["思念", "悲怆", "执守", "豪迈"]);
  });
});

describe("parseEmotionOutput", () => {
  it("名字映射回 id：去掉词表外的与重复的，最多三个", () => {
    expect(
      parseEmotionOutput(
        {
          emotions: ["悲怆", "怨恨", "悲怆", "执守", "思念", "豪迈"],
          reason: " 血染江山 ",
        },
        emotions,
      ),
    ).toEqual({ emotionIds: [6, 7, 1], reason: "血染江山" });
  });

  it("一个词表内的基调都没有时抛错；结构不符时抛错", () => {
    expect(() =>
      parseEmotionOutput({ emotions: ["怨恨"], reason: "" }, emotions),
    ).toThrow();
    expect(() => parseEmotionOutput({ emotions: "悲怆" }, emotions)).toThrow();
  });
});
