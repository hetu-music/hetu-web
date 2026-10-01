"use client";

import { Dialog as BaseDialog } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";
import { useOverlayHost } from "@/components/ui/overlay-host";
import { cn } from "@/lib/utils/utils";

const Dialog = BaseDialog.Root;
const DialogClose = BaseDialog.Close;

/**
 * 公开页的浮层题头：一行衬线小字，右侧收起。居中弹窗与底部面板共用
 * （Drawer 的 Title、Close 就是 Dialog 的同一份实现）。
 */
function PanelHeader({
  title,
  description,
}: {
  title: string;
  /** 只给读屏用的说明 */
  description?: string;
}) {
  const tNav = useTranslations("common.nav");
  return (
    <div className="flex shrink-0 items-center justify-between px-6 pt-5 pb-2">
      <BaseDialog.Title className="font-serif text-xs font-normal tracking-[0.4em] text-(--tone)">
        {title}
      </BaseDialog.Title>
      {description && (
        <BaseDialog.Description className="sr-only">
          {description}
        </BaseDialog.Description>
      )}
      <BaseDialog.Close
        aria-label={tNav("close")}
        className="p-1 -mr-1 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
      >
        <X size={18} />
      </BaseDialog.Close>
    </div>
  );
}

// 进出场：居中弹窗动透明度和一点缩放（独立的 scale 属性，不与居中用的 translate 冲突）；
// 看图只淡入淡出整层，缩放留给图片自己，标题和工具栏不跟着缩
const STYLES = {
  page: {
    backdrop:
      "z-60 bg-slate-950/30 backdrop-blur-[2px] transition-opacity duration-300 ease-page",
    popup:
      "left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 data-starting-style:scale-[0.98] data-ending-style:scale-[0.98] z-60 w-[calc(100vw-2rem)] max-w-lg max-h-[85dvh] rounded-xl border border-slate-200/70 dark:border-slate-800 bg-[#FAFAFA] dark:bg-[#0B0F19] shadow-[0_16px_40px_-12px_rgba(15,23,42,0.25)] transition-[opacity,scale] duration-300 ease-page",
  },
  // 后台沿用原来的样子，等后台统一改版时再说
  admin: {
    backdrop:
      "z-60 bg-slate-900/20 dark:bg-black/60 backdrop-blur-sm transition-opacity duration-200",
    popup:
      "left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 data-starting-style:scale-[0.98] data-ending-style:scale-[0.98] z-60 w-full max-w-md max-h-[85vh] rounded-2xl border border-black/5 dark:border-white/10 bg-white dark:bg-[#111] shadow-2xl transition-[opacity,scale] duration-200",
  },
  // 全屏看图：黑底铺满，内容自己排布
  viewer: {
    backdrop:
      "z-60 bg-black/80 backdrop-blur-sm transition-opacity duration-300 ease-page data-ending-style:duration-200",
    popup:
      "group z-60 inset-0 size-full transition-opacity duration-300 ease-page data-ending-style:duration-200",
  },
};

type DialogContentProps = Omit<
  React.ComponentProps<typeof BaseDialog.Popup>,
  "className"
> & {
  className?: string;
  variant?: keyof typeof STYLES;
  /** 给了就渲染公开页样式的题头（PanelHeader） */
  title?: string;
  description?: string;
};

function DialogContent({
  className,
  variant = "page",
  title,
  description,
  children,
  ...props
}: DialogContentProps) {
  const host = useOverlayHost();
  const styles = STYLES[variant];
  return (
    <BaseDialog.Portal container={host}>
      <BaseDialog.Backdrop
        className={cn(
          "fixed inset-0 data-starting-style:opacity-0 data-ending-style:opacity-0",
          styles.backdrop,
        )}
      />
      <BaseDialog.Popup
        className={cn(
          "fixed flex flex-col outline-none",
          "data-starting-style:opacity-0 data-ending-style:opacity-0",
          styles.popup,
          className,
        )}
        {...props}
      >
        {title && <PanelHeader title={title} description={description} />}
        {children}
      </BaseDialog.Popup>
    </BaseDialog.Portal>
  );
}

const DialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex items-center justify-between px-6 py-5 border-b border-slate-100 dark:border-slate-800 shrink-0",
      className,
    )}
    {...props}
  />
);

function DialogTitle({
  className,
  ...props
}: Omit<React.ComponentProps<typeof BaseDialog.Title>, "className"> & {
  className?: string;
}) {
  return (
    <BaseDialog.Title
      className={cn(
        "text-xl font-bold text-slate-900 dark:text-white",
        className,
      )}
      {...props}
    />
  );
}

function DialogDescription({
  className,
  ...props
}: Omit<React.ComponentProps<typeof BaseDialog.Description>, "className"> & {
  className?: string;
}) {
  return (
    <BaseDialog.Description
      className={cn("text-sm text-slate-500 dark:text-slate-400", className)}
      {...props}
    />
  );
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  PanelHeader,
};
