import React from "react";

/**
 * 节内各组的题名（账户设置的「公开资料」、反馈的「提交反馈」等）。
 * 以前和字段标签同为灰色小字，整页只剩一个层级，分不出组；
 * 换成衬线深色，与无衬线灰色的字段标签在字体、字号、颜色上都拉开
 */
export const GROUP_TITLE_CLASS =
  "font-serif text-[15px] font-semibold tracking-[0.15em] text-slate-800 dark:text-slate-200";

/** 组与组之间的细线：只靠留白分不开，按 DESIGN.md 的次序退到细线 */
export const GROUP_DIVIDE_CLASS =
  "divide-y divide-slate-200/70 dark:divide-slate-800";

/**
 * 各节题头：宽屏同 SectionHeading（一行小字加细线，右侧放本节的操作）；
 * 窄屏正文上方已有横排目录，题名与细线不再重复，只留右侧的操作。
 */
export default function ProfileSectionHeading({
  label,
  children,
}: {
  label: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-5">
      <h2 className="hidden lg:block font-serif text-sm tracking-[0.4em] text-(--tone) whitespace-nowrap">
        {label}
      </h2>
      <span className="flex-1 lg:h-px lg:bg-slate-200 lg:dark:bg-slate-800" />
      {children}
    </div>
  );
}
