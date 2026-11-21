import "server-only";

import { revalidatePath, revalidateTag } from "next/cache";
import { locales } from "@/i18n/config";
import { CDN_PURGE_FAILED_HEADER } from "@/lib/cdn-purge";
import { IMAGERY_INDEX_TAG } from "@/lib/imagery/tags";
import { LYRICS_LINES_TAG } from "@/lib/library/tags";
import {
  purgeCloudflareCache,
  purgeCloudFrontCache,
  purgeEdgeOneCache,
  type PurgeOutcome,
  type PurgePlan,
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
 *   规则原文和待加的缓存键设置见 docs/CACHE.md。
 *
 * 清 CDN 时三家共用一份清单（PurgePlan）：要清的页面、精确地址，或者整站。
 * 牵涉的页面与地址合起来超过 PURGE_ALL_ABOVE 条就清整站，各家怎么翻译见
 * server-utils 里的 purge 函数。CloudFront 按条计费，这样一次最多花十几条。
 *
 * 只能靠标签波及、列不出 URL 的页面（如改分类牵动全部详情页），
 * CDN 上的副本要等 s-maxage 到期，最多 6 小时。
 *
 * 下面每个 refresh 函数对应一类数据变动，受牵连的页面、接口和标签都写在函数里，
 * 调用方只说改了哪些歌、哪些母题，不自己补路径。一次操作牵动几类数据时，
 * 要合成一次提交（见 refreshLiveVersion），不要分头调几个 refresh。
 *
 * 服务端缓存只有一份全库意象索引（及由它算出的寻曲候选池），用 IMAGERY_INDEX_TAG；
 * 索引里有歌曲资料、has_audio、标注和基调，这几类变动都要失效它。
 */

/**
 * 页面与地址合计超过这么多条就清整站。整站清过之后全部回源，
 * 源站给的是 Next 的 ISR 缓存与压好的封面，扛得住
 */
export const PURGE_ALL_ABOVE = 15;

type Targets = {
  /** 不带语言前缀的页面路径（首页为 ""），会展开到每种语言 */
  pages?: string[];
  /** 不分语言的路径，如 /sitemap.xml 和公开接口 */
  paths?: string[];
  /** unstable_cache 的标签 */
  tags?: string[];
};

function mergeTargets(...targets: Targets[]): Targets {
  return {
    pages: targets.flatMap((t) => t.pages ?? []),
    paths: targets.flatMap((t) => t.paths ?? []),
    tags: targets.flatMap((t) => t.tags ?? []),
  };
}

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

/**
 * 三家 CDN 共用的清单。只有带语言前缀的页面：无前缀的 /、/song/:id 在
 * next.config 的 redirects() 里是固定的 301，数据变了跳转也不变，不用清。
 */
export function purgePlan(pages: string[], urls: string[]): PurgePlan {
  return pages.length + urls.length > PURGE_ALL_ABOVE
    ? { all: true }
    : { pages, urls };
}

async function invalidate(targets: Targets): Promise<PurgeReport> {
  // Next 侧：只有带 locale 前缀的路由真实存在
  const pages = [
    ...new Set(
      locales.flatMap((locale) =>
        (targets.pages ?? []).map((page) => `/${locale}${page}`),
      ),
    ),
  ];
  const urls = [...new Set(targets.paths ?? [])];
  for (const path of [...pages, ...urls]) revalidatePath(path);
  for (const tag of new Set(targets.tags ?? [])) {
    revalidateTag(tag, { expire: 0 });
  }
  if (pages.length + urls.length === 0) return NOTHING_FAILED;

  // 各家 CDN 互不依赖，并行刷新，缩短等待时间
  const plan = purgePlan(pages, urls);
  const [cloudflare, edgeOne, cloudFront] = await Promise.all([
    purgeCloudflareCache(plan),
    purgeEdgeOneCache(plan),
    purgeCloudFrontCache(plan),
  ]);
  const outcomes: [string, PurgeOutcome][] = [
    ["Cloudflare", cloudflare],
    ["EdgeOne", edgeOne],
    ["CloudFront", cloudFront],
  ];
  return {
    failed: outcomes
      .filter(([, outcome]) => outcome === "failed")
      .map(([cdn]) => cdn),
  };
}

/** 歌词接口，播放器单独拉取，在 CDN 上缓存 6 小时 */
const songLyricsApi = (id: number) => `/api/public/songs/${id}/lyrics`;

/**
 * 曲库页搜歌词的数据，简繁各一个地址（客户端简体也带 ?locale=zh-CN）。
 * 浏览器和 CDN 都缓存 6 小时，这里清得掉 CDN 的，浏览器里的等到期
 */
const LYRICS_LINES_API = locales.map(
  (locale) => `/api/public/songs/lyrics-lines?locale=${locale}`,
);

/**
 * 歌曲资料变了（审批上线、外部同步）：首页曲库、详情页、播放器的歌词、
 * 曲库页搜歌词的数据和 sitemap。歌名、类型、日期等也进了意象索引，
 * 意象页的计数、寻曲候选池、别的歌的相关作品都会变，所以要失效标签；
 * 详情页之外受波及的页面在 CDN 上等到期。
 */
export async function refreshSongs(songIds: number[]): Promise<PurgeReport> {
  return invalidate(songTargets(songIds));
}

function songTargets(songIds: number[]): Targets {
  return {
    pages: ["", "/imagery", "/quiz", ...songIds.map(songPage)],
    paths: ["/sitemap.xml", ...LYRICS_LINES_API, ...songIds.map(songLyricsApi)],
    tags: [IMAGERY_INDEX_TAG, LYRICS_LINES_TAG],
  };
}

/**
 * 线上版本变了（发布、重新上线、下架）：歌曲资料与前后两版标注挂的母题一起变，
 * 合成一次提交，免得意象页、寻曲页各清两遍
 */
export async function refreshLiveVersion(
  songId: number,
  motifIds: number[],
): Promise<PurgeReport> {
  return invalidate(
    mergeTargets(songTargets([songId]), imageryTargets({ motifIds })),
  );
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
 * 列出来的歌和母题：母题页与它的面板接口（简繁各一份）。其余的等 6 小时到期。
 */
export async function refreshImagery({
  songIds = [],
  motifIds = [],
}: { songIds?: number[]; motifIds?: number[] } = {}): Promise<PurgeReport> {
  return invalidate(imageryTargets({ songIds, motifIds }));
}

function imageryTargets({
  songIds = [],
  motifIds = [],
}: {
  songIds?: number[];
  motifIds?: number[];
}): Targets {
  return {
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
  };
}

/**
 * 「关于」里的维护团队变了：后台改了用户的展示、排序、简介，或者管理员改了自己的名字、简介。
 * 普通用户改自己的资料不调这里：任何登录用户都能反复保存，每次都清 CDN 会被拿来刷爆清缓存的配额；
 * 被展示的普通成员改名，最多 6 小时后更新。
 */
export async function refreshContributors(): Promise<PurgeReport> {
  return invalidate({ paths: ["/api/public/contributors"] });
}

/** 部署后预热与外部同步脚本用：列表类页面和各项聚合数据 */
export async function refreshPublicPages(): Promise<PurgeReport> {
  return invalidate({
    pages: ["", "/imagery", "/story/qjtx", "/quiz"],
    paths: ["/sitemap.xml", ...LYRICS_LINES_API],
    tags: [IMAGERY_INDEX_TAG, LYRICS_LINES_TAG],
  });
}

/**
 * 全部歌曲详情页，只作用于 Next：CDN 没法按通配清，各自等 s-maxage 到期。
 * 路由模板要连路由组一起写全，写成 /zh-CN/song/[id] 匹配不到任何条目。
 */
export function refreshAllSongPages() {
  revalidatePath("/[locale]/(public)/song/[id]", "page");
}
