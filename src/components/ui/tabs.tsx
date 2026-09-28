"use client";

import { cn } from "@/lib/utils/utils";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import * as React from "react";

const Tabs = TabsPrimitive.Root;

const TabsList = React.forwardRef<
  React.ComponentRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      "flex shrink-0 border-b border-slate-100 dark:border-slate-800",
      className,
    )}
    {...props}
  />
));
TabsList.displayName = TabsPrimitive.List.displayName;

const TabsTrigger = React.forwardRef<
  React.ComponentRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      // Layout
      "relative flex-1 pb-3 pt-4 text-sm font-medium transition-colors",
      "rounded-none focus-visible:outline-none",
      // Inactive colours
      "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200",
      // Active colours
      "data-[state=active]:text-(--tone)",
      // Bottom indicator via ::after pseudo-element
      "after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5",
      "after:rounded-full after:bg-(--tone)",
      "after:opacity-0 data-[state=active]:after:opacity-100 after:transition-opacity",
      className,
    )}
    {...props}
  />
));
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

const TabsContent = React.forwardRef<
  React.ComponentRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      "overflow-y-auto p-6 outline-none",
      // Fade + subtle slide-up when the tab becomes active
      "data-[state=active]:animate-in data-[state=active]:fade-in-0",
      "data-[state=active]:slide-in-from-bottom-4 data-[state=active]:duration-500",
      className,
    )}
    {...props}
  />
));
TabsContent.displayName = TabsPrimitive.Content.displayName;

export { Tabs, TabsContent, TabsList, TabsTrigger };
