/**
 * 页签、筛选项底下那道细线（首页曲目工具栏、后台 AdminToolbar、ui/tabs 的分段页签）。
 * 不用 border：border 在盒子外面，当前项与搜索框的强调色线贴着盒子内沿，会浮在细线上面一点；
 * 也不能把强调色线挪出去，横向滚动的标签行会把挪出去的那截裁掉。
 * 所以细线画在盒子里面，用 ::before 让它先画，强调色线压在它上面。
 * 强调色线 2px 贴着底边（bottom-0），细线 1px 往上收半像素，两条线中线对齐。
 */
export const TAB_HAIRLINE_CLASS =
  "relative before:absolute before:inset-x-0 before:bottom-[0.5px] before:h-px before:bg-slate-200/70 dark:before:bg-slate-800";
