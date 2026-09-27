import React from "react";

/** 章节题头：一行小字加细线，不用图标和卡片 */
export default function SectionHeading({
  label,
  children,
}: {
  label: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-5">
      <h2 className="font-serif text-sm tracking-[0.4em] text-(--tone) whitespace-nowrap">
        {label}
      </h2>
      <span className="flex-1 h-px bg-slate-200 dark:bg-slate-800" />
      {children}
    </div>
  );
}
