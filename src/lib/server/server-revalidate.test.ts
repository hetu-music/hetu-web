import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

vi.mock("@/lib/server/server-utils", () => ({
  purgeCloudflareCache: vi.fn(async () => "ok"),
  purgeEdgeOneCache: vi.fn(async () => "ok"),
  purgeCloudFrontCache: vi.fn(async () => "ok"),
}));

import { revalidatePath, revalidateTag } from "next/cache";
import {
  purgeCloudflareCache,
  purgeCloudFrontCache,
  purgeEdgeOneCache,
  type PurgePlan,
} from "@/lib/server/server-utils";
import {
  PURGE_ALL_ABOVE,
  refreshAudio,
  refreshCredits,
  refreshImagery,
  refreshLiveVersion,
  refreshPublicPages,
  refreshSongs,
  withPurgeStatus,
} from "@/lib/server/server-revalidate";

/** 这次交给 CDN 的清单（三家拿到的是同一份） */
const plan = (): PurgePlan => {
  const calls = vi.mocked(purgeCloudflareCache).mock.calls;
  expect(calls).toHaveLength(1);
  return calls[0][0];
};
/** 清单里的页面与地址；整站时为空 */
const purged = (): string[] => {
  const p = plan();
  return p.all ? [] : [...p.pages, ...p.urls];
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("invalidate", () => {
  it("Next 与 CDN 都只清带语言前缀的页面，不清无前缀的 301", async () => {
    await refreshCredits([1]);
    const paths = vi.mocked(revalidatePath).mock.calls.map(([p]) => p);
    expect(paths).toEqual([
      "/zh-CN",
      "/zh-CN/song/1",
      "/zh-TW",
      "/zh-TW/song/1",
    ]);
    expect(plan()).toEqual({ pages: paths, urls: [] });
  });

  it("三家 CDN 拿到同一份清单，各提交一次", async () => {
    await refreshSongs([1]);
    const p = plan();
    for (const fn of [purgeEdgeOneCache, purgeCloudFrontCache]) {
      expect(vi.mocked(fn).mock.calls).toEqual([[p]]);
    }
  });

  it(`页面与地址合计超过 ${PURGE_ALL_ABOVE} 条时清整站`, async () => {
    await refreshCredits(Array.from({ length: 20 }, (_, i) => i + 1));
    expect(plan()).toEqual({ all: true });
    // Next 照样逐页失效
    expect(revalidatePath).toHaveBeenCalledWith("/zh-TW/song/20");
  });

  it("部署后的预热不到阈值，按页清", async () => {
    await refreshPublicPages();
    expect(plan().all).toBeFalsy();
  });
});

describe("清 CDN 的结果", () => {
  it("没启用的 CDN 不算失败；失败的那家记下来", async () => {
    vi.mocked(purgeCloudflareCache).mockResolvedValueOnce("failed");
    vi.mocked(purgeEdgeOneCache).mockResolvedValueOnce("skipped");
    const report = await refreshCredits([1]);
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
  it("失效意象索引和搜歌词的数据，连带清歌词接口、搜歌词的数据和 sitemap", async () => {
    await refreshSongs([5]);
    expect(revalidateTag).toHaveBeenCalledWith("imagery-index", { expire: 0 });
    expect(revalidateTag).toHaveBeenCalledWith("lyrics-lines", { expire: 0 });
    expect(purged()).toEqual(
      expect.arrayContaining([
        "/zh-CN/song/5",
        "/zh-TW/quiz",
        "/api/public/songs/5/lyrics",
        "/api/public/songs/lyrics-lines?locale=zh-CN",
        "/api/public/songs/lyrics-lines?locale=zh-TW",
        "/sitemap.xml",
      ]),
    );
  });
});

describe("refreshLiveVersion", () => {
  it("歌曲与母题合成一次提交，意象页、寻曲页不重复", async () => {
    await refreshLiveVersion(5, []);
    expect(purgeCloudflareCache).toHaveBeenCalledTimes(1);
    const list = purged();
    expect(list.filter((p) => p === "/zh-CN/imagery")).toHaveLength(1);
    expect(list).toContain("/zh-CN/song/5");
  });

  it("牵涉母题时超过阈值，清整站", async () => {
    await refreshLiveVersion(5, [9, 10]);
    expect(plan()).toEqual({ all: true });
    expect(revalidatePath).toHaveBeenCalledWith("/zh-TW/imagery/10");
    expect(revalidatePath).toHaveBeenCalledWith("/api/imagery/motifs/9");
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
