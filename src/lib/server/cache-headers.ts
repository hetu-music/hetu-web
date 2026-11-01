/**
 * 接口响应的 Cache-Control。页面的缓存头由 Next 按各页 `revalidate` 自动生成，
 * 这里只管 Route Handler 的部分。CDN 遵循源站，不另设规则。
 *
 * /api 下默认一律 no-store，由 next.config.ts 按 API_NO_STORE_SOURCE 统一加上；
 * 只有 API_PATHS_WITH_OWN_CACHE 列出的接口自己设缓存头。
 * 明确写 no-store，是因为 Cloudflare 的 Cache Rule 让公开接口按源站头进缓存，
 * 不带 Cache-Control 的响应会按 Cloudflare 的默认时长缓存。
 * 自己设缓存头的接口必须排除在 next.config.ts 那条之外：Next 发送接口响应时，
 * 已经由 next.config.ts 设过的头不会被接口的同名头覆盖（next/dist/server/send-response.js）。
 */

/**
 * 公开只读数据：CDN 缓存 6 小时，过期后 30 分钟内先返回旧值再回源刷新。
 * 数据变更时由 server-revalidate 主动清 CDN，不必等到期。
 */
export const PUBLIC_API_CACHE =
  "public, s-maxage=21600, stale-while-revalidate=1800";

/**
 * 同上，浏览器也缓存 6 小时（曲库页搜歌词的数据 lyrics-lines）：数据大（gzip 约 165 KB），
 * 想搜的访客第二次打开不用再下载。CDN 上的照样随数据变更清掉，浏览器里的清不掉，最多晚 6 小时。
 */
export const BROWSER_CACHED_API_CACHE =
  "public, max-age=21600, s-maxage=21600, stale-while-revalidate=1800";

/** 与当前用户相关的数据，以及 /api 下其余接口：任何一层都不缓存 */
export const PRIVATE_NO_STORE = "private, no-store";

/** 自己设缓存头的接口出错时用：错误响应不进任何缓存 */
export const NO_STORE_HEADERS = { "Cache-Control": PRIVATE_NO_STORE };

/**
 * 自己设缓存头的接口，写成相对 /api/ 的正则。新增一个要缓存的接口，要加在这里，
 * 否则 next.config.ts 统一加的 no-store 会盖住它自己设的头。
 */
export const API_PATHS_WITH_OWN_CACHE = [
  // 详情页、播放器的歌词：CDN 6 小时
  "public/songs/\\d+/lyrics",
  // 曲库页旧的歌词索引：CDN 6 小时（阶段 6 删）
  "public/songs/lyrics-index",
  // 意象词云的母题面板：CDN 6 小时
  "imagery/motifs/\\d+",
  // 曲库页搜歌词的数据：浏览器和 CDN 都 6 小时（docs/LIBRARY.md 阶段 5「2.」）
  "public/songs/lyrics-lines",
];

/** next.config.ts 里统一加 no-store 的路径：/api 下除了上面那些的全部 */
export const API_NO_STORE_SOURCE = `/api/:path((?!(?:${API_PATHS_WITH_OWN_CACHE.join("|")})$).*)`;
