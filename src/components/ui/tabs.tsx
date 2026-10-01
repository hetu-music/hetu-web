"use client";

import { Tabs as BaseTabs } from "@base-ui/react/tabs";
import * as React from "react";
import { cn } from "@/lib/utils/utils";

const Tabs = BaseTabs.Root;

type WithClassName<T extends React.ElementType> = Omit<
  React.ComponentProps<T>,
  "className"
> & { className?: string };

/** 一行衬线小字，底下一道细线；当前项变成强调色，下方一截强调色细线跟着滑过去 */
function TabsList({
  className,
  children,
  ...props
}: WithClassName<typeof BaseTabs.List>) {
  return (
    <BaseTabs.List
      className={cn(
        "relative flex shrink-0 gap-7 border-b border-slate-200/70 dark:border-slate-800",
        className,
      )}
      {...props}
    >
      {children}
      <BaseTabs.Indicator className="absolute -bottom-px left-0 h-px w-(--active-tab-width) translate-x-(--active-tab-left) bg-(--tone) transition-[translate,width] duration-300 ease-page" />
    </BaseTabs.List>
  );
}

function TabsTrigger({
  className,
  ...props
}: WithClassName<typeof BaseTabs.Tab>) {
  return (
    <BaseTabs.Tab
      className={cn(
        "py-3 font-serif text-sm tracking-[0.2em] whitespace-nowrap transition-colors outline-none",
        "text-slate-400 hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-200",
        "data-active:text-(--tone) dark:data-active:text-(--tone)",
        "focus-visible:text-slate-700 dark:focus-visible:text-slate-200",
        className,
      )}
      {...props}
    />
  );
}

/** 切过来时淡入；切走的那页立刻撤掉，两页不会同时占位 */
function TabsContent({
  className,
  ...props
}: WithClassName<typeof BaseTabs.Panel>) {
  return (
    <BaseTabs.Panel
      className={cn(
        "outline-none transition-opacity duration-300 ease-page data-starting-style:opacity-0 data-ending-style:hidden",
        className,
      )}
      {...props}
    />
  );
}

export { Tabs, TabsContent, TabsList, TabsTrigger };
