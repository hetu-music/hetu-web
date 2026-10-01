"use client";

import * as React from "react";
import { Drawer, DrawerContent, DrawerTrigger } from "@/components/ui/drawer";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useIsDesktop } from "@/hooks/ui/useIsDesktop";

export type PanelLayout = "popover" | "drawer";

/**
 * 宽屏在按钮下方展开、窄屏从底部拉出（DESIGN.md「浮层」）。
 * 两种形态的内容往往疏密不同，所以 children 按形态分别给出。
 */
export function ResponsivePanel({
  open,
  onOpenChange,
  title,
  trigger,
  align,
  popoverClassName,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 底部面板的题头，也是宽屏下拉的无障碍名称 */
  title: string;
  /** 触发按钮，须是 <button>；展开、收起由这里接管 */
  trigger: React.ReactElement;
  align?: React.ComponentProps<typeof PopoverContent>["align"];
  popoverClassName?: string;
  children: (layout: PanelLayout) => React.ReactNode;
}) {
  const isDesktop = useIsDesktop();

  if (isDesktop) {
    return (
      <Popover open={open} onOpenChange={onOpenChange}>
        <PopoverTrigger render={trigger} />
        <PopoverContent
          align={align}
          aria-label={title}
          className={popoverClassName}
        >
          {children("popover")}
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerTrigger render={trigger} />
      <DrawerContent title={title}>{children("drawer")}</DrawerContent>
    </Drawer>
  );
}
