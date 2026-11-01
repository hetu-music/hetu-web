import { describe, expect, it } from "vitest";
import { FILTER_OPTION_ALL, FILTER_OPTION_UNKNOWN } from "@/lib/constants";
import type { Song } from "@/lib/types";
import {
  createFuseInstance,
  searchAndFilterSongs,
} from "@/lib/utils/utils-song";
import {
  ALL_SELECTED,
  availableFacetValues,
  buildLibraryOptions,
  checkedValues,
  emptyFacets,
  FACET_KEYS,
  type FacetKey,
  type FacetSelection,
  filterSongs,
  formatYear,
  type LibraryFilters,
  matchesFacet,
  matchesYear,
  nextSelection,
  NO_SELECTION,
  parseYear,
  yearFromSlider,
  yearToSlider,
} from "./filters";
import { legacySearch } from "./legacy-search";

function song(id: number, extra: Partial<Song> = {}): Song {
  return {
    id,
    title: `歌${id}`,
    album: null,
    year: null,
    genre: null,
    lyricist: null,
    composer: null,
    artist: null,
    length: null,
    updated_at: "",
    ...extra,
  };
}

const SONGS: Song[] = [
  song(1, {
    title: "倾尽天下",
    type: ["原创"],
    year: 2010,
    genre: ["古风"],
    artist: ["河图"],
    lyricist: ["Vagary"],
    composer: ["小魂"],
  }),
  song(2, {
    title: "如花",
    type: ["原创"],
    year: 2012,
    genre: ["古风"],
    artist: ["河图"],
    lyricist: ["Finale"],
    arranger: ["李萌"],
  }),
  song(3, {
    title: "江南雨",
    type: ["翻唱"],
    year: 2015,
    genre: ["流行"],
    artist: ["司夏"],
    composer: ["李萌"],
  }),
  song(4, {
    title: "雨碎江南",
    type: ["合作"],
    year: 2015,
    artist: ["河图", "司夏"],
    lyricist: ["Finale"],
  }),
  song(5, { title: "越人歌", year: null, genre: ["古风"], artist: ["汐音社"] }),
  song(6, {
    title: "风起天阑",
    type: ["原创"],
    year: 2020,
    genre: ["民谣"],
    artist: [],
    arranger: ["李萌"],
  }),
];

const filters = (patch: Partial<LibraryFilters> = {}): LibraryFilters => ({
  type: FILTER_OPTION_ALL,
  year: null,
  facets: emptyFacets(),
  ...patch,
});

const withFacet = (key: FacetKey, sel: FacetSelection) =>
  filters({ facets: { ...emptyFacets(), [key]: sel } });

const ids = (songs: Song[]) => songs.map((s) => s.id);

describe("buildLibraryOptions", () => {
  const options = buildLibraryOptions(SONGS);

  it("类型：全部在最前，按约定顺序，缺失的归入未知", () => {
    expect(options.types[0]).toBe(FILTER_OPTION_ALL);
    expect(options.types.at(-1)).toBe(FILTER_OPTION_UNKNOWN);
    expect(options.types.slice(1, -1)).toEqual(["原创", "合作", "翻唱"]);
  });

  it("年份从新到旧，未知在最右", () => {
    expect(options.years).toEqual([
      2020,
      2015,
      2012,
      2010,
      FILTER_OPTION_UNKNOWN,
    ]);
  });

  it("人名：英文在前，中文按拼音；值是归一化后的，显示原文", () => {
    expect(options.facets.lyricist).toEqual([
      { value: "finale", label: "Finale" },
      { value: "vagary", label: "Vagary" },
      { value: FILTER_OPTION_UNKNOWN, label: FILTER_OPTION_UNKNOWN },
    ]);
  });

  it("曲风按约定顺序，缺失的归入未知", () => {
    expect(options.facets.genre.map((o) => o.label)).toEqual([
      "古风",
      "流行",
      "民谣",
      FILTER_OPTION_UNKNOWN,
    ]);
  });

  it("繁体页的名字归一化成简体；同一个值只出一项", () => {
    const tw = buildLibraryOptions([
      song(1, { artist: ["河圖"] }),
      song(2, { artist: ["河图"] }),
    ]);
    expect(tw.facets.artist).toEqual([{ value: "河图", label: "河圖" }]);
  });
});

