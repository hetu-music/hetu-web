/** 全站表单的写法：只有一道底线的输入框，字段标签用小字宽字距（见 DESIGN.md 第五节） */

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
