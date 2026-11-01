/**
 * 站内导航深度：从站内进入内页前加一，内页的返回键据此判断有没有站内历史可退——
 * 有就 router.back()，没有（直接打开、从站外进来）就回主页。存在 sessionStorage，跨页面保留。
 */
const KEY = "__hetu_web_nav_depth";

export function readNavDepth(): number {
  const depth = parseInt(sessionStorage.getItem(KEY) || "0", 10);
  return Number.isNaN(depth) ? 0 : depth;
}

/** 站内跳进内页之前调用 */
export function bumpNavDepth(): void {
  sessionStorage.setItem(KEY, String(readNavDepth() + 1));
}

/** 返回键：有站内历史时退一层并返回 true；没有时返回 false，调用方回主页 */
export function popNavDepth(): boolean {
  const depth = readNavDepth();
  if (depth <= 0) return false;
  sessionStorage.setItem(KEY, String(depth - 1));
  return true;
}
