import React from "react";

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
