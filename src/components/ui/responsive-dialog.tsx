"use client";

import * as React from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Drawer, DrawerContent } from "@/components/ui/drawer";
import { useIsDesktop } from "@/hooks/ui/useIsDesktop";

/**
 * 宽屏居中弹窗、窄屏底部面板（DESIGN.md「浮层」；带压暗的居中弹窗只在宽屏用，见 ui/browser-chrome）。
 * 内容可滚动，footer 固定在底部，放取消、保存这类按钮。
 */
export function ResponsiveDialog({
  open,
  onOpenChange,
  title,
  description,
  footer,
  className,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** 只给读屏用的说明 */
  description?: string;
  footer?: React.ReactNode;
  /** 宽屏弹窗的宽度等 */
  className?: string;
  children: React.ReactNode;
}) {
  const isDesktop = useIsDesktop();

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          title={title}
          description={description}
          className={className}
        >
          <div className="min-h-0 flex-1 overflow-y-auto px-6 pt-2 pb-6">
            {children}
          </div>
          {footer && (
            <div className="flex shrink-0 items-center justify-end gap-3 border-t border-slate-200/70 px-6 py-4 dark:border-slate-800">
              {footer}
            </div>
          )}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent title={title} description={description}>
        <div className="pt-2">{children}</div>
        {footer && (
          <div className="mt-6 flex items-center justify-end gap-3 border-t border-slate-200/70 pt-4 dark:border-slate-800">
            {footer}
          </div>
        )}
      </DrawerContent>
    </Drawer>
  );
}
