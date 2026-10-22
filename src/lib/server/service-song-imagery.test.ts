import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { makeQueryBuilder } from "@/test/mockSupabase";

// 别名归并另有单测（utils-credits），这里默认不登记任何别名
vi.mock("@/lib/server/service-credit-aliases", () => ({
  getCreditAliases: vi.fn(async () => new Map()),
}));

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
import { GRAY_PALETTE, PALETTE_FULL } from "@/lib/imagery/palette";
import { getSongImagery } from "./service-song-imagery";

// ─── 测试数据 ────────────────────────────────────────────────────────────────
// 母题「月」写得多（明月、月光都算）、「剑」次之、「江湖」少见；
// 流云（15）的母题找不到一级分类；风雨（16）是并列词，有风、雨两条标注

const categories = [
  { id: 1, name: "自然", parent_id: null, level: 1 },
  { id: 2, name: "天象", parent_id: 1, level: 2 },
  { id: 3, name: "月", parent_id: 2, level: 3 },
  { id: 20, name: "风", parent_id: 2, level: 3 },
  { id: 21, name: "雨", parent_id: 2, level: 3 },
  { id: 4, name: "人事", parent_id: null, level: 1 },
  { id: 5, name: "器物", parent_id: 4, level: 2 },
  { id: 7, name: "剑", parent_id: 5, level: 3 },
  { id: 8, name: "江湖", parent_id: 4, level: 3 },
  { id: 6, name: "飘零", parent_id: 99, level: 3 },
];

const imagery = [
  { id: 10, name: "明月" },
  { id: 11, name: "长剑" },
  { id: 12, name: "月光" },
  { id: 13, name: "" },
  { id: 14, name: "江湖" },
  { id: 15, name: "流云" },
  { id: 16, name: "风雨" },
];

const songs = [
  { id: 1, title: "闲看波澜生", artist: ["河图"], hascover: true },
  { id: 2, title: "闲看波澜生（纯歌版）", artist: ["河图"], hascover: true },
  { id: 3, title: "长剑甲", artist: ["河图"], hascover: false },
  { id: 4, title: "乙", artist: null, hascover: null },
  { id: 5, title: "丙", artist: null, hascover: null },
  { id: 6, title: "丁", artist: null, hascover: null },
  { id: 7, title: "戊", artist: null, hascover: null },
  { id: 8, title: "己", artist: null, hascover: null },
  { id: 9, title: "长剑甲（DJ版）", artist: null, hascover: null },
];

function occ(
  song_id: number,
  imagery_id: number,
  category_id: number,
  lyric_timetag: string[] | null = null,
) {
  return { song_id, imagery_id, category_id, lyric_timetag };
}

const occurrences = [
  // 本曲：明月出现两次，时间标签合并
  occ(1, 10, 3, ["00:10.00"]),
  occ(1, 10, 3, ["00:40.00"]),
  occ(1, 11, 7),
  occ(1, 13, 3),
  occ(1, 15, 6, ["00:20.00"]),
  // 并列词：两条标注、同一处高亮，时间标签不重复
  occ(1, 16, 20, ["00:30.00"]),
  occ(1, 16, 21, ["00:30.00"]),
  // 纯歌版与原曲同源，不推荐
  occ(2, 10, 3),
  occ(2, 11, 7),
  // 与本曲共有两个母题
  occ(3, 10, 3),
  occ(3, 11, 7),
  // 写的是「月光」，与本曲的「明月」同属母题「月」
  occ(4, 12, 3),
  occ(5, 11, 7),
  occ(5, 14, 8),
  occ(6, 10, 3),
  // 没有共同母题
  occ(7, 14, 8),
  occ(8, 10, 3),
  // 与 3 同源（DJ 版），同分时只留先出现的那首
  occ(9, 10, 3),
  occ(9, 11, 7),
  // 不在曲库里的歌（如资料存疑）不计入作品数，也不被推荐
  occ(500, 11, 7),
];

type Tables = {
  categories: unknown[];
  imagery: unknown[];
  occurrences: unknown[];
  songs: unknown[];
};

