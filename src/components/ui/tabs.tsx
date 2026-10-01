"use client";

import { Tabs as BaseTabs } from "@base-ui/react/tabs";
import * as React from "react";
import { cn } from "@/lib/utils/utils";

const Tabs = BaseTabs.Root;

type WithClassName<T extends React.ElementType> = Omit<
  React.ComponentProps<T>,
  "className"
> & { className?: string };

/** 页签平分一行，底下一道细线 */
function TabsList({
  className,
  ...props
}: WithClassName<typeof BaseTabs.List>) {
  return (
    <BaseTabs.List
      className={cn(
        "flex shrink-0 border-b border-slate-100 dark:border-slate-800",
        className,
      )}
      {...props}
    />
  );
}

/** 当前项变成强调色，底下亮起一截强调色短线 */
function TabsTrigger({
  className,
  ...props
}: WithClassName<typeof BaseTabs.Tab>) {
  return (
    <BaseTabs.Tab
      className={cn(
        "relative flex-1 pb-3 pt-4 text-sm font-medium transition-colors",
        "rounded-none focus-visible:outline-none",
        "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200",
        "data-active:text-(--tone) dark:data-active:text-(--tone)",
        "after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5",
        "after:rounded-full after:bg-(--tone)",
        "after:opacity-0 data-active:after:opacity-100 after:transition-opacity",
        className,
      )}
      {...props}
    />
  );
}

/** 切过来时淡入并微微上移（每次切换都是新挂载，动画会重放） */
function TabsContent({
  className,
  ...props
}: WithClassName<typeof BaseTabs.Panel>) {
  return (
    <BaseTabs.Panel
      className={cn(
        "overflow-y-auto p-6 outline-none",
        "animate-in fade-in-0 slide-in-from-bottom-4 duration-500",
        className,
      )}
      {...props}
    />
  );
}

export { Tabs, TabsContent, TabsList, TabsTrigger };
