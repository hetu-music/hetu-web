import { getSongLastModifiedMap, getSongs } from "@/lib/server/service-songs";
import { getImageryLastModified } from "@/lib/server/service-imagery";
import { getImageryCloud } from "@/lib/server/service-imagery-cloud";
import { getStoryLastModified } from "@/lib/server/service-story";
import type { MetadataRoute } from "next";
import { localeUrl } from "@/lib/utils/site-url";

/**
 * lastModified 一律取自真实数据，不用 new Date()。
 *
 * 每次生成都填「当前时间」会让所有条目声称刚刚变更，Google 对这种明显不可信的
 * lastmod 的处理是整站忽略该字段——还不如不填。缺失是中性的（搜索引擎回退到
 * 自己的抓取策略），伪造则是有害的。
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [songs, lastModifiedMap, imageryModified, storyModified, cloud] =
    await Promise.all([
      getSongs(undefined, undefined, true).catch(() => []),
      getSongLastModifiedMap().catch(() => new Map<number, Date>()),
      getImageryLastModified().catch(() => null),
      getStoryLastModified().catch(() => null),
      getImageryCloud("zh-CN").catch(() => null),
    ]);

  // 首页即曲库列表，其变更时间等于最近一次歌曲更新
  const newestSongModified =
    lastModifiedMap.size > 0
      ? new Date(Math.max(...[...lastModifiedMap.values()].map((d) => +d)))
      : undefined;

  /** 一个页面的简繁两条；繁体比简体低 0.1 */
  const both = (
    path: string,
    entry: Omit<MetadataRoute.Sitemap[number], "url">,
  ): MetadataRoute.Sitemap => [
    { url: localeUrl("zh-CN", path), ...entry },
    {
      url: localeUrl("zh-TW", path),
      ...entry,
      priority: Math.round(((entry.priority ?? 0.5) - 0.1) * 10) / 10,
    },
  ];

  const staticRoutes: MetadataRoute.Sitemap = [
    ...both("", {
      lastModified: newestSongModified,
      changeFrequency: "weekly",
      priority: 1.0,
    }),
    ...both("/imagery", {
      lastModified: imageryModified ?? undefined,
      changeFrequency: "weekly",
      priority: 0.9,
    }),
    ...both("/story/qjtx", {
      lastModified: storyModified ?? undefined,
      changeFrequency: "monthly",
      priority: 0.9,
    }),
    // 题目写在代码里，没有可信的变更时间，不填
    ...both("/quiz", { changeFrequency: "monthly", priority: 0.8 }),
  ];

  // 动态歌曲详情页面
  const songRoutes = songs.flatMap((song) =>
    both(`/song/${song.id}`, {
      lastModified: lastModifiedMap.get(song.id),
      changeFrequency: "weekly",
      priority: 0.8,
    }),
  );

  // 意象词云里每个母题一页：打开即点亮该母题、展开面板
  const motifRoutes = (cloud?.groups ?? []).flatMap((group) =>
    group.motifs.flatMap((motif) =>
      both(`/imagery/${motif.id}`, {
        lastModified: imageryModified ?? undefined,
        changeFrequency: "monthly",
        priority: 0.6,
      }),
    ),
  );

  return [...staticRoutes, ...songRoutes, ...motifRoutes];
}

// 使用 ISR，与主页同步更新（全站统一 6 小时）
export const revalidate = 21600;
