import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

vi.mock("@/lib/server/server-utils", () => ({
  purgeCloudflareCache: vi.fn(async () => undefined),
  purgeEdgeOneCache: vi.fn(async () => undefined),
  purgeCloudFrontCache: vi.fn(async () => undefined),
}));

import { revalidatePath, revalidateTag } from "next/cache";
import {
  purgeCloudflareCache,
  purgeCloudFrontCache,
  purgeEdgeOneCache,
} from "@/lib/server/server-utils";
import {
  refreshAudio,
  refreshCredits,
  refreshImagery,
  refreshSongEmotions,
  refreshSongs,
  withPurgeStatus,
} from "@/lib/server/server-revalidate";

const purged = () =>
  vi.mocked(purgeCloudflareCache).mock.calls.flatMap(([paths]) => paths);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("invalidate", () => {
  it("Next 只刷带语言前缀的路由，CDN 另外清无前缀的旧 URL", async () => {
    await refreshSongs([1]);
    const paths = vi.mocked(revalidatePath).mock.calls.map(([p]) => p);
    expect(paths).toEqual(
      expect.arrayContaining(["/zh-CN", "/zh-TW/song/1", "/sitemap.xml"]),
    );
    expect(paths).not.toContain("/song/1");
    expect(purged()).toEqual(
      expect.arrayContaining(["/zh-CN/song/1", "/", "/song/1", "/sitemap.xml"]),
    );
  });

  it("CloudFront 一次提交全部路径，并连带清带语言前缀页面的查询串变体", async () => {
    await refreshCredits([1]);
    expect(purgeCloudFrontCache).toHaveBeenCalledTimes(1);
    const [paths, pagePaths] = vi.mocked(purgeCloudFrontCache).mock.calls[0];
    expect(paths).toEqual(expect.arrayContaining(["/zh-CN/song/1", "/song/1"]));
    // 无前缀的旧 URL 只是 301，没有站内跳转的变体
    expect(pagePaths).toEqual([
      "/zh-CN",
      "/zh-CN/song/1",
      "/zh-TW",
      "/zh-TW/song/1",
    ]);
  });

  it("Cloudflare 与 EdgeOne 按每批 30 条拆分", async () => {
    await refreshCredits(Array.from({ length: 20 }, (_, i) => i + 1));
    for (const fn of [purgeCloudflareCache, purgeEdgeOneCache]) {
      const calls = vi.mocked(fn).mock.calls;
      expect(calls.length).toBeGreaterThan(1);
      expect(calls.every(([paths]) => paths.length <= 30)).toBe(true);
    }
  });
});

describe("清 CDN 的结果", () => {
  it("没启用的 CDN 不算失败；任一批失败就把那家记为失败", async () => {
    vi.mocked(purgeCloudflareCache)
      .mockResolvedValueOnce("ok")
      .mockResolvedValueOnce("failed");
    vi.mocked(purgeEdgeOneCache).mockResolvedValue("skipped");
    vi.mocked(purgeCloudFrontCache).mockResolvedValue("ok");
    // 20 首歌 × 2 种语言，超过 30 条，Cloudflare 分两批
    const report = await refreshCredits(
      Array.from({ length: 20 }, (_, i) => i + 1),
    );
    expect(report).toEqual({ failed: ["Cloudflare"] });
  });

  it("没有歌曲变化时不刷新，也没有失败", async () => {
    await expect(refreshAudio([])).resolves.toEqual({ failed: [] });
    expect(purgeCloudflareCache).not.toHaveBeenCalled();
  });

  it("失败的 CDN 写进响应头，全部成功时不加", () => {
    const failed = withPurgeStatus(new Response(null), {
      failed: ["Cloudflare", "CloudFront"],
    });
    expect(failed.headers.get("x-cdn-purge-failed")).toBe(
      "Cloudflare,CloudFront",
    );
    const ok = withPurgeStatus(new Response(null), { failed: [] });
    expect(ok.headers.get("x-cdn-purge-failed")).toBeNull();
  });
});

describe("refreshSongs", () => {
  // 歌名、类型、日期也进了意象索引，审批上线后候选池和相关作品要跟着变
  it("失效意象索引和搜歌词的数据，连带清歌词接口、歌词索引和 sitemap", async () => {
    await refreshSongs([5]);
    expect(revalidateTag).toHaveBeenCalledWith("imagery-index", { expire: 0 });
    expect(revalidateTag).toHaveBeenCalledWith("lyrics-lines", { expire: 0 });
    expect(purged()).toEqual(
      expect.arrayContaining([
        "/zh-CN/song/5",
        "/zh-TW/quiz",
        "/api/public/songs/5/lyrics",
        "/api/public/songs/lyrics-index",
        "/api/public/songs/lyrics-lines?locale=zh-CN",
        "/api/public/songs/lyrics-lines?locale=zh-TW",
        "/sitemap.xml",
      ]),
    );
  });
});

describe("refreshCredits", () => {
  it("只清首页和详情页，不动意象索引", async () => {
    await refreshCredits([5]);
    expect(revalidateTag).not.toHaveBeenCalled();
    expect(purged()).not.toContain("/sitemap.xml");
  });
});

describe("refreshImagery", () => {
  it("失效意象数据标签，清意象页、寻曲页、详情页、母题页和母题接口", async () => {
    await refreshImagery({ songIds: [3, 3], motifIds: [9] });
    expect(revalidateTag).toHaveBeenCalledWith("imagery-index", { expire: 0 });
    expect(purged()).toEqual(
      expect.arrayContaining([
        "/zh-CN/imagery",
        "/zh-TW/quiz",
        "/zh-CN/song/3",
        "/zh-TW/imagery/9",
        "/api/imagery/motifs/9",
        "/api/imagery/motifs/9?locale=zh-TW",
      ]),
    );
    // 重复的歌只清一次
    expect(purged().filter((p) => p === "/zh-CN/song/3")).toHaveLength(1);
  });
});

describe("refreshSongEmotions", () => {
  it("失效寻曲候选池与意象数据标签，只清这首歌的详情页", async () => {
    const report = await refreshSongEmotions(3);
    expect(revalidateTag).toHaveBeenCalledWith("imagery-index", { expire: 0 });
    expect(purged()).toEqual(
      expect.arrayContaining(["/zh-CN/song/3", "/zh-TW/song/3", "/song/3"]),
    );
    expect(purged()).not.toContain("/zh-CN/quiz");
    expect(report).toEqual({ failed: [] });
  });
});
