import { describe, it, expect } from "vitest";
import { extractLyricsSnippet } from "./useLyricsIndex";

const LYRICS = "举杯邀明月 对影成三人 月既不解饮 影徒随我身";

describe("extractLyricsSnippet", () => {
  it("按 Fuse 给出的区间截取片段", () => {
    // "明月" 在原文中的位置
    const start = LYRICS.indexOf("明月");
    const snippet = extractLyricsSnippet(LYRICS, [[start, start + 1]]);
    expect(snippet).toContain("明月");
  });

  it("多段命中时取最长的一段", () => {
    const shortStart = LYRICS.indexOf("月既");
    const longStart = LYRICS.indexOf("对影成三人");
    const snippet = extractLyricsSnippet(LYRICS, [
      [shortStart, shortStart + 1],
      [longStart, longStart + 4],
    ]);
    expect(snippet).toContain("对影成三人");
  });

  it("区间缺失或为空时返回空串，不再退回按词重搜", () => {
    expect(extractLyricsSnippet(LYRICS, undefined)).toBe("");
    expect(extractLyricsSnippet(LYRICS, [])).toBe("");
  });

  it("歌词为空时返回空串", () => {
    expect(extractLyricsSnippet("", [[0, 1]])).toBe("");
  });

  it("命中在开头时不会越界到负索引", () => {
    const snippet = extractLyricsSnippet(LYRICS, [[0, 1]]);
    expect(snippet.startsWith("举杯")).toBe(true);
  });

  it("命中在结尾时不会越界超出文本长度", () => {
    const last = LYRICS.length - 1;
    const snippet = extractLyricsSnippet(LYRICS, [[last - 1, last]]);
    expect(snippet.endsWith("我身")).toBe(true);
  });
});
