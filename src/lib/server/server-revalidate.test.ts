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
  refreshAudioPages,
  refreshImagery,
  refreshQuizPool,
  refreshSongPages,
  withPurgeStatus,
} from "@/lib/server/server-revalidate";

const purged = () =>
  vi.mocked(purgeCloudflareCache).mock.calls.flatMap(([paths]) => paths);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("refreshSongPages", () => {
  it("Next 只刷带语言前缀的路由，CDN 另外清无前缀的旧 URL", async () => {
    await refreshSongPages([1], ["/sitemap.xml"]);
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
    await refreshSongPages([1]);
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
    await refreshSongPages(Array.from({ length: 20 }, (_, i) => i + 1));
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
    const report = await refreshSongPages(
      Array.from({ length: 20 }, (_, i) => i + 1),
    );
    expect(report).toEqual({ failed: ["Cloudflare"] });
  });

  it("没有歌曲变化时不刷新，也没有失败", async () => {
    await expect(refreshAudioPages([])).resolves.toEqual({ failed: [] });
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

describe("refreshImagery", () => {
  it("失效意象数据标签，清意象页、寻曲页、详情页和意象歌曲接口", async () => {
    await refreshImagery({ songIds: [3, 3], imageryIds: [9] });
    expect(revalidateTag).toHaveBeenCalledWith("song-imagery", { expire: 0 });
    expect(revalidateTag).toHaveBeenCalledWith("quiz-pool", { expire: 0 });
    expect(purged()).toEqual(
      expect.arrayContaining([
        "/zh-CN/imagery",
        "/zh-TW/quiz",
        "/zh-CN/song/3",
        "/api/imagery/9/songs",
      ]),
    );
    // 重复的歌只清一次
    expect(purged().filter((p) => p === "/zh-CN/song/3")).toHaveLength(1);
  });
});

describe("refreshQuizPool", () => {
  it("只失效寻曲候选池标签，不清页面，也不提交 CDN", async () => {
    const report = await refreshQuizPool();
    expect(revalidateTag).toHaveBeenCalledWith("quiz-pool", { expire: 0 });
    expect(revalidatePath).not.toHaveBeenCalled();
    expect(purgeCloudflareCache).not.toHaveBeenCalled();
    expect(purgeEdgeOneCache).not.toHaveBeenCalled();
    expect(vi.mocked(purgeCloudFrontCache).mock.calls).toEqual([[[], []]]);
    expect(report).toEqual({ failed: [] });
  });
});
