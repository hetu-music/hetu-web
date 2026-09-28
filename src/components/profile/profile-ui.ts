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

/** 字段标签：小字宽字距 */
export const FIELD_LABEL_CLASS =
  "block text-xs tracking-[0.2em] text-slate-400 dark:text-slate-500";

/** 输入框：只有一道底线，聚焦时换成强调色 */
export const FIELD_CLASS =
  "block w-full bg-transparent border-0 border-b border-slate-300 dark:border-slate-700 focus:border-(--tone) focus:outline-none px-0 py-1.5 text-[15px] text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-600 transition-colors";

/** 多行输入：楷体，随内容长高（Safari 另有脚本兜底，见 useAutoGrow） */
export const TEXTAREA_CLASS = `${FIELD_CLASS} resize-none field-sizing-content min-h-[2.8em] max-h-[20em] font-kaiti leading-[1.8]`;

/** 出错时底线变红 */
export const FIELD_ERROR_CLASS =
  "border-rose-400 dark:border-rose-500/70 focus:border-rose-500";

/** 次要文字按钮 */
export const TEXT_BUTTON_CLASS =
  "text-xs tracking-widest text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 transition-colors disabled:opacity-40";

/** 主操作文字按钮 */
export const PRIMARY_BUTTON_CLASS =
  "inline-flex items-center gap-1.5 text-xs tracking-widest text-(--tone) hover:opacity-75 transition-opacity disabled:opacity-40";

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
