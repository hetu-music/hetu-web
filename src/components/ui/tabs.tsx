"use client";

import { Tabs as BaseTabs } from "@base-ui/react/tabs";
import * as React from "react";
import { TAB_HAIRLINE_CLASS } from "@/components/shared/tab-hairline";
import { cn } from "@/lib/utils/utils";

const Tabs = BaseTabs.Root;

/**
 * fill：页签平分一行，底下一道细线（「关于」这类浮层里的分段）。
 * inline：一行文字页签，靠左排，不画整道底线（后台工作台的栏目、对照编辑的视图）。
 */
type TabsVariant = "fill" | "inline";

type WithClassName<T extends React.ElementType> = Omit<
  React.ComponentProps<T>,
  "className"
> & { className?: string; variant?: TabsVariant };

const LIST_STYLES: Record<TabsVariant, string> = {
  // 细线画在里面，当前页签的短线才压得住它（见 TAB_HAIRLINE_CLASS）
  fill: cn(TAB_HAIRLINE_CLASS, "flex shrink-0"),
  inline: "flex flex-wrap items-baseline gap-x-6",
};

// 两种页签都是：当前项变成强调色，底下亮起一截强调色短线
const TRIGGER_STYLES: Record<TabsVariant, string> = {
  fill: cn(
    "flex-1 pb-3 pt-4 text-sm font-medium",
    "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200",
    "after:bottom-0 after:left-0 after:right-0",
  ),
  // 宽字距会在末字后多留 0.1em，短线右端收回同样的距离；选中加粗一档，深色下单靠字色分不清
  inline: cn(
    "py-2 text-sm tracking-widest data-active:font-medium",
    "text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200",
    "after:bottom-0.5 after:left-0 after:right-[0.1em]",
  ),
};

function TabsList({
  className,
  variant = "fill",
  ...props
}: WithClassName<typeof BaseTabs.List>) {
  return (
    <BaseTabs.List className={cn(LIST_STYLES[variant], className)} {...props} />
  );
}

function TabsTrigger({
  className,
  variant = "fill",
  ...props
}: WithClassName<typeof BaseTabs.Tab>) {
  return (
    <BaseTabs.Tab
      className={cn(
        "relative transition-colors rounded-none focus-visible:outline-none",
        TRIGGER_STYLES[variant],
        "data-active:text-(--tone) dark:data-active:text-(--tone)",
        "after:absolute after:h-0.5 after:rounded-full after:bg-(--tone)",
        "after:opacity-0 data-active:after:opacity-100 after:transition-opacity",
        className,
      )}
      {...props}
    />
  );
}

/** fill：切过来时淡入并微微上移（每次切换都是新挂载，动画会重放）。inline：不加样式，由内容自己排 */
function TabsContent({
  className,
  variant = "fill",
  ...props
}: WithClassName<typeof BaseTabs.Panel>) {
  return (
    <BaseTabs.Panel
      className={cn(
        "outline-none",
        variant === "fill" &&
          "overflow-y-auto p-6 animate-in fade-in-0 slide-in-from-bottom-4 duration-500",
        className,
      )}
      {...props}
    />
  );
}

export { Tabs, TabsContent, TabsList, TabsTrigger };
