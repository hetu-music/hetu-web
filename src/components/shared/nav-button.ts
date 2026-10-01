/** 顶栏里的图标按钮：返回、用户、收藏、分享等共用 */
export const NAV_BUTTON_CLASS =
  "inline-flex items-center justify-center p-2 rounded-full transition-colors text-slate-600 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-slate-800";

// 各页顶栏的外壳与内容区共用这几个类名，在页面之间切换时按钮位置不跳
/** 顶栏本身：固定在顶部，半透明底色加模糊 */
export const NAV_BAR_CLASS =
  "fixed top-0 left-0 right-0 z-50 bg-[#FAFAFA]/80 dark:bg-[#0B0F19]/80 backdrop-blur-md border-b border-slate-200/50 dark:border-slate-800/50";

/** 顶栏内容区：左右两组之间撑开 */
export const NAV_BAR_INNER_CLASS =
  "max-w-7xl mx-auto px-4 sm:px-6 h-20 flex items-center justify-between gap-2";

/** 顶栏右侧的图标组 */
export const NAV_ACTIONS_CLASS = "flex items-center gap-0.5 sm:gap-2 shrink-0";
