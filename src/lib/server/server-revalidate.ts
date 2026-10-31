import "server-only";

import { revalidatePath, revalidateTag } from "next/cache";
import { locales } from "@/i18n/config";
import { CDN_PURGE_FAILED_HEADER } from "@/lib/cdn-purge";
import { IMAGERY_INDEX_TAG } from "@/lib/imagery/tags";
import {
  purgeCloudflareCache,
  purgeCloudFrontCache,
  purgeEdgeOneCache,
  type PurgeOutcome,
} from "@/lib/server/server-utils";

/**
 * 全站缓存失效的唯一入口：数据变了就调这里，不在别处直接 revalidatePath。
 *
 * 缓存只有两层，时长都由应用决定：
 * - Next：各页面 `revalidate` 的 ISR 条目，加上 unstable_cache 的数据。
 *   数据按标签失效，用到它的页面会跟着失效。
 * - CDN（Cloudflare、EdgeOne、CloudFront）：缓存多久看源站 Cache-Control，
 *   CDN 上不另设时长。但 Cloudflare 默认不缓存 HTML 和 JSON，要两条 Cache Rule：
 *   一条让页面和公开接口按源站头进缓存（排除 /api/admin、/api/auth），
 *   一条让站内跳转请求（?_rsc= 或 rsc: 1）绕过缓存。
 *   只能按 URL 清，所以受影响的页面和接口要逐个列出来。
 *   站内跳转的 ?_rsc=… 变体只有 CloudFront 能按通配清。
 *
 * 只能靠标签波及、列不出 URL 的页面（如改分类牵动全部详情页），
 * CDN 上的副本要等 s-maxage 到期，最多 2 小时。
 *
 * 下面每个 refresh 函数对应一类数据变动，受牵连的页面、接口和标签都写在函数里，
 * 调用方只说改了哪些歌、哪些母题，不自己补路径。
 *
 * 服务端缓存只有一份全库意象索引（及由它算出的寻曲候选池），用 IMAGERY_INDEX_TAG；
 * 索引里有歌曲资料、has_audio、标注和基调，这几类变动都要失效它。
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

/** 这次没刷成功的 CDN；为空表示都刷成功了，或者没启用 */
export type PurgeReport = { failed: string[] };

const NOTHING_FAILED: PurgeReport = { failed: [] };

/** 把没刷成功的 CDN 写进响应头，后台前端的 sendRequest 据此提示管理员 */
export function withPurgeStatus<T extends Response>(
  response: T,
  report: PurgeReport,
): T {
  if (report.failed.length > 0) {
    response.headers.set(CDN_PURGE_FAILED_HEADER, report.failed.join(","));
  }
  return response;
}

const songPage = (id: number) => `/song/${id}`;

async function invalidate({
  pages = [],
  paths = [],
  tags = [],
}: Targets): Promise<PurgeReport> {
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
  // 各家 CDN 互不依赖，并行刷新，缩短等待时间。CloudFront 单次可提交上千条，
  // 不用拆；页面另外连带清站内跳转的查询串变体
  const [cloudflare, edgeOne, cloudFront] = await Promise.all([
    Promise.all(batches.map((batch) => purgeCloudflareCache(batch))),
    Promise.all(batches.map((batch) => purgeEdgeOneCache(batch))),
    purgeCloudFrontCache(cdnPaths, localized),
  ]);
  const outcomes: [string, PurgeOutcome[]][] = [
    ["Cloudflare", cloudflare],
    ["EdgeOne", edgeOne],
    ["CloudFront", [cloudFront]],
  ];
  return {
    failed: outcomes
      .filter(([, results]) => results.includes("failed"))
      .map(([cdn]) => cdn),
  };
}

/** 歌词接口，播放器单独拉取，在 CDN 上缓存 6 小时 */
const songLyricsApi = (id: number) => `/api/public/songs/${id}/lyrics`;

