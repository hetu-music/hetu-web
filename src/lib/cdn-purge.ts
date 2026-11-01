/**
 * 清 CDN 失败时怎么告诉管理员。服务端与后台前端共用，不能放进 server-only 模块。
 *
 * 数据已经写进库、Next 的缓存也已失效，只是 CDN 上还留着旧副本，
 * 公开页面和公开接口要等缓存到期才会更新，最多 6 小时。
 */

/** 后台写接口带上这个响应头，值是没刷成功的 CDN，逗号分隔 */
export const CDN_PURGE_FAILED_HEADER = "x-cdn-purge-failed";

export function cdnPurgeWarning(failed: string[]): string {
  return `已保存，但 ${failed.join("、")} 的缓存没刷新成功，公开页面最长约 6 小时后才会更新`;
}
