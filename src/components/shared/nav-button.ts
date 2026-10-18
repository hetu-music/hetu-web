/**
 * 顶栏高度，与 globals.css 的 --nav-h（5rem）一致。
 * 滚动定位、IntersectionObserver 的 rootMargin 只认像素，读不到 CSS 变量，统一用这个数。
 */
export const NAV_HEIGHT = 80;

/** 顶栏里的图标按钮：返回、用户、收藏、分享等共用 */
export const NAV_BUTTON_CLASS =
  "inline-flex items-center justify-center p-2 rounded-full transition-colors text-slate-600 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-slate-800";
