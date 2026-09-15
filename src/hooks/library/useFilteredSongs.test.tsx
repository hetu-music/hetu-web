// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import type { Song } from "@/lib/types";
import { useFilteredSongs } from "./useFilteredSongs";

// 歌词索引在挂载 1 秒后才开始拉取，测试里不触发；仍然 stub 掉 fetch 以防意外发请求
vi.stubGlobal(
  "fetch",
  vi.fn(async () => ({ ok: true, json: async () => [] })),
);

function makeSong(overrides: Partial<Song>): Song {
  return {
    id: 1,
    title: "歌曲",
    album: "专辑",
    artist: ["河图"],
    lyricist: ["finale"],
    composer: ["河图"],
    arranger: ["河图"],
    genre: ["古风"],
    type: ["原创"],
    date: "2012-05-01",
    year: 2012,
    ...overrides,
  } as unknown as Song;
}

const SONGS: Song[] = [
  makeSong({ id: 1, title: "倾尽天下", date: "2010-03-01", year: 2010 }),
  makeSong({
    id: 2,
    title: "如花",
    genre: ["流行"],
    type: ["翻唱"],
    date: "2012-06-01",
    year: 2012,
    lyricist: ["某甲"],
  }),
  makeSong({
    id: 3,
    title: "第三首",
    artist: ["其他人"],
    date: "2015-01-01",
    year: 2015,
  }),
];

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

type Options = Parameters<typeof useFilteredSongs>[0];

/** 测试数据里出现过的年份，升序 */
const ALL_YEARS = [...new Set(SONGS.map((s) => s.year))]
  .filter((y): y is number => typeof y === "number")
  .sort((a, b) => a - b);

function renderFiltered(overrides: Partial<Options> = {}) {
  const merged: Options = {
    songs: SONGS,
    searchQuery: "",
    filterType: "全部",
    filterGenre: [],
    filterLyricist: [],
    filterComposer: [],
    filterArranger: [],
    filterArtist: [],
    // 默认让年份区间覆盖全部年份，即「未按年份筛选」
    sliderYears: ALL_YEARS,
    yearRangeIndices: [0, ALL_YEARS.length - 1],
    ...overrides,
  };
  return renderHook(() => useFilteredSongs(merged), { wrapper });
}

afterEach(() => cleanup());

describe("useFilteredSongs — 筛选", () => {
  it("无任何筛选时返回全部歌曲", () => {
    const { result } = renderFiltered();
    expect(result.current.filteredSongs).toHaveLength(3);
    expect(result.current.isAnyFilterActive).toBe(false);
  });

  it("按类型筛选", () => {
    const { result } = renderFiltered({ filterType: "翻唱" });
    expect(result.current.filteredSongs.map((s) => s.id)).toEqual([2]);
    expect(result.current.isAnyFilterActive).toBe(true);
  });

  it("按流派筛选", () => {
    const { result } = renderFiltered({ filterGenre: ["流行"] });
    expect(result.current.filteredSongs.map((s) => s.id)).toEqual([2]);
  });

  it("按作词筛选", () => {
    const { result } = renderFiltered({ filterLyricist: ["某甲"] });
    expect(result.current.filteredSongs.map((s) => s.id)).toEqual([2]);
  });

  it("按演唱筛选", () => {
    const { result } = renderFiltered({ filterArtist: ["其他人"] });
    expect(result.current.filteredSongs.map((s) => s.id)).toEqual([3]);
  });

  it("多个条件同时生效时取交集", () => {
    const { result } = renderFiltered({
      filterType: "翻唱",
      filterGenre: ["古风"], // 与 id=2 的流派不符
    });
    expect(result.current.filteredSongs).toHaveLength(0);
  });
});

describe("useFilteredSongs — 年份区间", () => {
  it("区间覆盖全部年份时视为未筛选", () => {
    const { result } = renderFiltered();
    expect(result.current.filteredSongs).toHaveLength(3);
    expect(result.current.isAnyFilterActive).toBe(false);
  });

  it("收窄区间后只保留区间内的年份", () => {
    const { result } = renderFiltered({
      yearRangeIndices: [0, 0], // 只留最早那一年
    });
    expect(result.current.filteredSongs.map((s) => s.id)).toEqual([1]);
    expect(result.current.isAnyFilterActive).toBe(true);
  });
});

describe("useFilteredSongs — 搜索防抖", () => {
  it("空搜索词立即生效，不经过防抖", () => {
    const { result } = renderFiltered({ searchQuery: "" });
    expect(result.current.searchQueryForFiltering).toBe("");
    expect(result.current.filteredSongs).toHaveLength(3);
  });

  it("非空搜索词经防抖后才应用，并能命中标题", async () => {
    const { result } = renderFiltered({ searchQuery: "倾尽天下" });

    await waitFor(
      () => expect(result.current.searchQueryForFiltering).toBe("倾尽天下"),
      { timeout: 2000 },
    );
    await waitFor(() =>
      expect(result.current.filteredSongs.map((s) => s.id)).toEqual([1]),
    );
  });
});

describe("useFilteredSongs — 歌词索引", () => {
  it("索引未就绪时状态为 idle，且不影响普通筛选", () => {
    const { result } = renderFiltered();
    expect(result.current.lyricsState).toBe("idle");
    expect(result.current.lyricsMap.size).toBe(0);
    expect(result.current.filteredSongs).toHaveLength(3);
  });

  it("没有搜索词时不产生歌词命中区间", () => {
    const { result } = renderFiltered();
    expect(result.current.lyricMatchesById.size).toBe(0);
  });
});
