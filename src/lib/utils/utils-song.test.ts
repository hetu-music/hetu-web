import { describe, it, expect } from "vitest";
import Fuse from "fuse.js";
import {
  countCatalogSongs,
  getCoverUrl,
  getNmnUrl,
  LYRIC_SEARCH_KEY,
  mapAndSortSongs,
  processLyricsForSearch,
} from "./utils-song";
import { filterSongs, searchAndFilterSongs } from "@/lib/library/legacy-fuse";
import type { Song } from "@/lib/types";

function makeSong(overrides: Partial<Song> & { id: number }): Song {
  return {
    title: `song-${overrides.id}`,
    album: null,
    year: null,
    genre: null,
    lyricist: null,
    composer: null,
    artist: null,
    length: null,
    updated_at: "2024-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("countCatalogSongs", () => {
  it("资料有争议的歌不计入总数", () => {
    const songs = [
      makeSong({ id: 1 }),
      makeSong({ id: 2, dispute_note: "作曲署名有两种说法" }),
      makeSong({ id: 3, dispute_note: null }),
    ];
    expect(countCatalogSongs(songs)).toBe(2);
  });

  it("空字符串视为无争议", () => {
    expect(countCatalogSongs([makeSong({ id: 1, dispute_note: "" })])).toBe(1);
  });
});

describe("mapAndSortSongs", () => {
  it("按 date 降序排序，且从 date 计算 year", () => {
    const songs = [
      makeSong({ id: 1, date: "2020-01-01" }),
      makeSong({ id: 2, date: "2023-05-01" }),
    ];
    const result = mapAndSortSongs(songs);
    expect(result.map((s) => s.id)).toEqual([2, 1]);
    expect(result[0].year).toBe(2023);
  });

  it("没有 date 的歌曲排在有 date 的后面", () => {
    const songs = [
      makeSong({ id: 1 }), // 无 date
      makeSong({ id: 2, date: "2020-01-01" }),
    ];
    const result = mapAndSortSongs(songs);
    expect(result.map((s) => s.id)).toEqual([2, 1]);
  });

  it("都没有 date 时保持稳定，不抛异常", () => {
    const songs = [makeSong({ id: 1 }), makeSong({ id: 2 })];
    expect(() => mapAndSortSongs(songs)).not.toThrow();
  });
});

describe("getCoverUrl / getNmnUrl", () => {
  it("hascover 为 true 时返回歌曲专属封面", () => {
    expect(getCoverUrl(makeSong({ id: 1, hascover: true }))).toBe(
      "https://cover.hetu-music.com/cover/1.jpg",
    );
  });

  it("hascover 为 false 时返回占位封面", () => {
    expect(getCoverUrl(makeSong({ id: 1, hascover: false }))).toBe(
      "https://cover.hetu-music.com/cover/proto.jpg",
    );
  });

  it("hascover 缺失（undefined/null）时返回默认封面", () => {
    expect(getCoverUrl(makeSong({ id: 1 }))).toBe(
      "https://cover.hetu-music.com/cover/default.jpg",
    );
  });

  it("getNmnUrl 按 id 拼接乐谱图片地址", () => {
    expect(getNmnUrl(makeSong({ id: 42 }))).toBe(
      "https://cover.hetu-music.com/nmn/42.png",
    );
  });
});

