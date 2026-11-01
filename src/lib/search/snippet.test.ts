import { describe, expect, it } from "vitest";
import { buildCorpus, type LyricsCorpus } from "./corpus";
import { searchSongs } from "./rank";
import { buildSnippet, findRanges } from "./snippet";
import { LYRICS, SONGS, song } from "./test-fixtures";
import type { Song } from "@/lib/types";

const corpus = buildCorpus(LYRICS);

/** 搜索后取第一条结果的片段 */
function snippetFor(
  query: string,
  {
    songs = SONGS,
    c = corpus,
    maxLength,
  }: { songs?: Song[]; c?: LyricsCorpus; maxLength?: number } = {},
) {
  const result = searchSongs(songs, query, c);
  if (!result?.hits[0]) throw new Error("没有结果");
  return buildSnippet(c, result.hits[0], result.words, maxLength);
}

const LONG_LINE = buildCorpus([
  { id: 1, lines: ["一二三四五六七八九十甲乙丙丁戊己庚辛壬癸"] },
]);

/** 把高亮区间标成【】，便于断言 */
function marked(s: { text: string; ranges: [number, number][] } | null) {
  if (!s) return null;
  let out = "";
  let at = 0;
  for (const [a, b] of s.ranges) {
    out += `${s.text.slice(at, a)}【${s.text.slice(a, b)}】`;
    at = b;
  }
  return out + s.text.slice(at);
}

describe("buildSnippet", () => {
  it("显示整句，高亮命中的字", () => {
    const s = snippetFor("血溅");
    expect(marked(s)).toBe("七重纱衣，【血溅】了白纱");
    expect(s?.more).toBe(0);
    expect(s?.approximate).toBe(false);
  });

  it("跨过标点的命中，高亮把标点也包进去", () => {
    expect(marked(snippetFor("纱衣血溅"))).toBe("七重【纱衣，血溅】了白纱");
  });

  it("命中多句时给出另外几句的数目", () => {
    expect(snippetFor("不知道")?.more).toBe(1);
  });

  it("兜底命中标为近似，高亮对上的两字片段", () => {
    const s = snippetFor("七重纱衣血溅了白沙");
    expect(s?.approximate).toBe(true);
    expect(marked(s)).toBe("【七重纱衣，血溅了白】纱");
  });

  it("不在歌词档的结果没有片段", () => {
    // 「倾尽天下」题名完全相同，是第 1 档，虽然歌词里也有这一句
    expect(snippetFor("倾尽天下")).toBeNull();
  });

  it("太长的句子以第一处命中为中心截取，两头加省略号", () => {
    const s = snippetFor("甲乙", {
      songs: [song(1, "长句")],
      c: LONG_LINE,
      maxLength: 8,
    });
    expect(marked(s)).toBe("…八九十【甲乙】丙丁戊…");
  });

  it("命中在开头时只在结尾加省略号", () => {
    const s = snippetFor("一二", {
      songs: [song(1, "长句")],
      c: LONG_LINE,
      maxLength: 8,
    });
    expect(marked(s)).toBe("【一二】三四五六七八…");
  });
});

describe("findRanges", () => {
  it("繁体原文里高亮繁体的字", () => {
    expect(findRanges("她在燈下把墨研", ["灯下"])).toEqual([[2, 4]]);
  });

  it("重叠和相接的区间合并", () => {
    expect(findRanges("七重纱衣血溅", ["纱衣", "衣血", "血溅"])).toEqual([
      [2, 6],
    ]);
  });

  it("同一个词出现多次都高亮", () => {
    expect(findRanges("明月，明月", ["明月"])).toEqual([
      [0, 2],
      [3, 5],
    ]);
  });
});
