import React from "react";

/**
 * 节内各组的题头（账户设置的「公开资料」、反馈的「提交反馈」等）：
 * 与各节题头同一写法（题名加细线），字号与颜色都低一档（13px、次要灰），
 * 不能比强调色的节题头还显眼。
 * 以前题名和字段标签同为灰色小字，整页分不出组；单放一道分隔线
 * 又和输入框的底线同形。细线挂在题名后面，就不会被看成输入框
 */
export function GroupHeading({
  label,
  children,
}: {
  label: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-4">
      <h3 className="font-serif text-[13px] font-semibold tracking-[0.3em] text-slate-600 dark:text-slate-400 whitespace-nowrap">
        {label}
      </h3>
      <span className="flex-1 h-px bg-slate-200 dark:bg-slate-800" />
      {children}
    </div>
  );
}

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
