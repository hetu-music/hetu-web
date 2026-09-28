/** 个人中心的四节，也是 ?tab= 的取值 */
export const PROFILE_TABS = [
  "favorites",
  "annotations",
  "account",
  "feedback",
] as const;
export type ProfileTab = (typeof PROFILE_TABS)[number];

export function isProfileTab(value: string): value is ProfileTab {
  return (PROFILE_TABS as readonly string[]).includes(value);
}

/** 2026.9.28 这样的短日期 */
export function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}`;
}

/** 与主页一致：站内跳转前递增导航深度，详情页的返回键才会走 router.back() */
export function bumpNavDepth() {
  const d = parseInt(sessionStorage.getItem("__hetu_web_nav_depth") || "0", 10);
  sessionStorage.setItem("__hetu_web_nav_depth", String(d + 1));
}
