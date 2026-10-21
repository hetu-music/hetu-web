import "server-only";

import { revalidatePath, revalidateTag } from "next/cache";
import { locales } from "@/i18n/config";
import { SONG_IMAGERY_TAG } from "@/lib/imagery/tags";
import { QUIZ_POOL_TAG } from "@/lib/quiz/pool";
import {
  purgeCloudflareCache,
  purgeEdgeOneCache,
} from "@/lib/server/server-utils";

/**
 * 全站缓存失效的唯一入口：数据变了就调这里，不在别处直接 revalidatePath。
 *
 * 缓存只有两层，时长都由应用决定：
 * - Next：各页面 `revalidate` 的 ISR 条目，加上 unstable_cache 的数据。
 *   数据按标签失效，用到它的页面会跟着失效。
 * - CDN（Cloudflare、EdgeOne）：遵循源站 Cache-Control，不另设规则。
 *   只能按 URL 清，所以受影响的页面和接口要逐个列出来。
 *
 * 只能靠标签波及、列不出 URL 的页面（如改分类牵动全部详情页），
 * CDN 上的副本要等 s-maxage 到期，最多 2 小时。
 */

/** Cloudflare 免费套餐单次按 URL 清缓存的上限，EdgeOne 也按这个拆 */
const CDN_PURGE_BATCH = 30;

type Targets = {
  /** 不带语言前缀的页面路径（首页为 ""），会展开到每种语言 */
  pages?: string[];
  /** 不分语言的路径，如 /sitemap.xml 和公开接口 */
  paths?: string[];
  /** unstable_cache 的标签 */
  tags?: string[];
};

const songPage = (id: number) => `/song/${id}`;

async function invalidate({ pages = [], paths = [], tags = [] }: Targets) {
  // Next 侧：只有带 locale 前缀的路由真实存在。无前缀的 /、/song/:id
  // 在 next.config 的 redirects() 里是 301，Next 没有对应的缓存条目。
  const localized = locales.flatMap((locale) =>
    pages.map((page) => `/${locale}${page}`),
  );
  for (const path of new Set([...localized, ...paths])) revalidatePath(path);
  for (const tag of tags) revalidateTag(tag, { expire: 0 });

  // CDN 侧：还要额外清掉无前缀的旧 URL——边缘节点会把那些 301 响应缓存下来。
  const cdnPaths = [
    ...new Set([...localized, ...pages.map((page) => page || "/"), ...paths]),
  ];
  const batches: string[][] = [];
  for (let i = 0; i < cdnPaths.length; i += CDN_PURGE_BATCH) {
    batches.push(cdnPaths.slice(i, i + CDN_PURGE_BATCH));
  }
  // 两家 CDN 互不依赖，并行刷新，缩短等待时间
  await Promise.all(
    batches.flatMap((batch) => [
      purgeCloudflareCache(batch),
      purgeEdgeOneCache(batch),
    ]),
  );
}

/**
 * 歌曲资料变了：首页曲库与这些歌的详情页。
 *
 * @param songIds    - 要刷新详情页的歌曲
 * @param extraPaths - 另外要刷新的路径（如 /sitemap.xml），两边都会刷
 */
export async function refreshSongPages(
  songIds: number[],
  extraPaths: string[] = [],
) {
  await invalidate({
    pages: ["", ...songIds.map(songPage)],
    paths: extraPaths,
  });
}

/**
 * has_audio 变了：曲库列表、歌曲详情和寻曲测验的播放按钮。
 * navid_id 本身在播放时实时查询，替换映射不需要刷新缓存。
 */
export async function refreshAudioPages(songIds: number[]) {
  if (songIds.length === 0) return;
  await invalidate({
    pages: ["", "/quiz", ...songIds.map(songPage)],
    tags: [QUIZ_POOL_TAG],
  });
}

/**
 * 意象标注变了：详情页的意象与相关作品、意象页、寻曲候选池都由标注聚合而来。
 *
 * 标签让 Next 上的全部详情页失效（相关作品会牵动别的歌）；CDN 上只清
 * 列出来的歌，以及这些意象的歌曲列表接口。
 */
export async function refreshImagery({
  songIds = [],
  imageryIds = [],
}: { songIds?: number[]; imageryIds?: number[] } = {}) {
  await invalidate({
    pages: ["/imagery", "/quiz", ...songIds.map(songPage)],
    paths: imageryIds.map((id) => `/api/imagery/${id}/songs`),
    tags: [SONG_IMAGERY_TAG, QUIZ_POOL_TAG],
  });
}

/** 部署后预热与外部同步脚本用：列表类页面和各项聚合数据 */
export async function refreshPublicPages() {
  await invalidate({
    pages: ["", "/imagery", "/story/qjtx", "/quiz"],
    paths: ["/sitemap.xml", "/api/public/songs/lyrics-index"],
    tags: [QUIZ_POOL_TAG, SONG_IMAGERY_TAG],
  });
}

/**
 * 全部歌曲详情页，只作用于 Next：CDN 没法按通配清，各自等 s-maxage 到期。
 * 路由模板要连路由组一起写全，写成 /zh-CN/song/[id] 匹配不到任何条目。
 */
export function refreshAllSongPages() {
  revalidatePath("/[locale]/(public)/song/[id]", "page");
}
