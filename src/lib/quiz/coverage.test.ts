import { describe, expect, it } from "vitest";
import { checkCoverage } from "./coverage";
import { MIN_OCCURRENCES, type PoolRows } from "./pool";

const categories: PoolRows["categories"] = [
  { id: 1, name: "自然", parent_id: null, level: 1 },
  { id: 10, name: "天象", parent_id: 1, level: 2 },
  { id: 11, name: "光阴", parent_id: 1, level: 2 },
  { id: 12, name: "新分类", parent_id: 1, level: 2 },
  { id: 100, name: "月", parent_id: 10, level: 3 },
  { id: 110, name: "岁月", parent_id: 11, level: 3 },
  { id: 120, name: "其他", parent_id: 12, level: 3 },
];

const imagery = [
  { id: 1, name: "月" },
  { id: 2, name: "皓月" },
  { id: 3, name: "岁月" },
  { id: 4, name: "风月" },
  { id: 5, name: "风" },
  { id: 6, name: "某物" },
];

type Occ = PoolRows["occurrences"][number];
const occ = (
  song_id: number,
  imagery_id: number,
  category_id: number,
): Occ => ({
  song_id,
  imagery_id,
  category_id,
  lyric_timetag: null,
});

function song(
  id: number,
  title = `歌${id}`,
  type: string[] | null = null,
  lyrics: string | null = "[00:01.00]词",
) {
  return {
    id,
    title,
    artist: null,
    album: null,
    hascover: null,
    has_audio: null,
    type,
    lyrics,
  };
}

/** 歌 1–5 各含 月/皓月/岁月/风月/风 */
const songIds = [1, 2, 3, 4, 5];
const occurrences: Occ[] = songIds.flatMap((id) => [
  occ(id, 1, 100),
  occ(id, 2, 100),
  occ(id, 3, 110),
  occ(id, 4, 100),
  occ(id, 5, 100),
]);

const report = checkCoverage({
  categories,
  imagery,
  occurrences: [...occurrences, occ(1, 6, 120)],
  songs: [
    ...songIds.map((id) => song(id)),
    song(20, "翻唱歌", ["翻唱"]),
    song(21, "某歌（纯歌版）"),
    song(22, "无词歌", null, null),
  ],
});

describe("checkCoverage", () => {
  it("列出类型允许入池但标注不足的歌曲，按标注数从多到少", () => {
    expect(report.pendingSongs[0]).toEqual({
      id: 1,
      title: "歌1",
      occurrences: 6,
      hasLyrics: true,
    });
    expect(
      report.pendingSongs.every((s) => s.occurrences < MIN_OCCURRENCES),
    ).toBe(true);
    const titles = report.pendingSongs.map((s) => s.title);
    expect(titles).toContain("无词歌");
    expect(titles).not.toContain("翻唱歌");
    expect(titles).not.toContain("某歌（纯歌版）");
    expect(report.pendingSongs.find((s) => s.id === 22)?.hasLyrics).toBe(false);
  });

  it("报告未映射到维度的二级分类及其标注数", () => {
    expect(report.unmappedCategories).toEqual([
      { name: "新分类", occurrences: 1 },
    ]);
  });

  it("报告映射引用但数据库已不存在的二级分类", () => {
    expect(report.missingCategories).toContain("山水");
    expect(report.missingCategories).not.toContain("天象");
  });

  it("报告招牌意象指向、但数据库中不存在的母题", () => {
    // 测试数据只有母题「月」「岁月」「其他」
    expect(report.missingMotifs).toContainEqual({
      signature: "风",
      motif: "风",
    });
    expect(report.missingMotifs).toContainEqual({
      signature: "星辰",
      motif: "星",
    });
    expect(report.missingMotifs.map((m) => m.motif)).not.toContain("月");
  });
});