describe("matchesFacet", () => {
  it("包含：同一维度内是「或」；字段为空算未知", () => {
    const sel: FacetSelection = {
      mode: "include",
      values: ["河图", FILTER_OPTION_UNKNOWN],
    };
    expect(matchesFacet(["河图", "司夏"], sel)).toBe(true);
    expect(matchesFacet(["司夏"], sel)).toBe(false);
    expect(matchesFacet([], sel)).toBe(true);
  });

  it("排除：有一个值没被排除就命中，所以合唱仍在", () => {
    const sel: FacetSelection = { mode: "exclude", values: ["河图"] };
    expect(matchesFacet(["河图"], sel)).toBe(false);
    expect(matchesFacet(["河图", "司夏"], sel)).toBe(true);
    expect(matchesFacet([], sel)).toBe(true);
    expect(
      matchesFacet([], { mode: "exclude", values: [FILTER_OPTION_UNKNOWN] }),
    ).toBe(false);
  });

  it("不选和全选都不筛", () => {
    expect(matchesFacet([], NO_SELECTION)).toBe(true);
    expect(matchesFacet(["任何人"], ALL_SELECTED)).toBe(true);
  });

  it("排除的链接自动包含曲库后来加的人", () => {
    const sel: FacetSelection = { mode: "exclude", values: ["河图"] };
    const later = [...SONGS, song(7, { artist: ["新人"] })];
    expect(ids(filterSongs(later, withFacet("artist", sel)))).toContain(7);
  });
});

describe("年份", () => {
  const cells = buildLibraryOptions(SONGS).years; // [2020, 2015, 2012, 2010, 未知]

  it("地址栏写法往返", () => {
    for (const raw of ["2020-2015", "2018", "-2015", "2010-", "unknown"]) {
      expect(formatYear(parseYear(raw))).toBe(raw);
    }
    expect(parseYear("2020-2015")).toEqual({ newest: 2020, oldest: 2015 });
    // 和滑轨一致：左端（较新）在前；两端写反了也照样认
    expect(parseYear("-2015")).toEqual({ newest: null, oldest: 2015 });
    expect(parseYear("2010-")).toEqual({ newest: 2010, oldest: null });
    expect(parseYear("2015-2020")).toEqual({ newest: 2020, oldest: 2015 });
    expect(parseYear(null)).toBeNull();
    expect(parseYear("-")).toBeNull();
    expect(parseYear("abc")).toBeNull();
  });

  it("滑轨：最左一格是最新，拖到头的那一侧开放；最右一格是未知", () => {
    expect(yearFromSlider([0, 4], cells)).toBeNull();
    expect(yearFromSlider([0, 1], cells)).toEqual({
      newest: null,
      oldest: 2015,
    });
    expect(yearFromSlider([1, 4], cells)).toEqual({
      newest: 2015,
      oldest: null,
    });
    expect(yearFromSlider([1, 2], cells)).toEqual({
      newest: 2015,
      oldest: 2012,
    });
    expect(yearFromSlider([4, 4], cells)).toBe("unknown");
    expect(yearFromSlider([3, 3], cells)).toEqual({
      newest: 2010,
      oldest: 2010,
    });
  });

  it("滑轨位置往返不变", () => {
    for (let l = 0; l < cells.length; l++) {
      for (let r = l; r < cells.length; r++) {
        expect(yearToSlider(yearFromSlider([l, r], cells), cells)).toEqual([
          l,
          r,
        ]);
      }
    }
  });

  it("拖到最右一格包含年份未知的歌；只看未知时只有未知", () => {
    expect(matchesYear(null, { newest: 2015, oldest: null })).toBe(true);
    expect(matchesYear(null, { newest: 2015, oldest: 2012 })).toBe(false);
    expect(matchesYear(null, "unknown")).toBe(true);
    expect(matchesYear(2015, "unknown")).toBe(false);
  });

  it("曲库加了更新年份的歌：拖到最左一格的链接包含它们，闭区间的链接不变", () => {
    const later = [...SONGS, song(7, { year: 2026 })];
    const open = parseYear("-2015");
    const closed = parseYear("2020-2012");
    expect(ids(filterSongs(later, filters({ year: open })))).toContain(7);
    expect(ids(filterSongs(later, filters({ year: closed })))).toEqual(
      ids(filterSongs(SONGS, filters({ year: closed }))),
    );
  });

  it("地址栏里的年份曲库里没有时，滑轨落到区间内最近的格子", () => {
    expect(yearToSlider({ newest: 2019, oldest: 2011 }, cells)).toEqual([1, 2]);
  });
});

describe("勾选 ↔ 选择（F4）", () => {
  const options = buildLibraryOptions(SONGS).facets.artist;
  const all = options.map((o) => o.value);

  it("一个个勾选存包含；全部勾上就是全选", () => {
    expect(nextSelection(["河图"], NO_SELECTION, options)).toEqual({
      mode: "include",
      values: ["河图"],
    });
    expect(
      nextSelection(all, { mode: "include", values: ["河图"] }, options),
    ).toEqual(ALL_SELECTED);
  });

  it("在全选的基础上取消勾选存排除，继续取消还是排除", () => {
    const one = nextSelection(
      all.filter((v) => v !== "河图"),
      ALL_SELECTED,
      options,
    );
    expect(one).toEqual({ mode: "exclude", values: ["河图"] });
    const two = nextSelection(
      all.filter((v) => v !== "河图" && v !== "司夏"),
      one,
      options,
    );
    expect(two).toEqual({ mode: "exclude", values: ["河图", "司夏"] });
  });

  it("全部取消就是不选", () => {
    expect(nextSelection([], ALL_SELECTED, options)).toEqual(NO_SELECTION);
  });

  it("界面上勾着的：排除模式下是其余各项", () => {
    expect(
      checkedValues({ mode: "exclude", values: ["河图"] }, options),
    ).toEqual(all.filter((v) => v !== "河图"));
    expect(checkedValues(ALL_SELECTED, options)).toEqual(all);
    expect(
      checkedValues({ mode: "include", values: ["不存在的人"] }, options),
    ).toEqual([]);
  });
});

