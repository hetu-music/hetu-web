/** 站内导航深度：详情页的返回键靠它判断该走 router.back() 还是回主页（见 topbar/parts） */
export const NAV_DEPTH_KEY = "__hetu_web_nav_depth";

/** 站内跳到歌曲页之前调用 */
export function bumpNavDepth() {
  const d = parseInt(sessionStorage.getItem(NAV_DEPTH_KEY) || "0", 10);
  sessionStorage.setItem(NAV_DEPTH_KEY, String(d + 1));
}
