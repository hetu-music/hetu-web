// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { song } from "@/lib/search/test-fixtures";
import type { SongDetail } from "@/lib/types";
import { useSongs } from "./useSongs";

const SONGS = [
  song(1, "江南雨", { date: "2010-01-01" }),
  song(2, "江南", { date: "2008-01-01" }),
  song(3, "倾尽天下", { date: "2012-01-01", artist: ["江南"] }),
  song(4, "长安", { date: "2015-01-01" }),
] as SongDetail[];

const ids = (songs: SongDetail[]) => songs.map((s) => s.id);

describe("后台歌曲列表的搜索", () => {
  it("没有搜索词时按日期从新到旧", () => {
    const { result } = renderHook(() => useSongs(SONGS, ""));
    expect(ids(result.current)).toEqual([4, 3, 1, 2]);
  });

  it("有搜索词时按档位排：题名完全对上、题名开头、人名；同档按日期", () => {
    const { result } = renderHook(() => useSongs(SONGS, "江南"));
    expect(ids(result.current)).toEqual([2, 1, 3]);
  });

  it("繁体输入也能搜到", () => {
    const { result } = renderHook(() => useSongs(SONGS, "長安"));
    expect(ids(result.current)).toEqual([4]);
  });
});
