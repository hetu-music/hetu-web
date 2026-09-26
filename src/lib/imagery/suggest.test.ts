import { describe, expect, it } from "vitest";
import {
  buildPriors,
  createMatcher,
  parseLrcLines,
  suggestImagery,
  type ImageryPrior,
} from "./suggest";

describe("parseLrcLines", () => {
  it("保留原始时间标签，展开一行多标签并按时间排序", () => {
    const lines = parseLrcLines(
      "[ti:倾尽天下]\n[01:00.50][00:10.20]明月照我\n[00:05.00]\n[00:20.123]风起",
    );
    expect(lines).toEqual([
      { tag: "00:10.20", text: "明月照我" },
      { tag: "00:20.123", text: "风起" },
      { tag: "01:00.50", text: "明月照我" },
    ]);
  });

  it("跳过制作名单和标题行，但保留对白与对唱行", () => {
    const lines = parseLrcLines(
      [
        "[00:00.00]倾尽天下 - 河图",
        "[00:01.00]词：河图",
        "[00:02.00]混音/母带：某人",
        "[00:03.00]【公子羽：举杯邀明月】",
        "[00:04.00]女：江湖路远",
      ].join("\n"),
    );
    expect(lines.map((l) => l.text)).toEqual([
      "【公子羽：举杯邀明月】",
      "女：江湖路远",
    ]);
  });

  it("空歌词返回空数组", () => {
    expect(parseLrcLines(null)).toEqual([]);
    expect(parseLrcLines("")).toEqual([]);
  });
});

describe("createMatcher", () => {
  const match = createMatcher([
    { id: 1, name: "月" },
    { id: 2, name: "明月" },
    { id: 3, name: "god" },
  ]);

  it("长短词都命中，同一时间标签只记一次", () => {
    const found = match([
      { tag: "00:01.00", text: "明月明月" },
      { tag: "00:02.00", text: "月下" },
    ]);
    expect(found.get(1)?.map((l) => l.tag)).toEqual(["00:01.00", "00:02.00"]);
    expect(found.get(2)?.map((l) => l.tag)).toEqual(["00:01.00"]);
  });

  it("英文意象大小写不敏感且整词匹配", () => {
    expect(match([{ tag: "00:01.00", text: "Oh God" }]).has(3)).toBe(true);
    expect(match([{ tag: "00:01.00", text: "goddess" }]).has(3)).toBe(false);
  });
});

describe("buildPriors", () => {
  const dictionary = [
    { id: 1, name: "风" },
    { id: 2, name: "人" },
  ];

  it("只统计已标注的歌曲，并按使用次数排列分类", () => {
    const priors = buildPriors({
      dictionary,
      songs: [
        { id: 10, lyrics: "[00:01.00]风里的人" },
        { id: 11, lyrics: "[00:01.00]风吹过人间" },
        { id: 12, lyrics: "[00:01.00]风中人" }, // 未标注，不计入
      ],
      occurrences: [
        { song_id: 10, imagery_id: 1, category_id: 100 },
        { song_id: 11, imagery_id: 1, category_id: 101 },
        { song_id: 13, imagery_id: 1, category_id: 101 },
      ],
    });
    expect(priors.get(1)).toEqual({
      seen: 2,
      annotated: 2,
      categoryIds: [101, 100],
    });
    expect(priors.get(2)).toEqual({ seen: 2, annotated: 0, categoryIds: [] });
  });

  it("excludeSongId 排除当前歌曲", () => {
    const priors = buildPriors({
      dictionary,
      songs: [{ id: 10, lyrics: "[00:01.00]风" }],
      occurrences: [{ song_id: 10, imagery_id: 1, category_id: 100 }],
      excludeSongId: 10,
    });
    expect(priors.get(1)?.seen).toBe(0);
  });
});

describe("suggestImagery", () => {
  const dictionary = [
    { id: 1, name: "风" },
    { id: 2, name: "人" },
    { id: 3, name: "月" },
    { id: 4, name: "岁月" },
    { id: 5, name: "孤城" },
  ];
  const prior = (
    seen: number,
    annotated: number,
    categoryIds: number[] = [100],
  ): ImageryPrior => ({ seen, annotated, categoryIds });
  const priors = new Map<number, ImageryPrior>([
    [1, prior(10, 8)],
    [2, prior(10, 1)],
    [3, prior(10, 9)],
    [4, prior(10, 5)],
    [5, prior(0, 0, [])],
  ]);
  const lyrics = [
    "[00:30.00]人在孤城",
    "[00:10.00]风起岁月",
    "[01:10.00]风又起",
  ].join("\n");

  it("按历史标注率决定默认勾选，并汇总时间标签", () => {
    const result = suggestImagery({ lyrics, dictionary, priors });
    const byName = new Map(result.map((s) => [s.name, s]));
    expect(byName.get("风")).toMatchObject({
      timetags: ["00:10.00", "01:10.00"],
      rate: 0.8,
      recommended: true,
    });
    expect(byName.get("人")?.recommended).toBe(false);
    // 从未标注过的意象没有默认分类，不默认勾选
    expect(byName.get("孤城")).toMatchObject({
      rate: null,
      categoryIds: [],
      recommended: false,
    });
  });

  it("被更长意象完全覆盖的短词不默认勾选", () => {
    const result = suggestImagery({ lyrics, dictionary, priors });
    expect(result.find((s) => s.name === "月")?.recommended).toBe(false);
    expect(result.find((s) => s.name === "岁月")?.recommended).toBe(true);

    const standalone = suggestImagery({
      lyrics: "[00:01.00]岁月\n[00:02.00]月光",
      dictionary,
      priors,
    });
    expect(standalone.find((s) => s.name === "月")?.recommended).toBe(true);
  });

  it("默认勾选的按出现时间排在前面，其余按标注率排序", () => {
    const result = suggestImagery({ lyrics, dictionary, priors });
    expect(result.map((s) => s.name)).toEqual([
      "风",
      "岁月",
      "月",
      "人",
      "孤城",
    ]);
  });

  it("跳过已标注的意象", () => {
    const result = suggestImagery({
      lyrics,
      dictionary,
      priors,
      existingImageryIds: new Set([1]),
    });
    expect(result.some((s) => s.name === "风")).toBe(false);
  });
});
