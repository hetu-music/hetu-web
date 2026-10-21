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

/** 与当前用户相关的数据：任何一层都不缓存 */
export const PRIVATE_NO_STORE = "private, no-store";
