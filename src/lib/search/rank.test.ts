import { describe, expect, it } from "vitest";
import { buildCorpus } from "./corpus";
import { searchSongs, TIER, type SearchResult } from "./rank";
import { LYRICS, SONGS, song } from "./test-fixtures";

const corpus = buildCorpus(LYRICS);

/** [歌曲 id, 档位] 的列表，便于断言 */
function ranked(result: SearchResult | null): [number, number][] {
  if (!result) throw new Error("searchSongs 意外返回 null");
  return result.hits.map((h) => [h.song.id, h.tier]);
}

describe("searchSongs：元数据各档", () => {
  it("没有可搜的字时返回 null", () => {
    expect(searchSongs(SONGS, "", corpus)).toBeNull();
    expect(searchSongs(SONGS, " ，。 ", corpus)).toBeNull();
  });

  it("题名完全相同排第一", () => {
    expect(ranked(searchSongs(SONGS, "倾尽天下", corpus))).toEqual([
      [1, TIER.TITLE_EXACT],
    ]);
  });

  it("题名开头优先于题名包含", () => {
    expect(ranked(searchSongs(SONGS, "江南", null))).toEqual([
      [3, TIER.TITLE_PREFIX],
      [4, TIER.TITLE_CONTAINS],
    ]);
  });

  it("人名完全相同优先于人名包含；别署也算", () => {
    expect(ranked(searchSongs(SONGS, "萧忆情", null))).toEqual([
      [5, TIER.NAME_EXACT],
      [6, TIER.NAME_CONTAINS],
    ]);
  });

  it("各角色一起查", () => {
    expect(ranked(searchSongs(SONGS, "李萌", null))).toEqual([
      [3, TIER.NAME_EXACT],
      [4, TIER.NAME_EXACT],
    ]);
  });

  it("专辑", () => {
    expect(ranked(searchSongs(SONGS, "漱愿记", null))).toEqual([
      [6, TIER.ALBUM],
    ]);
  });

  it("简繁互输：繁体题名用简体搜，简体人名用繁体搜", () => {
    expect(ranked(searchSongs(SONGS, "如梦", null))).toEqual([
      [7, TIER.TITLE_EXACT],
    ]);
    expect(ranked(searchSongs(SONGS, "河圖", null)).map(([id]) => id)).toEqual([
      1, 2, 4, 5, 7,
    ]);
  });

  it("同一档内保持曲库原有顺序", () => {
    const reversed = [...SONGS].reverse();
    expect(
      ranked(searchSongs(reversed, "河图", null)).map(([id]) => id),
    ).toEqual([7, 5, 4, 2, 1]);
  });
});

describe("searchSongs：题名近似", () => {
  it("四个字以上、差一个字的题名排在元数据各档的最后", () => {
    expect(ranked(searchSongs(SONGS, "倾尽天夏", corpus))).toEqual([
      [1, TIER.TITLE_FUZZY],
    ]);
  });

  it("三个字的不做", () => {
    expect(ranked(searchSongs(SONGS, "越人哥", corpus))).toEqual([]);
  });

  it("这个词在元数据上对上了，就不再做近似", () => {
    const songs = [song(1, "天光之外"), song(2, "天光之内")];
    expect(ranked(searchSongs(songs, "天光之外", null))).toEqual([
      [1, TIER.TITLE_EXACT],
    ]);
    expect(ranked(searchSongs(songs, "天光之中", null))).toEqual([
      [1, TIER.TITLE_FUZZY],
      [2, TIER.TITLE_FUZZY],
    ]);
  });

  it("排在歌词精确命中之前", () => {
    const songs = [song(1, "沧海"), song(2, "倾尽天下")];
    const c = buildCorpus([{ id: 1, lines: ["倾尽天夏"] }]);
    expect(ranked(searchSongs(songs, "倾尽天夏", c))).toEqual([
      [2, TIER.TITLE_FUZZY],
      [1, TIER.LYRIC_LINE],
    ]);
  });
});

