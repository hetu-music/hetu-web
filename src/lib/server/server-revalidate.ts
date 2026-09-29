import "server-only";

import { revalidatePath } from "next/cache";
import { locales } from "@/i18n/config";
import {
  purgeCloudflareCache,
  purgeEdgeOneCache,
} from "@/lib/server/server-utils";

/**
 * 刷新首页与指定歌曲详情页：Next.js 本地缓存与两家 CDN。
 *
 * @param songIds    - 要刷新详情页的歌曲
 * @param extraPaths - 另外要刷新的路径（如 /sitemap.xml），两边都会刷
 */
export async function refreshSongPages(
  songIds: number[],
  extraPaths: string[] = [],
) {
  // Next.js 侧：只有带 locale 前缀的路由真实存在。无前缀的 /、/song/:id
  // 在 next.config 的 redirects() 里是 301，Next 没有对应的缓存条目。
  const nextPaths: string[] = [];
  for (const locale of locales) {
    nextPaths.push(`/${locale}`);
    for (const id of songIds) nextPaths.push(`/${locale}/song/${id}`);
  }
  nextPaths.push(...extraPaths);

  // CDN 侧：还要额外清掉无前缀的旧 URL——边缘节点会把那些 301 响应缓存下来。
  const cdnPaths = [...nextPaths, "/", ...songIds.map((id) => `/song/${id}`)];

  for (const path of nextPaths) {
    revalidatePath(path);
  }

  // 两家 CDN 互不依赖，并行刷新，缩短等待时间
  await Promise.all([
    purgeCloudflareCache(cdnPaths),
    purgeEdgeOneCache(cdnPaths),
  ]);
}
