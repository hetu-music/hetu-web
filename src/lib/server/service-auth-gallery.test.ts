import { describe, it, expect, vi, beforeEach } from "vitest";

// unstable_cache 依赖 Next.js 的增量缓存，测试里直接透传，每次调用都重新查询
vi.mock("next/cache", () => ({
  unstable_cache: <T extends (...args: never[]) => unknown>(fn: T) => fn,
}));

vi.mock("@/lib/db/supabase-server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/db/supabase-server")>()),
  getServiceClient: vi.fn(),
  fetchAll: vi.fn(),
}));

vi.mock("@/lib/server/imagery-index", () => ({
  loadImageryIndex: vi.fn(),
}));

vi.mock("@/lib/utils/utils-excerpt", () => ({
  groupMarks: vi.fn(() => new Map()),
}));

vi.mock("@/lib/auth-gallery", () => ({
  buildGalleryPool: vi.fn(),
  pickGallery: vi.fn((pool: unknown[]) => pool),
}));

import { buildGalleryPool, pickGallery } from "@/lib/auth-gallery";
import { fetchAll, getServiceClient } from "@/lib/db/supabase-server";
import { loadImageryIndex } from "@/lib/server/imagery-index";
import { groupMarks } from "@/lib/utils/utils-excerpt";
import { makeQueryBuilder } from "@/test/mockSupabase";
import { getAuthGallery } from "./service-auth-gallery";

const index = { occurrences: [{ id: 1 }], imagery: [{ id: 2 }] };
const rows = [{ id: 1, title: "歌", lyrics: "词", lyrics_start: null }];
const pool = [{ id: 1, title: "歌", excerpt: "词" }];

beforeEach(() => {
  vi.mocked(getServiceClient).mockReset();
  vi.mocked(fetchAll).mockReset();
  vi.mocked(loadImageryIndex).mockReset();
  vi.mocked(buildGalleryPool).mockReset();
  vi.mocked(pickGallery).mockClear();
  vi.mocked(getServiceClient).mockReturnValue({} as never);
  vi.mocked(fetchAll).mockResolvedValue(rows);
  vi.mocked(loadImageryIndex).mockResolvedValue(index as never);
  vi.mocked(buildGalleryPool).mockReturnValue(pool);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("getAuthGallery", () => {
  it("查曲库与意象索引，按摘句标注建池后随机挑选", async () => {
    expect(await getAuthGallery("zh-TW")).toEqual(pool);
    expect(groupMarks).toHaveBeenCalledWith(index.occurrences, index.imagery);
    expect(buildGalleryPool).toHaveBeenCalledWith(
      rows,
      "zh-TW",
      expect.any(Map),
    );
    expect(pickGallery).toHaveBeenCalledWith(pool);
  });

  it("只取资料无争议、有封面、有歌词的歌，按 id 升序", async () => {
    await getAuthGallery("zh-CN");
    const [, table, fields, modify] = vi.mocked(fetchAll).mock.calls[0];
    expect(table).toBe("music");
    expect(fields).toBe("id,title,lyrics,lyrics_start");
    const q = makeQueryBuilder({ data: [], error: null });
    q.is = vi.fn(() => q);
    modify?.(q);
    expect(q.is).toHaveBeenCalledWith("dispute_note", null);
    expect(q.eq).toHaveBeenCalledWith("hascover", true);
    expect(q.not).toHaveBeenCalledWith("lyrics", "is", null);
    expect(q.order).toHaveBeenCalledWith("id", { ascending: true });
  });

  it("Supabase 未配置时返回空数组", async () => {
    vi.mocked(getServiceClient).mockReturnValue(null);
    expect(await getAuthGallery("zh-CN")).toEqual([]);
    expect(fetchAll).not.toHaveBeenCalled();
    expect(pickGallery).toHaveBeenCalledWith([]);
  });

  it("查询失败时返回空数组", async () => {
    vi.mocked(fetchAll).mockRejectedValue(new Error("db down"));
    expect(await getAuthGallery("zh-CN")).toEqual([]);
  });

  it("候选池为空时返回空数组（抛错以免空池被缓存）", async () => {
    vi.mocked(buildGalleryPool).mockReturnValue([]);
    expect(await getAuthGallery("zh-CN")).toEqual([]);
    expect(console.error).toHaveBeenCalledWith(
      "[getAuthGallery] 加载候选池失败",
      expect.objectContaining({ message: "封面墙候选池为空" }),
    );
  });
});
