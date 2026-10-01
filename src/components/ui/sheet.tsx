"use client";

import { Dialog as BaseDialog } from "@base-ui/react/dialog";
import * as React from "react";
import { useOverlayHost } from "@/components/ui/overlay-host";
import { cn } from "@/lib/utils/utils";

/** 宽屏从左或右滑出的侧面板（模态：锁滚动、圈焦点，点外面收起）。不铺遮罩，词云照样看得见 */
const Sheet = BaseDialog.Root;
const SheetClose = BaseDialog.Close;
const SheetTitle = BaseDialog.Title;
const SheetDescription = BaseDialog.Description;

const SIDE = {
  right:
    "right-0 data-starting-style:translate-x-full data-ending-style:translate-x-full",
  left: "left-0 data-starting-style:-translate-x-full data-ending-style:-translate-x-full",
};

type SheetContentProps = Omit<
  React.ComponentProps<typeof BaseDialog.Popup>,
  "className"
> & {
  className?: string;
  side?: keyof typeof SIDE;
};

function SheetContent({
  className,
  side = "right",
  ...props
}: SheetContentProps) {
  const host = useOverlayHost();
  return (
    <BaseDialog.Portal container={host}>
      {/* 透明的遮罩，只为接住点击：模态时 Base UI 只把点在遮罩上算作「点外面」。
          不放的话它自己垫的那层没有 z-index，词云里带层级的元素会压在上面，
          点下去既不收起面板，还会直接点开别的词 */}
      <BaseDialog.Backdrop className="fixed inset-0 z-60" />
      <BaseDialog.Popup
        className={cn(
          "fixed z-60 flex flex-col bg-[#FAFAFA] dark:bg-[#0B0F19] shadow-2xl outline-none",
          "transition-[translate] duration-500 ease-page data-ending-style:duration-300",
          SIDE[side],
          className,
        )}
        {...props}
      />
    </BaseDialog.Portal>
  );
}

export { Sheet, SheetClose, SheetContent, SheetDescription, SheetTitle };
