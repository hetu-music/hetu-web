import { describe, it, expect } from "vitest";
import {
  countCatalogSongs,
  getCoverUrl,
  getNmnUrl,
  mapAndSortSongs,
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