describe("filterSongs", () => {
  const songs = [
    makeSong({ id: 1, title: "红豆", type: ["原创"], year: 2020 }),
    makeSong({ id: 2, title: "橄榄树", type: ["翻唱"], year: 2021 }),
    makeSong({ id: 3, title: "无题", type: [] }), // 未知 type / year
  ];

  const namedSongs = [
    makeSong({
      id: 1,
      lyricist: ["甲"],
      composer: ["丙"],
      arranger: ["戊"],
      genre: ["古风"],
      artist: ["A"],
    }),
    makeSong({
      id: 2,
      lyricist: ["乙"],
      composer: ["丁"],
      arranger: ["己"],
      genre: ["流行"],
      artist: ["B"],
    }),
    makeSong({
      id: 3,
      lyricist: [],
      composer: [],
      arranger: [],
      genre: [],
      artist: [],
    }),
  ];

  it("按作词多选筛选（含“未知”）", () => {
    const result = filterSongs(namedSongs, "", "全部", "全部", ["甲"], [], []);
    expect(result.map((s) => s.id)).toEqual([1]);
  });

  it("作词多选包含“未知”时匹配缺失字段的歌曲", () => {
    const result = filterSongs(
      namedSongs,
      "",
      "全部",
      "全部",
      ["未知"],
      [],
      [],
    );
    expect(result.map((s) => s.id)).toEqual([3]);
  });

  it("按作曲多选筛选", () => {
    const result = filterSongs(namedSongs, "", "全部", "全部", [], ["丁"], []);
    expect(result.map((s) => s.id)).toEqual([2]);
  });

  it("按编曲多选筛选", () => {
    const result = filterSongs(namedSongs, "", "全部", "全部", [], [], ["戊"]);
    expect(result.map((s) => s.id)).toEqual([1]);
  });

  it("按流派多选筛选", () => {
    const result = filterSongs(
      namedSongs,
      "",
      "全部",
      "全部",
      [],
      [],
      [],
      ["流行"],
    );
    expect(result.map((s) => s.id)).toEqual([2]);
  });

  it("按演唱者多选筛选", () => {
    const result = filterSongs(
      namedSongs,
      "",
      "全部",
      "全部",
      [],
      [],
      [],
      [],
      ["A"],
    );
    expect(result.map((s) => s.id)).toEqual([1]);
  });

  it("按类型精确筛选", () => {
    const result = filterSongs(songs, "", "原创", "全部", [], [], []);
    expect(result.map((s) => s.id)).toEqual([1]);
  });

  it("类型为“未知”时匹配缺失 type 的歌曲", () => {
    const result = filterSongs(songs, "", "未知", "全部", [], [], []);
    expect(result.map((s) => s.id)).toEqual([3]);
  });

  it("类型为“全部”时不过滤", () => {
    const result = filterSongs(songs, "", "全部", "全部", [], [], []);
    expect(result).toHaveLength(3);
  });

  it("按年份数组筛选（多选）", () => {
    const result = filterSongs(songs, "", "全部", [2020], [], [], []);
    expect(result.map((s) => s.id)).toEqual([1]);
  });

  it("使用 Fuse 模糊搜索标题", () => {
    const result = filterSongs(songs, "红豆", "全部", "全部", [], [], []);
    expect(result.map((s) => s.id)).toEqual([1]);
  });
});

describe("processLyricsForSearch", () => {
  it("去除元数据行、时间戳，并用空格拼接为一行", () => {
    const lrc = "[ti:标题]\n[00:01.00]第一句\n[00:02.00]第二句";
    expect(processLyricsForSearch(lrc)).toBe("第一句 第二句");
  });

  it("空输入返回空字符串", () => {
    expect(processLyricsForSearch(null)).toBe("");
    expect(processLyricsForSearch("")).toBe("");
  });
});

describe("searchAndFilterSongs — 命中区间", () => {
  const lyricSongs = [
    makeSong({ id: 1, title: "月下独酌" }),
    makeSong({ id: 2, title: "无关的歌" }),
  ];

  // 构造一个带歌词字段、且开启 includeMatches 的索引，与 useLyricsIndex 一致
  function makeLyricFuse(lyricsById: Record<number, string>) {
    return new Fuse(
      lyricSongs.map((s) => ({
        ...s,
        [LYRIC_SEARCH_KEY]: lyricsById[s.id] ?? "",
      })),
      {
        keys: [
          { name: "title", weight: 0.35 },
          { name: LYRIC_SEARCH_KEY, weight: 0.15 },
        ],
        threshold: 0.35,
        ignoreLocation: true,
        findAllMatches: true,
        minMatchCharLength: 1,
        includeMatches: true,
      },
    );
  }

  it("命中歌词时给出该歌的字符区间", () => {
    const fuse = makeLyricFuse({ 1: "举杯邀明月对影成三人", 2: "毫不相干" });
    const { lyricMatchesById } = searchAndFilterSongs(
      lyricSongs,
      "明月",
      "全部",
      "全部",
      [],
      [],
      [],
      [],
      [],
      fuse,
    );

    const ranges = lyricMatchesById.get(1);
    expect(ranges).toBeDefined();
    // 区间应落在"明月"实际出现的位置上
    const [start, end] = (ranges ?? [[0, 0]])[0];
    expect("举杯邀明月对影成三人".slice(start, end + 1)).toContain("月");
  });

  it("只靠标题命中的歌不会出现在歌词命中表里", () => {
    const fuse = makeLyricFuse({ 1: "与查询无关的歌词", 2: "也无关" });
    const { lyricMatchesById } = searchAndFilterSongs(
      lyricSongs,
      "月下独酌",
      "全部",
      "全部",
      [],
      [],
      [],
      [],
      [],
      fuse,
    );

    expect(lyricMatchesById.has(1)).toBe(false);
  });

  it("没有搜索词时命中表为空", () => {
    const { songs, lyricMatchesById } = searchAndFilterSongs(
      lyricSongs,
      "",
      "全部",
      "全部",
      [],
      [],
      [],
      [],
      [],
    );
    expect(songs).toHaveLength(2);
    expect(lyricMatchesById.size).toBe(0);
  });

  it("filterSongs 仍只返回歌曲数组，行为不变", () => {
    const result = filterSongs(lyricSongs, "", "全部", "全部", [], [], []);
    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(2);
  });
});
