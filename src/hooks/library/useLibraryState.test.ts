// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetUrlStateForTests } from "@/hooks/utils/useUrlState";
import { buildLibraryOptions } from "@/lib/library/filters";
import type { Song } from "@/lib/types";
import { useLibraryState } from "./useLibraryState";

function song(id: number, extra: Partial<Song>): Song {
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

const OPTIONS = buildLibraryOptions([
  song(1, { artist: ["河图"], year: 2010 }),
  song(2, { artist: ["司夏"], year: 2015 }),
  song(3, { artist: ["李萌"], year: 2020 }),
]);
const ALL = ["李萌", "河图", "司夏"].sort();

const search = () => new URLSearchParams(window.location.search);

beforeEach(() => {
  vi.useFakeTimers();
  resetUrlStateForTests();
  window.history.replaceState(null, "", "/?page=2");
});
afterEach(() => vi.useRealTimers());

function setup() {
  return renderHook(() => useLibraryState(OPTIONS));
}

describe("useLibraryState", () => {
  it("全选：地址栏不写，界面上全部勾着；再取消一个就存排除", () => {
    const { result } = setup();
    act(() => result.current.setFacetChecked("artist", ALL));
    act(() => vi.runAllTimers());
    expect(search().has("artist")).toBe(false);
    expect(search().has("artistNot")).toBe(false);
    expect([...result.current.checked.artist].sort()).toEqual(ALL);
    expect(result.current.isAnyFilterActive).toBe(true);

    act(() =>
      result.current.setFacetChecked(
        "artist",
        ALL.filter((v) => v !== "河图"),
      ),
    );
    act(() => vi.runAllTimers());
    expect(search().getAll("artistNot")).toEqual(["河图"]);
  });

  it("改筛选时页码回到第一页，只写一次地址栏", () => {
    const replace = vi.spyOn(window.history, "replaceState");
    const { result } = setup();
    act(() => result.current.setFacetChecked("artist", ["司夏"]));
    act(() => vi.runAllTimers());
    expect(replace).toHaveBeenCalledTimes(1);
    expect(search().toString()).toBe(
      new URLSearchParams({ artist: "司夏" }).toString(),
    );
    replace.mockRestore();
  });

  it("搜索框：立刻显示，停下 300 毫秒才写进地址栏；清空立刻生效", () => {
    const { result } = setup();
    act(() => result.current.setSearchInput("天下"));
    expect(result.current.searchInput).toBe("天下");
    expect(result.current.query).toBe("");
    act(() => vi.advanceTimersByTime(300));
    expect(result.current.query).toBe("天下");
    act(() => vi.runAllTimers());
    expect(search().get("q")).toBe("天下");
    expect(search().has("page")).toBe(false);

    act(() => result.current.setSearchInput(""));
    expect(result.current.query).toBe("");
  });

  it("年份滑轨：拖到最左（最新）那一侧开放", () => {
    const { result } = setup();
    // 格子：[2020, 2015, 2010]
    act(() => result.current.setYearSlider([0, 1]));
    act(() => vi.advanceTimersByTime(300));
    act(() => vi.runAllTimers());
    expect(search().get("year")).toBe("-2015");
    expect(result.current.yearSlider).toEqual([0, 1]);
  });

  it("重置：清空筛选和全选的记号，保留视图", () => {
    window.history.replaceState(null, "", "/?view=list&type=原创&artist=河图");
    const { result } = setup();
    act(() => result.current.setFacetChecked("lyricist", []));
    act(() => result.current.resetAll());
    act(() => vi.runAllTimers());
    expect(search().toString()).toBe("view=list");
    expect(result.current.isAnyFilterActive).toBe(false);
  });
});
