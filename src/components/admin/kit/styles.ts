/**
 * 后台的共用样式。后台守全站的 token（页面底色、slate 色阶、墨蓝 --tone），
 * 但它是干活的工具：允许表格、细框输入框和实心的主按钮，版式比公开页密。
 * 公开页的文字按钮与底线输入框见 shared/text-button、shared/form-field。
 */

export {
  PRIMARY_BUTTON_CLASS as TEXT_PRIMARY_CLASS,
  TEXT_BUTTON_CLASS,
} from "@/components/shared/text-button";

/** 页面主操作（保存、发布、新增）：实心强调色，不加阴影与渐变 */
export const SOLID_BUTTON_CLASS =
  "inline-flex items-center justify-center gap-1.5 rounded-md bg-(--tone) px-4 py-1.5 text-sm text-white dark:text-slate-900 transition-opacity hover:opacity-85 disabled:opacity-40 disabled:cursor-not-allowed";

/** 次要的有框按钮（取消、重试） */
export const OUTLINE_BUTTON_CLASS =
  "inline-flex items-center justify-center gap-1.5 rounded-md border border-slate-200 dark:border-slate-700 px-4 py-1.5 text-sm text-slate-600 dark:text-slate-300 transition-colors hover:border-slate-300 hover:text-slate-900 dark:hover:border-slate-600 dark:hover:text-slate-100 disabled:opacity-40 disabled:cursor-not-allowed";

/** 表单输入：细框，聚焦时换成强调色。后台字段多，底线输入框扫读起来太散 */
export const INPUT_CLASS =
  "block w-full rounded-md border border-slate-200 dark:border-slate-700 bg-transparent px-3 py-1.5 text-sm text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-600 outline-none transition-colors focus:border-(--tone) disabled:opacity-50";

export const INPUT_ERROR_CLASS =
  "border-rose-300 dark:border-rose-500/60 focus:border-rose-500";

/** 下拉选择：与输入框同一种框，选项沿用页面底色 */
export const SELECT_CLASS = `${INPUT_CLASS} [&>option]:bg-[#FAFAFA] dark:[&>option]:bg-[#0B0F19]`;

/** 字段标签 */
export const LABEL_CLASS =
  "block text-xs tracking-[0.2em] text-slate-400 dark:text-slate-500";

/** 表头、元信息小字 */
export const META_CLASS =
  "text-xs tracking-[0.15em] text-slate-400 dark:text-slate-500";

/** 列表的一行：只用细线分隔，不用卡片 */
export const ROW_CLASS =
  "border-b border-slate-200/70 dark:border-slate-800 transition-colors hover:bg-slate-100/60 dark:hover:bg-slate-900/60";

/** 少数需要框起来的区块（编辑器、预览） */
export const PANEL_CLASS =
  "rounded-lg border border-slate-200/70 dark:border-slate-800";

/** 小标签：只有一道细框，不铺底色 */
export const TAG_CLASS =
  "inline-flex items-center rounded border border-slate-200 dark:border-slate-700 px-1.5 text-[11px] leading-5 text-slate-500 dark:text-slate-400";

/** 待处理、缺失：全站唯一允许的警示色 */
export const WARN_TEXT_CLASS = "text-amber-600 dark:text-amber-400";

export const ERROR_TEXT_CLASS = "text-rose-600 dark:text-rose-400";

/** 两步确认进入待确认时的文字色 */
export const DANGER_TEXT_CLASS =
  "text-rose-500 dark:text-rose-400 hover:text-rose-600";
