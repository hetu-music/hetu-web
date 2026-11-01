/**
 * 接口响应的 Cache-Control。页面的缓存头由 Next 按各页 `revalidate` 自动生成，
 * 这里只管 Route Handler 手动设置的部分。CDN 遵循源站，不另设规则。
 */

/**
 * 公开只读数据：CDN 缓存 6 小时，过期后 30 分钟内先返回旧值再回源刷新。
 * 数据变更时由 server-revalidate 主动清 CDN，不必等到期。
 */
export const PUBLIC_API_CACHE =
  "public, s-maxage=21600, stale-while-revalidate=1800";

/**
 * 由全库标注聚合出的公开数据（意象词云的母题面板）：一处改动可能牵动任意多条，
 * 没法逐条清 CDN，与页面一样最多 2 小时后自然更新。
 */
export const PUBLIC_AGGREGATE_CACHE =
  "public, s-maxage=7200, stale-while-revalidate=1800";

/**
 * 地址里带版本号的公开数据（曲库页的歌词 lyrics-lines?v=）：数据变了地址就变，
 * 同一个地址的内容不会再变，浏览器和 CDN 都长缓存。
 */
export const IMMUTABLE_API_CACHE = "public, max-age=31536000, immutable";

/** 同上，但地址里的版本号和数据对不上（首页还是旧的）：数据是新的，只短暂缓存 */
export const SHORT_PUBLIC_API_CACHE =
  "public, max-age=0, s-maxage=60, stale-while-revalidate=60";

/** 与当前用户相关的数据：任何一层都不缓存 */
export const PRIVATE_NO_STORE = "private, no-store";
