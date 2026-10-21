import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

vi.mock("@/lib/server/server-utils", () => ({
  purgeCloudflareCache: vi.fn(async () => undefined),
  purgeEdgeOneCache: vi.fn(async () => undefined),
}));

import { revalidatePath, revalidateTag } from "next/cache";
import {
  purgeCloudflareCache,
  purgeEdgeOneCache,
} from "@/lib/server/server-utils";
import {
  refreshImagery,
  refreshSongPages,
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

  it("两家 CDN 都按每批 30 条拆分", async () => {
    await refreshSongPages(Array.from({ length: 20 }, (_, i) => i + 1));
    for (const fn of [purgeCloudflareCache, purgeEdgeOneCache]) {
      const calls = vi.mocked(fn).mock.calls;
      expect(calls.length).toBeGreaterThan(1);
      expect(calls.every(([paths]) => paths.length <= 30)).toBe(true);
    }
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
