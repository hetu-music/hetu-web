import { describe, it, expect } from "vitest";
import Fuse from "fuse.js";
import {
  calculateFilterOptions,
  decodeFilterParam,
  encodeFilterParam,
  filterSongs,
  getCoverUrl,
  getNmnUrl,
  LYRIC_SEARCH_KEY,
  mapAndSortSongs,
  processLyricsForSearch,
  searchAndFilterSongs,
} from "./utils-song";
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

describe("calculateFilterOptions", () => {
  it("汇总类型/流派/年份，并将缺失字段的歌曲归入“未知”", () => {
    const songs = [
      makeSong({ id: 1, type: ["原创"], genre: ["古风"], date: "2020-01-01" }),
      makeSong({ id: 2, type: [], genre: [] }), // 触发“未知”分支
    ];
    const options = calculateFilterOptions(
      mapAndSortSongs(songs), // 复用 mapAndSortSongs 补齐 year
    );
    expect(options.allTypes).toEqual(["全部", "原创", "未知"]);
    expect(options.allGenres).toEqual(["全部", "古风", "未知"]);
    expect(options.allYears).toEqual(["全部", 2020, "未知"]);
  });

  it("人名类字段按“英文在前、中文拼音在后”排序", () => {
    const songs = [
      makeSong({ id: 1, lyricist: ["张三"] }),
      makeSong({ id: 2, lyricist: ["Alice"] }),
      makeSong({ id: 3, lyricist: ["李四"] }),
    ];
    const options = calculateFilterOptions(songs);
    // 全部/Alice 在前，中文按拼音排序（李四在张三之前）
    expect(options.allLyricists).toEqual(["全部", "Alice", "李四", "张三"]);
  });

  it("composer/arranger/artist 缺失时同样归入“未知”", () => {
    const songs = [
      makeSong({ id: 1, composer: ["甲"], arranger: ["乙"], artist: ["丙"] }),
      makeSong({ id: 2, composer: [], arranger: [], artist: [] }),
    ];
    const options = calculateFilterOptions(songs);
    expect(options.allComposers).toEqual(["全部", "甲", "未知"]);
    expect(options.allArrangers).toEqual(["全部", "乙", "未知"]);
    expect(options.allArtists).toEqual(["全部", "丙", "未知"]);
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

describe("encodeFilterParam & decodeFilterParam", () => {
  const allGenres = ["全部", "古风", "流行", "民谣", "摇滚", "电子"];
  const validGenres = ["古风", "流行", "民谣", "摇滚", "电子"]; // 5 项

  it("空选择时返回空数组", () => {
    expect(encodeFilterParam([], allGenres)).toEqual([]);
    expect(decodeFilterParam([], allGenres)).toEqual([]);
  });

  it("选择项占少数时（<= N/2），正向保存", () => {
    // 5 项中选 1 项或 2 项
    expect(encodeFilterParam(["古风"], allGenres)).toEqual(["古风"]);
    expect(decodeFilterParam(["古风"], allGenres)).toEqual(["古风"]);

    expect(encodeFilterParam(["古风", "流行"], allGenres)).toEqual([
      "古风",
      "流行",
    ]);
    expect(decodeFilterParam(["古风", "流行"], allGenres)).toEqual([
      "古风",
      "流行",
    ]);
  });

  it("全选时，压缩为 ['*']，且能正确还原为全部有效选项", () => {
    expect(encodeFilterParam(validGenres, allGenres)).toEqual(["*"]);
    expect(decodeFilterParam(["*"], allGenres)).toEqual(validGenres);
    expect(decodeFilterParam(["all"], allGenres)).toEqual(validGenres);
  });

  it("全选 - 1 时（> N/2），转换为反向排除列表 ['!排除项']，且能正确还原", () => {
    // 5 项中选 4 项（排除 电子）
    const fourGenres = ["古风", "流行", "民谣", "摇滚"];
    const encoded = encodeFilterParam(fourGenres, allGenres);
    expect(encoded).toEqual(["!电子"]);

    const decoded = decodeFilterParam(encoded, allGenres);
    expect(decoded).toEqual(fourGenres);
  });

  it("全选 - 2 时，转换为反向排除列表，且能正确还原", () => {
    // 5 项中选 3 项（排除 摇滚、电子，3 > 5/2）
    const threeGenres = ["古风", "流行", "民谣"];
    const encoded = encodeFilterParam(threeGenres, allGenres);
    expect(encoded).toEqual(["!摇滚", "!电子"]);

    const decoded = decodeFilterParam(encoded, allGenres);
    expect(decoded).toEqual(threeGenres);
  });

  it("所有可能子集双向编解码满足自洽性 (Roundtrip)", () => {
    // 对 [A, B, C] 全子集测试双向可逆性
    const smallOptions = ["全部", "A", "B", "C"];

    // 生成所有 2^3 = 8 个子集
    const subsets = [
      [],
      ["A"],
      ["B"],
      ["C"],
      ["A", "B"],
      ["A", "C"],
      ["B", "C"],
      ["A", "B", "C"],
    ];

    for (const subset of subsets) {
      const encoded = encodeFilterParam(subset, smallOptions);
      const decoded = decodeFilterParam(encoded, smallOptions);
      expect(decoded.sort()).toEqual(subset.sort());
    }
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
