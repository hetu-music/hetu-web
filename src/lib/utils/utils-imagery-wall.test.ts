import { describe, expect, it } from "vitest";
import type { LibraryImagery } from "@/lib/types";
import {
  buildCorpus,
  featuredByYear,
  kinOf,
  songsWithAll,
  topImagery,
  yearSignatures,
} from "./utils-imagery-wall";

// 意象：1 月（处处都有） 2 剑 3 酒 4 雪 5 江湖
const IMAGERY: LibraryImagery = {
  bySong: {
    10: [1, 2, 5],
    11: [1, 2, 3, 5],
    12: [1, 3],
    13: [1, 4],
    14: [1, 4],
    15: [1],
  },
  items: [
    { id: 1, name: "月", accent: "#000", songCount: 6 },
    { id: 2, name: "剑", accent: "#000", songCount: 2 },
    { id: 3, name: "酒", accent: "#000", songCount: 2 },
    { id: 4, name: "雪", accent: "#000", songCount: 2 },
    { id: 5, name: "江湖", accent: "#000", songCount: 2 },
  ],
};
const corpus = buildCorpus(IMAGERY);

describe("topImagery", () => {
  it("按作品数从多到少，同数按 id", () => {
    expect(topImagery(IMAGERY.items, 3).map((i) => i.id)).toEqual([1, 2, 3]);
  });
});

describe("songsWithAll", () => {
  it("多个意象取交集", () => {
    expect([...songsWithAll(corpus, [1, 3])].sort()).toEqual([11, 12]);
    expect([...songsWithAll(corpus, [2, 3])]).toEqual([11]);
  });

  it("没选意象时为空", () => {
    expect(songsWithAll(corpus, []).size).toBe(0);
  });
});

describe("kinOf", () => {
  it("共有少见意象的排在前面，只共有处处都有的「月」不算", () => {
    // 「月」每首都有，IDF 为 0，不构成相似
    expect(kinOf(corpus, 10, 10)).toEqual([11]);
    expect(kinOf(corpus, 13, 10)).toEqual([14]);
  });

  it("不含自己，且受数量上限约束", () => {
    expect(kinOf(corpus, 11, 1)).toEqual([10]);
    expect(kinOf(corpus, 11, 10)).not.toContain(11);
  });

  it("没有标注的歌没有同类", () => {
    expect(kinOf(corpus, 99, 10)).toEqual([]);
  });
});

describe("yearSignatures", () => {
  const songs = [
    { id: 10, year: 2015 },
    { id: 11, year: 2015 },
    { id: 12, year: 2016 },
    { id: 13, year: 2016 },
    { id: 14, year: 2016 },
    { id: 15, year: null },
  ];

  it("取年内出现两次以上、且全库少见的意象", () => {
    const sig = yearSignatures(songs, corpus, 2);
    // 2015：剑、江湖各两次；「月」虽也两次但 IDF 为 0，排在后面
    expect(sig.get(2015)).toEqual([2, 5]);
    // 2016：雪两次；酒只一次，不算
    expect(sig.get(2016)?.[0]).toBe(4);
    expect(sig.get(2016)).not.toContain(3);
  });

  it("没有年份的歌不参与", () => {
    expect([...yearSignatures(songs, corpus, 2).keys()].sort()).toEqual([
      2015, 2016,
    ]);
  });
});

describe("featuredByYear", () => {
  const songs = [
    { id: 10, year: 2015, hascover: true },
    { id: 11, year: 2015, hascover: true },
    { id: 12, year: 2015, hascover: false },
    { id: 13, year: 2016, hascover: true },
  ];

  it("取有封面、意象最多的一首", () => {
    expect(featuredByYear(songs, corpus, 2).get(2015)).toBe(11);
  });

  it("作品太少的年份不设主作", () => {
    expect(featuredByYear(songs, corpus, 2).has(2016)).toBe(false);
  });

  it("没有封面的不当主作", () => {
    const only = [
      { id: 12, year: 2017, hascover: false },
      { id: 15, year: 2017, hascover: null },
    ];
    expect(featuredByYear(only, corpus, 2).has(2017)).toBe(false);
  });
});
