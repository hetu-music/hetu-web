import { getSongLastModifiedMap, getSongs } from "@/lib/server/service-songs";
import { getImageryLastModified } from "@/lib/server/service-imagery";
import { getStoryLastModified } from "@/lib/server/service-story";
import type { MetadataRoute } from "next";

const SITE_URL = "https://hetu-music.com";

/**
 * lastModified 一律取自真实数据，不用 new Date()。
 *
 * 每次生成都填「当前时间」会让所有条目声称刚刚变更，Google 对这种明显不可信的
 * lastmod 的处理是整站忽略该字段——还不如不填。缺失是中性的（搜索引擎回退到
 * 自己的抓取策略），伪造则是有害的。
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [songs, lastModifiedMap, imageryModified, storyModified] =
    await Promise.all([
      getSongs(undefined, undefined, true).catch(() => []),
      getSongLastModifiedMap().catch(() => new Map<number, Date>()),
      getImageryLastModified().catch(() => null),
      getStoryLastModified().catch(() => null),
    ]);

  // 首页即曲库列表，其变更时间等于最近一次歌曲更新
  const newestSongModified =
    lastModifiedMap.size > 0
      ? new Date(Math.max(...[...lastModifiedMap.values()].map((d) => +d)))
      : undefined;

  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: `${SITE_URL}/zh-CN`,
      lastModified: newestSongModified,
      changeFrequency: "weekly",
      priority: 1.0,
    },
    {
      url: `${SITE_URL}/zh-TW`,
      lastModified: newestSongModified,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/zh-CN/imagery`,
      lastModified: imageryModified ?? undefined,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/zh-TW/imagery`,
      lastModified: imageryModified ?? undefined,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/zh-CN/story/qjtx`,
      lastModified: storyModified ?? undefined,
      changeFrequency: "monthly",
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/zh-TW/story/qjtx`,
      lastModified: storyModified ?? undefined,
      changeFrequency: "monthly",
      priority: 0.8,
    },
  ];

  // 动态歌曲详情页面
  const songRoutes: MetadataRoute.Sitemap = songs.flatMap((song) => {
    const lastModified = lastModifiedMap.get(song.id);
    return [
      {
        url: `${SITE_URL}/zh-CN/song/${song.id}`,
        lastModified,
        changeFrequency: "weekly" as const,
        priority: 0.8,
      },
      {
        url: `${SITE_URL}/zh-TW/song/${song.id}`,
        lastModified,
        changeFrequency: "weekly" as const,
        priority: 0.7,
      },
    ];
  });

  return [...staticRoutes, ...songRoutes];
}

// 使用 ISR，与主页同步更新
export const revalidate = 7200;