function mockClient(overrides: Partial<Tables> = {}) {
  const rows: Tables = {
    categories,
    imagery,
    occurrences,
    songs,
    ...overrides,
  };
  const byTable: Record<string, unknown[]> = {
    [TABLES.IMAGERY_CAT]: rows.categories,
    [TABLES.IMAGERY]: rows.imagery,
    [TABLES.IMAGERY_OCC]: rows.occurrences,
    [TABLES.MUSIC_CATALOG]: rows.songs,
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
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("getSongImagery", () => {
  it("本曲意象：带母题路径、一级分类配色、合并的时间标签与全库作品数", async () => {
    mockClient();
    const { marks } = await getSongImagery(1, "zh-CN");

    expect(marks).toEqual([
      // 作品数按母题算：写月光的 4 也计入
      {
        id: 10,
        name: "明月",
        path: ["自然", "天象", "月"],
        accent: PALETTE_FULL[0].accent,
        timetags: ["00:10.00", "00:40.00"],
        songCount: 7,
      },
      {
        id: 11,
        name: "长剑",
        path: ["人事", "器物", "剑"],
        accent: PALETTE_FULL[1].accent,
        timetags: [],
        songCount: 5,
      },
      // 无名意象（13）略去；流云的母题接不上一级分类，用灰色
      {
        id: 15,
        name: "流云",
        path: ["飘零"],
        accent: GRAY_PALETTE.accent,
        timetags: ["00:20.00"],
        songCount: 1,
      },
      // 并列词只出一处高亮，说明取第一条标注的母题
      {
        id: 16,
        name: "风雨",
        path: ["自然", "天象", "风"],
        accent: PALETTE_FULL[0].accent,
        timetags: ["00:30.00"],
        songCount: 1,
      },
    ]);
  });

  it("相关作品：少见的共同母题权重更高，同源版本不推荐，最多四首", async () => {
    mockClient();
    const { related } = await getSongImagery(1, "zh-CN");

    // 3 共有两个母题排第一；9 与 3 同源、2 与本曲同源，都不出现；
    // 只共有「月」的 4（写的是月光）、6、8 胜过只共有「剑」、却另有少见母题江湖的 5，5 被上限挤掉
    expect(related.map((r) => r.id)).toEqual([3, 4, 6, 8]);
    expect(related[0]).toEqual({
      id: 3,
      title: "长剑甲",
      artist: ["河图"],
      hascover: false,
      // 共有母题按少见程度排序
      shared: ["剑", "月"],
    });
  });

  it("繁体站点转换意象名、分类、歌名与歌手", async () => {
    mockClient();
    const { marks, related } = await getSongImagery(1, "zh-TW");

    expect(marks[1]).toMatchObject({
      name: "長劍",
      path: ["人事", "器物", "劍"],
    });
    expect(related[0]).toMatchObject({
      title: "長劍甲",
      artist: ["河圖"],
      shared: ["劍", "月"],
    });
  });

  it("不在曲库里的歌：自己的详情页照常标意象、推荐相关作品", async () => {
    mockClient();
    const { marks, related } = await getSongImagery(500, "zh-CN");

    // 作品数只算曲库里的歌：长剑出现在 1、2、3、5、9
    expect(marks).toEqual([expect.objectContaining({ id: 11, songCount: 5 })]);
    expect(related.length).toBeGreaterThan(0);
    expect(related.map((r) => r.id)).not.toContain(500);
  });

  it("没有标注的歌：意象与相关作品都为空", async () => {
    mockClient();
    expect(await getSongImagery(404, "zh-CN")).toEqual({
      marks: [],
      related: [],
    });
  });

  it("Supabase 未配置或索引为空时降级为空结果，不抛错", async () => {
    vi.mocked(getServiceClient).mockReturnValue(null);
    expect(await getSongImagery(1, "zh-CN")).toEqual({
      marks: [],
      related: [],
    });

    mockClient({ occurrences: [] });
    expect(await getSongImagery(1, "zh-CN")).toEqual({
      marks: [],
      related: [],
    });
    expect(console.error).toHaveBeenCalledTimes(2);
  });
});
