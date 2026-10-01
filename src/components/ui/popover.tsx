"use client";

import { Popover as BasePopover } from "@base-ui/react/popover";
import * as React from "react";
import { useOverlayHost } from "@/components/ui/overlay-host";
import { cn } from "@/lib/utils/utils";

/** 宽屏下拉：点外面或按 Esc 收起，不锁滚动、不圈焦点 */
const Popover = BasePopover.Root;
const PopoverTrigger = BasePopover.Trigger;
const PopoverClose = BasePopover.Close;
const PopoverTitle = BasePopover.Title;

type PopoverContentProps = Omit<
  React.ComponentProps<typeof BasePopover.Popup>,
  "className"
> & {
  className?: string;
  side?: "top" | "bottom";
  align?: "start" | "center" | "end";
  sideOffset?: number;
};

/** 页面底色、细描边、柔和投影（DESIGN.md「浮层」） */
function PopoverContent({
  className,
  side = "bottom",
  align = "start",
  sideOffset = 12,
  ...props
}: PopoverContentProps) {
  const host = useOverlayHost();
  return (
    <BasePopover.Portal container={host}>
      {/* 触发按钮多在 fixed 的顶栏里，用 fixed 定位，页面滚动时也贴得住 */}
      <BasePopover.Positioner
        side={side}
        align={align}
        sideOffset={sideOffset}
        positionMethod="fixed"
        className="z-60"
      >
        <BasePopover.Popup
          className={cn(
            "rounded-xl border border-slate-200/70 dark:border-slate-800 bg-[#FAFAFA] dark:bg-[#0B0F19] shadow-[0_16px_40px_-12px_rgba(15,23,42,0.25)] px-4 py-2 outline-none",
            "transition-[opacity,translate] duration-200 ease-page",
            // 从按钮那一侧微微滑出
            "data-starting-style:opacity-0 data-ending-style:opacity-0 data-[side=bottom]:data-starting-style:-translate-y-1 data-[side=bottom]:data-ending-style:-translate-y-1 data-[side=top]:data-starting-style:translate-y-1 data-[side=top]:data-ending-style:translate-y-1",
            className,
          )}
          {...props}
        />
      </BasePopover.Positioner>
    </BasePopover.Portal>
  );
}

export { Popover, PopoverClose, PopoverContent, PopoverTitle, PopoverTrigger };
