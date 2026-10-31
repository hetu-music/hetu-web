import { describe, expect, it } from "vitest";
import {
  buildGalleryPool,
  GALLERY_SIZE,
  pickGallery,
  type GallerySong,
} from "./auth-gallery";
import { groupMarks } from "@/lib/utils/utils-excerpt";

const LRC = `[00:01.00]河图 - 测试
[00:03.00]词：某人
[00:10.00]一曲终了人未散
[00:14.00]灯火阑珊处
[00:18.00]谁在等你回来`;

describe("buildGalleryPool", () => {
  it("keeps songs that yield an excerpt", () => {
    const pool = buildGalleryPool(
      [{ id: 1, title: "测试", lyrics: LRC }],
      "zh-CN",
    );
    expect(pool).toHaveLength(1);
    expect(pool[0].id).toBe(1);
    expect(pool[0].excerpt.length).toBeGreaterThan(0);
  });

  it("drops songs without title or lyrics", () => {
    const pool = buildGalleryPool(
      [
        { id: 1, title: null, lyrics: LRC },
        { id: 2, title: "无词", lyrics: null },
        { id: 3, title: "空", lyrics: "" },
      ],
      "zh-CN",
    );
    expect(pool).toEqual([]);
  });

  it("picks the line with the most imagery, like the song page", () => {
    const marks = groupMarks(
      [
        { song_id: 1, imagery_id: 7, lyric_timetag: ["00:14.00"] },
        { song_id: 2, imagery_id: 7, lyric_timetag: ["00:10.00"] },
      ],
      [{ id: 7, name: "灯火" }],
    );
    const [song] = buildGalleryPool(
      [{ id: 1, title: "测试", lyrics: LRC }],
      "zh-CN",
      marks,
    );
    expect(song.excerpt.replace(/ /g, "")).toBe("灯火阑珊处");
    const [plain] = buildGalleryPool(
      [{ id: 1, title: "测试", lyrics: LRC }],
      "zh-CN",
    );
    expect(plain.excerpt.replace(/ /g, "")).toBe("一曲终了人未散");
  });

  it("matches traditional imagery names for zh-TW", () => {
    // 没有时间标签时按意象名搜全文，名字也得转成繁体才对得上
    const marks = groupMarks(
      [{ song_id: 1, imagery_id: 7, lyric_timetag: null }],
      [{ id: 7, name: "灯火" }],
    );
    const [song] = buildGalleryPool(
      [{ id: 1, title: "测试", lyrics: LRC }],
      "zh-TW",
      marks,
    );
    expect(song.excerpt.replace(/ /g, "")).toBe("燈火闌珊處");
  });

  it("converts title and excerpt for zh-TW", () => {
    const [song] = buildGalleryPool(
      [{ id: 1, title: "灯火", lyrics: LRC }],
      "zh-TW",
    );
    expect(song.title).toBe("燈火");
    expect(song.excerpt).not.toMatch(/[灯阑处谁来]/);
  });
});

describe("pickGallery", () => {
  const pool: GallerySong[] = Array.from({ length: 50 }, (_, i) => ({
    id: i,
    title: `t${i}`,
    excerpt: `e${i}`,
  }));

  it("returns at most GALLERY_SIZE distinct songs", () => {
    const picked = pickGallery(pool);
    expect(picked).toHaveLength(GALLERY_SIZE);
    expect(new Set(picked.map((s) => s.id)).size).toBe(GALLERY_SIZE);
  });

  it("returns everything when the pool is small", () => {
    expect(pickGallery(pool.slice(0, 5))).toHaveLength(5);
  });

  it("does not mutate the pool", () => {
    const copy = pool.map((s) => s.id);
    pickGallery(pool);
    expect(pool.map((s) => s.id)).toEqual(copy);
  });
});
