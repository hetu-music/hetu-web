import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { makeQueryBuilder } from "@/test/mockSupabase";

vi.mock("@/lib/db/supabase-server", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/db/supabase-server")>();
  return { ...actual, getServiceClient: vi.fn() };
});

// unstable_cache 依赖 Next.js 的增量缓存，测试里直接透传，每次调用都重新查询
vi.mock("next/cache", () => ({
  unstable_cache: <T extends (...args: never[]) => unknown>(fn: T) => fn,
}));

import { getServiceClient, TABLES } from "@/lib/db/supabase-server";
import { getImageryCloud, getMotifDetail } from "./service-imagery-cloud";

// ─── 测试数据 ────────────────────────────────────────────────────────────────
// 母题「月」有明月、月光两种写法；「烟花」是多义词，两首歌指焰火、一首指春；
// 9 号歌不在曲库里（资料存疑），不计入任何统计

const categories = [
  { id: 1, name: "自然", parent_id: null, level: 1, description: null },
  { id: 2, name: "天象", parent_id: 1, level: 2, description: null },
  { id: 3, name: "月", parent_id: 2, level: 3, description: "月亮与月光" },
  { id: 4, name: "风", parent_id: 2, level: 3, description: null },
  { id: 13, name: "焰火", parent_id: 2, level: 3, description: null },
  { id: 16, name: "时令", parent_id: 1, level: 2, description: null },
  { id: 15, name: "春", parent_id: 16, level: 3, description: null },
  { id: 10, name: "人文", parent_id: null, level: 1, description: null },
  { id: 11, name: "器物", parent_id: 10, level: 2, description: null },
  { id: 12, name: "剑", parent_id: 11, level: 3, description: null },
];

const imagery = [
  { id: 20, name: "明月" },
  { id: 21, name: "月光" },
  { id: 22, name: "长剑" },
  { id: 23, name: "烟花" },
  { id: 24, name: "风" },
];

const songs = [
  { id: 1, title: "长歌", date: "2020-05-01", lyricist: ["甲"] },
  { id: 2, title: "乙", date: "2022-01-01", lyricist: null },
  { id: 3, title: "丙", date: "2021-03-03", lyricist: ["丙"] },
];

const occ = (song_id: number, imagery_id: number, category_id: number) => ({
  song_id,
  imagery_id,
  category_id,
});

const occurrences = [
  occ(1, 20, 3),
  occ(1, 22, 12),
  occ(1, 23, 13),
  occ(2, 21, 3),
  occ(2, 20, 3),
  occ(2, 23, 13),
  occ(2, 24, 4),
  occ(3, 23, 15),
  occ(9, 20, 3),
];

function mockClient() {
  const byTable: Record<string, unknown[]> = {
    [TABLES.IMAGERY_CAT]: categories,
    [TABLES.IMAGERY]: imagery,
    [TABLES.IMAGERY_OCC]: occurrences,
    [TABLES.MUSIC_CATALOG]: songs,
  };
  const from = vi.fn((table: string) =>
    makeQueryBuilder({ data: byTable[table], error: null }),
  );
  vi.mocked(getServiceClient).mockReturnValue({ from } as unknown as ReturnType<
    typeof getServiceClient
  >);
}

beforeEach(() => {
  vi.mocked(getServiceClient).mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("getImageryCloud", () => {
  it("母题按二级分类成组：门类按固定顺序，同门类里写得多的组在前，组内按作品数排", async () => {
    mockClient();
    const cloud = await getImageryCloud("zh-CN");

    expect(cloud.l1).toEqual([
      { id: 1, name: "自然", palette: 0 },
      { id: 10, name: "人文", palette: 1 },
    ]);
    expect(
      cloud.groups.map((g) => [g.name, g.motifs.map((m) => m.name)]),
    ).toEqual([
      ["天象", ["月", "焰火", "风"]],
      ["时令", ["春"]],
      ["器物", ["剑"]],
    ]);
    expect(cloud.motifCount).toBe(5);
    // 作品数按歌去重，不在曲库里的 9 号不算
    expect(cloud.groups[0].motifs[0]).toEqual({
      id: 3,
      name: "月",
      l1: 1,
      l2: 2,
      palette: 0,
      songCount: 2,
      wordCount: 2,
    });
    expect(cloud.groups[2].motifs[0].palette).toBe(1);
  });

  it("全部词：多义词合计各母题的作品，点它时去作品最多的那个母题", async () => {
    mockClient();
    const { words } = await getImageryCloud("zh-CN");

    expect(words.map((w) => [w.name, w.songCount])).toEqual([
      ["烟花", 3],
      ["明月", 2],
      ["月光", 1],
      ["长剑", 1],
      ["风", 1],
    ]);
    expect(words[0]).toMatchObject({ motif: 13, l1: 1, l2: 2, palette: 0 });
  });

  it("繁体站点转换分类、母题与词", async () => {
    mockClient();
    const cloud = await getImageryCloud("zh-TW");

    expect(cloud.groups.map((g) => g.name)).toContain("時令");
    expect(cloud.groups[0].motifs.map((m) => m.name)).toContain("風");
    expect(cloud.words.map((w) => w.name)).toContain("長劍");
  });

  it("Supabase 未配置时抛错，由页面兜底", async () => {
    vi.mocked(getServiceClient).mockReturnValue(null);
    await expect(getImageryCloud("zh-CN")).rejects.toThrow();
  });
});

describe("getMotifDetail", () => {
  it("母题的写法与作品：作品新的在前，带上本曲用到的写法", async () => {
    mockClient();
    const detail = await getMotifDetail(3, "zh-CN");

    expect(detail).toMatchObject({
      id: 3,
      name: "月",
      path: ["自然", "天象"],
      palette: 0,
      description: "月亮与月光",
      songCount: 2,
      words: [
        { id: 20, name: "明月", songCount: 2 },
        { id: 21, name: "月光", songCount: 1 },
      ],
    });
    expect(detail?.works).toEqual([
      { id: 2, title: "乙", year: "2022", lyricist: null, wordIds: [21, 20] },
      { id: 1, title: "长歌", year: "2020", lyricist: ["甲"], wordIds: [20] },
    ]);
  });

  it("多义词只列在本母题下的作品", async () => {
    mockClient();
    const spring = await getMotifDetail(15, "zh-CN");

    expect(spring?.words).toEqual([{ id: 23, name: "烟花", songCount: 1 }]);
    expect(spring?.works.map((w) => w.id)).toEqual([3]);
  });

  it("繁体站点转换母题、写法、歌名与词作者", async () => {
    mockClient();
    const sword = await getMotifDetail(12, "zh-TW");

    expect(sword).toMatchObject({
      name: "劍",
      words: [{ name: "長劍" }],
      works: [{ title: "長歌", lyricist: ["甲"] }],
    });
  });

  it("不是母题，或曲库里没有歌写到它，返回 null", async () => {
    mockClient();
    expect(await getMotifDetail(2, "zh-CN")).toBeNull();
    expect(await getMotifDetail(999, "zh-CN")).toBeNull();
  });
});
