import { describe, expect, it } from "vitest";
import { isFuzzyTitleMatch, substringDistance } from "./fuzzy";

describe("substringDistance", () => {
  it("完全包含时为 0", () => {
    expect(substringDistance("尽天下", "倾尽天下")).toBe(0);
  });

  it("错一个字、少一个字、多一个字都是 1", () => {
    expect(substringDistance("倾尽天夏", "倾尽天下")).toBe(1);
    expect(substringDistance("朝忆梨花忆雪", "朝忆梨花暮忆雪")).toBe(1);
    expect(substringDistance("倾尽了天下", "倾尽天下")).toBe(1);
  });

  it("相邻两字颠倒算 1", () => {
    expect(substringDistance("江山夜此", "江山此夜")).toBe(1);
  });

  it("只对上题名的一段也算", () => {
    expect(substringDistance("雨碎江男", "雨碎江南印象")).toBe(1);
    expect(substringDistance("碎江男印", "雨碎江南印象")).toBe(1);
  });

  it("超过上限时返回上限加一", () => {
    expect(substringDistance("天涯海角", "倾尽天下")).toBe(2);
    expect(substringDistance("天涯海角", "倾尽天下", 3)).toBe(3);
    expect(substringDistance("一二三四五六", "如花")).toBe(2);
  });
});

describe("isFuzzyTitleMatch", () => {
  it("至少四个字才做", () => {
    expect(isFuzzyTitleMatch("越人哥", "越人歌")).toBe(false);
    expect(isFuzzyTitleMatch("倾尽天夏", "倾尽天下")).toBe(true);
  });

  it("完全包含的不算（那是第 3 档）", () => {
    expect(isFuzzyTitleMatch("雨碎江南", "雨碎江南印象")).toBe(false);
  });

  it("差两个字不算", () => {
    expect(isFuzzyTitleMatch("倾城天夏", "倾尽天下")).toBe(false);
  });
});
