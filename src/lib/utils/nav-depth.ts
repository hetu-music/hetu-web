/**
 * 返回键要知道上一条历史是不是本站：是就 router.back()，不是（直接打开、从站外进来）就回主页。
 *
 * 浏览器支持 Navigation API 时直接问它（navigation.canGoBack 只在上一条历史同源时为真），
 * 站内任何跳转都算，后台、意象页这些没手动记深度的地方也对。
 * 不支持的浏览器（Safari 26.2、Firefox 147 以前）退回手动记的深度：
 * 从站内进入内页前加一，存在 sessionStorage，跨页面保留。
 */
const KEY = "__hetu_web_nav_depth";

export function readNavDepth(): number {
  const depth = parseInt(sessionStorage.getItem(KEY) || "0", 10);
  return Number.isNaN(depth) ? 0 : depth;
}

/** 站内跳进内页之前调用（只给不支持 Navigation API 的浏览器用） */
export function bumpNavDepth(): void {
  sessionStorage.setItem(KEY, String(readNavDepth() + 1));
}

/** 返回键：上一条历史在本站时返回 true（调用方 router.back()）；否则返回 false，调用方回主页 */
export function popNavDepth(): boolean {
  if ("navigation" in window && typeof navigation.canGoBack === "boolean") {
    return navigation.canGoBack;
  }
  const depth = readNavDepth();
  if (depth <= 0) return false;
  sessionStorage.setItem(KEY, String(depth - 1));
  return true;
}