describe("availableFacetValues（F5）", () => {
  const options = buildLibraryOptions(SONGS);

  /** 用定义算：其他维度不变，这一维度只选这一项，结果有没有歌 */
  function brute(base: LibraryFilters, key: FacetKey, value: string): boolean {
    const f = {
      ...base,
      facets: {
        ...base.facets,
        [key]: { mode: "include", values: [value] } as FacetSelection,
      },
    };
    return filterSongs(SONGS, f).length > 0;
  }

  const combos: LibraryFilters[] = [
    filters(),
    filters({ type: "原创" }),
    filters({ year: { newest: null, oldest: 2015 } }),
    withFacet("artist", { mode: "include", values: ["河图"] }),
    withFacet("artist", { mode: "exclude", values: ["河图"] }),
    filters({
      type: "原创",
      facets: {
        ...emptyFacets(),
        genre: { mode: "include", values: ["古风"] },
        lyricist: { mode: "include", values: ["finale"] },
      },
    }),
    filters({
      year: "unknown",
      facets: {
        ...emptyFacets(),
        artist: { mode: "include", values: ["汐音社"] },
      },
    }),
  ];

  it("和按定义逐项算的结果一致", () => {
    for (const base of combos) {
      const available = availableFacetValues(SONGS, base);
      for (const key of FACET_KEYS) {
        for (const o of options.facets[key]) {
          expect([base, key, o.value, available[key].has(o.value)]).toEqual([
            base,
            key,
            o.value,
            brute(base, key, o.value),
          ]);
        }
      }
    }
  });

  it("不看本维度已经选了什么", () => {
    const base = withFacet("artist", { mode: "include", values: ["汐音社"] });
    expect(availableFacetValues(SONGS, base).artist.has("河图")).toBe(true);
  });
});

describe("拆分前后结果一致", () => {
  const fuse = createFuseInstance(SONGS);
  const options = buildLibraryOptions(SONGS);
  const sliderYears = options.years;

  /** 旧写法：一次调用里搜索加筛选 */
  function oldPipeline(
    query: string,
    type: string,
    yearRange: [number, number],
    artist: string[],
    genre: string[],
  ) {
    const full = yearRange[0] === 0 && yearRange[1] === sliderYears.length - 1;
    const selectedYear = full
      ? FILTER_OPTION_ALL
      : sliderYears.slice(yearRange[0], yearRange[1] + 1);
    return searchAndFilterSongs(
      SONGS,
      query,
      type,
      selectedYear,
      [],
      [],
      [],
      genre,
      artist,
      fuse,
    ).songs;
  }

  function newPipeline(
    query: string,
    type: string,
    yearRange: [number, number],
    artist: string[],
    genre: string[],
  ) {
    const pool = legacySearch(SONGS, query, fuse)?.songs ?? SONGS;
    return filterSongs(
      pool,
      filters({
        type,
        year: yearFromSlider(yearRange, sliderYears),
        facets: {
          ...emptyFacets(),
          artist: { mode: "include", values: artist },
          genre: { mode: "include", values: genre },
        },
      }),
    );
  }

  it("搜索、类型、年份、人名、曲风的各种组合，结果和顺序都相同", () => {
    const queries = ["", "江南", "河图", "天"];
    const types = [FILTER_OPTION_ALL, "原创", FILTER_OPTION_UNKNOWN];
    const ranges: [number, number][] = [];
    for (let l = 0; l < sliderYears.length; l++) {
      for (let r = l; r < sliderYears.length; r++) ranges.push([l, r]);
    }
    const artists = [
      [],
      ["河图"],
      ["司夏", FILTER_OPTION_UNKNOWN],
      [FILTER_OPTION_UNKNOWN],
    ];
    const genres = [[], ["古风"], ["流行", FILTER_OPTION_UNKNOWN]];
    for (const q of queries)
      for (const type of types)
        for (const range of ranges)
          for (const artist of artists)
            for (const genre of genres) {
              expect(ids(newPipeline(q, type, range, artist, genre))).toEqual(
                ids(oldPipeline(q, type, range, artist, genre)),
              );
            }
  });
});
