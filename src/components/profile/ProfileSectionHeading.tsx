import React from "react";

/**
 * 节内各组的题头（账户设置的「公开资料」、反馈的「提交反馈」等）：
 * 与各节题头同一结构（题名后接一道线），字号与颜色都低一档（13px、次要灰），
 * 不能比强调色的节题头还显眼。
 * 以前题名和字段标签同为灰色小字，整页分不出组。题名后的线用点线
 * （像目录里的引线）：实线和输入框的底线同形，挂在题名后面也还是会混
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
      {/* border-dotted 的点太碎，用背景画：直径约 1.5px，间距 6px */}
      <span className="flex-1 h-[3px] text-slate-300 dark:text-slate-700 bg-[radial-gradient(circle,currentColor_0.75px,transparent_1.25px)] bg-size-[6px_3px] bg-repeat-x" />
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