/**
 * 歌曲资料变了（审批上线、外部同步）：首页曲库、详情页、播放器的歌词、
 * 全文搜索的歌词索引和 sitemap。歌名、类型、日期等也进了意象索引，
 * 意象页的计数、寻曲候选池、别的歌的相关作品都会变，所以要失效标签；
 * 详情页之外受波及的页面在 CDN 上等到期。
 */
export async function refreshSongs(songIds: number[]): Promise<PurgeReport> {
  return invalidate({
    pages: ["", "/imagery", "/quiz", ...songIds.map(songPage)],
    paths: [
      "/sitemap.xml",
      "/api/public/songs/lyrics-index",
      ...songIds.map(songLyricsApi),
    ],
    tags: [IMAGERY_INDEX_TAG],
  });
}

/**
 * 署名别名变了：只影响首页曲库和这些歌的详情页（别名在渲染时套用，不进索引）。
 */
export async function refreshCredits(songIds: number[]): Promise<PurgeReport> {
  return invalidate({ pages: ["", ...songIds.map(songPage)] });
}

/**
 * has_audio 变了：曲库列表、歌曲详情和寻曲测验的播放按钮。
 * navid_id 本身在播放时实时查询，替换映射不需要刷新缓存。
 */
export async function refreshAudio(songIds: number[]): Promise<PurgeReport> {
  if (songIds.length === 0) return NOTHING_FAILED;
  return invalidate({
    pages: ["", "/quiz", ...songIds.map(songPage)],
    tags: [IMAGERY_INDEX_TAG],
  });
}

/**
 * 意象标注变了：详情页的意象与相关作品、意象词云、寻曲候选池都由标注聚合而来。
 *
 * 标签让 Next 上的全部详情页与母题页失效（相关作品、作品数会牵动别处）；CDN 上只清
 * 列出来的歌和母题：母题页与它的面板接口（简繁各一份）。其余的等 2 小时到期。
 */
export async function refreshImagery({
  songIds = [],
  motifIds = [],
}: { songIds?: number[]; motifIds?: number[] } = {}): Promise<PurgeReport> {
  return invalidate({
    pages: [
      "/imagery",
      "/quiz",
      ...songIds.map(songPage),
      ...motifIds.map((id) => `/imagery/${id}`),
    ],
    paths: motifIds.flatMap((id) => [
      `/api/imagery/motifs/${id}`,
      `/api/imagery/motifs/${id}?locale=zh-TW`,
    ]),
    tags: [IMAGERY_INDEX_TAG],
  });
}

/**
 * 歌曲基调变了：基调参与寻曲测验的匹配和详情页相关作品的排序，页面上都不显示。
 *
 * 寻曲结果页按作答动态渲染，读的是候选池缓存；入口页只用到候选池的歌曲数，
 * 与基调无关。相关作品会牵动别的歌，标签让 Next 上的全部详情页失效；
 * CDN 上只清这首歌的详情页。
 */
export async function refreshSongEmotions(
  songId: number,
): Promise<PurgeReport> {
  return invalidate({
    pages: [songPage(songId)],
    tags: [IMAGERY_INDEX_TAG],
  });
}

/** 校记变了：只显示在这首歌的详情页，不进意象索引 */
export async function refreshCollations(songId: number): Promise<PurgeReport> {
  return invalidate({ pages: [songPage(songId)] });
}

/** 部署后预热与外部同步脚本用：列表类页面和各项聚合数据 */
export async function refreshPublicPages(): Promise<PurgeReport> {
  return invalidate({
    pages: ["", "/imagery", "/story/qjtx", "/quiz"],
    paths: ["/sitemap.xml", "/api/public/songs/lyrics-index"],
    tags: [IMAGERY_INDEX_TAG],
  });
}

/**
 * 全部歌曲详情页，只作用于 Next：CDN 没法按通配清，各自等 s-maxage 到期。
 * 路由模板要连路由组一起写全，写成 /zh-CN/song/[id] 匹配不到任何条目。
 */
export function refreshAllSongPages() {
  revalidatePath("/[locale]/(public)/song/[id]", "page");
}