describe("searchSongs：歌词", () => {
  it("整句相同优先于包含", () => {
    expect(ranked(searchSongs(SONGS, "不知道", corpus))).toEqual([
      [3, TIER.LYRIC_LINE],
      [4, TIER.LYRIC_CONTAINS],
    ]);
  });

  it("歌词数据没到时只查元数据；到了以后只在末尾追加", () => {
    const before = ranked(searchSongs(SONGS, "天下", null));
    const after = ranked(searchSongs(SONGS, "天下", corpus));
    expect(before).toEqual([[1, TIER.TITLE_CONTAINS]]);
    expect(after.slice(0, before.length)).toEqual(before);
    expect(after.slice(before.length)).toEqual([
      [4, TIER.LYRIC_CONTAINS],
      [6, TIER.LYRIC_CONTAINS],
    ]);
  });

  it("单字不搜歌词", () => {
    expect(ranked(searchSongs(SONGS, "下", corpus))).toEqual([
      [1, TIER.TITLE_CONTAINS],
    ]);
  });

  it("档内按命中句数从多到少，再按第一处命中从前到后", () => {
    const songs = [song(1, "甲"), song(2, "乙"), song(3, "丙")];
    const c = buildCorpus([
      { id: 1, lines: ["无关", "无关", "明月几时有"] },
      { id: 2, lines: ["明月", "明月照我"] },
      { id: 3, lines: ["明月光"] },
    ]);
    const result = searchSongs(songs, "明月", c);
    expect(ranked(result)).toEqual([
      [2, TIER.LYRIC_LINE],
      [3, TIER.LYRIC_CONTAINS],
      [1, TIER.LYRIC_CONTAINS],
    ]);
    expect(result?.hits[0].lyric).toEqual({ line: 3, count: 2 });
  });

  it("只在传入的歌里找：筛选掉的歌即使歌词命中也不出现", () => {
    const subset = SONGS.filter((s) => s.id === 6);
    expect(ranked(searchSongs(subset, "天下", corpus))).toEqual([
      [6, TIER.LYRIC_CONTAINS],
    ]);
  });

  it("繁体输入搜简体歌词", () => {
    expect(ranked(searchSongs(SONGS, "她在燈下", corpus))).toEqual([
      [2, TIER.LYRIC_CONTAINS],
    ]);
  });
});

describe("searchSongs：多个词", () => {
  it("每个词都要命中，取各词最好档位中最差的那个", () => {
    expect(ranked(searchSongs(SONGS, "河图 不知道", corpus))).toEqual([
      [4, TIER.LYRIC_CONTAINS],
    ]);
    // 「江南」在题名里（第 3 档），「河图」是人名（第 4 档），取较差的第 4 档
    expect(ranked(searchSongs(SONGS, "河图 江南", corpus))).toEqual([
      [4, TIER.NAME_EXACT],
    ]);
  });

  it("片段优先选同时包含多个词的句子", () => {
    const result = searchSongs(SONGS, "不知道 哪里", corpus);
    expect(ranked(result)).toEqual([[3, TIER.LYRIC_CONTAINS]]);
    const line = result?.hits[0].lyric?.line as number;
    expect(corpus.lines[line]).toBe("我不知道你在哪里");
    expect(result?.hits[0].lyric?.count).toBe(2);
  });
});

describe("searchSongs：兜底", () => {
  it("精确命中一首都没有时，按两字片段的覆盖率找回记错的句子", () => {
    const result = searchSongs(SONGS, "七重纱衣血溅了白沙", corpus);
    expect(ranked(result)).toEqual([[1, TIER.LYRIC_FALLBACK]]);
    const line = result?.hits[0].lyric?.line as number;
    expect(corpus.lines[line]).toBe("七重纱衣，血溅了白纱");
  });

  it("多个词时，精确命中不了的词在兜底里找", () => {
    expect(ranked(searchSongs(SONGS, "七重纱衣 血溅了白沙", corpus))).toEqual([
      [1, TIER.LYRIC_FALLBACK],
    ]);
  });

  it("有精确命中时不兜底", () => {
    const hits = ranked(searchSongs(SONGS, "倾尽天夏", corpus));
    expect(hits.every(([, tier]) => tier !== TIER.LYRIC_FALLBACK)).toBe(true);
  });

  it("歌词数据没到时不兜底", () => {
    expect(ranked(searchSongs(SONGS, "七重纱衣血溅了白沙", null))).toEqual([]);
  });

  it("三个字的词只有两个片段，错一个字就找不回", () => {
    expect(ranked(searchSongs(SONGS, "不知到", corpus))).toEqual([]);
  });

  it("覆盖率不够的句子不算", () => {
    // 「夜夜笙歌」只对上「笙歌」一个片段
    expect(ranked(searchSongs(SONGS, "春夜笙歌好", corpus))).toEqual([]);
  });

  it("按覆盖率从高到低", () => {
    const songs = [song(1, "甲"), song(2, "乙")];
    const c = buildCorpus([
      { id: 1, lines: ["一二三四五"] },
      { id: 2, lines: ["一二三四六"] },
    ]);
    // 「一二三四七」：乙对上 一二、二三、三四 三个片段（0.75），甲同样；
    // 「二三四五七」：甲对上 二三、三四、四五（0.75），乙只有两个（0.5，不够）
    expect(ranked(searchSongs(songs, "一二三四七", c))).toEqual([
      [1, TIER.LYRIC_FALLBACK],
      [2, TIER.LYRIC_FALLBACK],
    ]);
    expect(ranked(searchSongs(songs, "二三四五七", c))).toEqual([
      [1, TIER.LYRIC_FALLBACK],
    ]);
    // 「一二三四五六」五个片段：甲对上三个（0.6），乙对上四个（0.8），乙在前
    const c2 = buildCorpus([
      { id: 1, lines: ["一二三四九"] },
      { id: 2, lines: ["一二三四五九"] },
    ]);
    expect(ranked(searchSongs(songs, "一二三四五六", c2))).toEqual([
      [2, TIER.LYRIC_FALLBACK],
      [1, TIER.LYRIC_FALLBACK],
    ]);
  });
});
