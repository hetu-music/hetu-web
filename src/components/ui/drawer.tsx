"use client";

import { PanelHeader } from "@/components/ui/dialog";
import { CHROME_TONES, EdgeChrome } from "@/components/ui/browser-chrome";
import { useOverlayHost } from "@/components/ui/overlay-host";
import { cn } from "@/lib/utils/utils";
import { Drawer as BaseDrawer } from "@base-ui/react/drawer";
import * as React from "react";

/** 窄屏的底部面板，往下拖可以收起（默认 swipeDirection="down"） */
const Drawer = BaseDrawer.Root;
const DrawerTrigger = BaseDrawer.Trigger;
const DrawerClose = BaseDrawer.Close;
const DrawerTitle = BaseDrawer.Title;
const DrawerDescription = BaseDrawer.Description;

type DrawerContentProps = Omit<
  React.ComponentProps<typeof BaseDrawer.Popup>,
  "className"
> & {
  /** 面板本身，常用来定高度 */
  className?: string;
  /** 面板里可滚动的内容区 */
  contentClassName?: string;
  /** 不给就不渲染标准题头，由调用方在内容里自己放 DrawerTitle */
  title?: string;
  /** 只给读屏用的说明 */
  description?: string;
};

function DrawerContent({
  className,
  contentClassName,
  title,
  description,
  children,
  ...props
}: DrawerContentProps) {
  const host = useOverlayHost();
  return (
    <BaseDrawer.Portal container={host}>
      {/* 遮罩透明，只用来接住点击、挡住页面滚动：不压暗页面（见 ui/dialog 的 STYLES） */}
      <BaseDrawer.Backdrop className="fixed inset-0 z-60 touch-none" />
      {/* Viewport 只用来接拖动的事件，不占位置（display: contents）。
          它若是一层铺满全屏的透明 fixed 层，iOS 26 的 Safari 贴边取色会先碰到它（见 browser-chrome） */}
      <BaseDrawer.Viewport className="contents">
        {/* 面板自己是贴底的 fixed 元素：iOS 26 的 Safari 底栏取到的就是面板的颜色 */}
        <BaseDrawer.Popup
          className={cn(
            "fixed inset-x-0 bottom-0 z-60 flex min-h-0 max-h-[calc(100dvh-var(--nav-h))] flex-col outline-none touch-none",
            "rounded-t-2xl bg-[#FAFAFA] dark:bg-[#0B0F19] shadow-[0_-20px_50px_-20px_rgba(15,23,42,0.35)]",
            // 位移交给 Base UI 写进 --drawer-swipe-movement-y，transform 只能由这里统一给出
            "transform-[translateY(var(--drawer-swipe-movement-y))] transition-transform duration-400 ease-page data-swiping:duration-0",
            // 入场时留一截露在底边，Safari 挂上时取色才取到面板而不是遮罩
            "data-starting-style:transform-[translateY(calc(100%-12px))] data-ending-style:transform-[translateY(100%)] data-ending-style:duration-[calc(var(--drawer-swipe-strength)*400ms)]",
            // 往上拖过头时，底下补一截同色，不露出页面
            "after:pointer-events-none after:absolute after:inset-x-0 after:top-full after:h-12 after:bg-inherit after:content-['']",
            className,
          )}
          {...props}
        >
          <div className="shrink-0 select-none">
            <div
              aria-hidden
              className="mx-auto mt-2.5 h-1 w-9 rounded-full bg-slate-300/80 dark:bg-slate-700"
            />
            {title && <PanelHeader title={title} description={description} />}
          </div>
          <BaseDrawer.Content
            className={cn(
              "min-h-0 flex-1 overflow-y-auto overscroll-contain touch-auto px-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))]",
              contentClassName,
            )}
          >
            {children}
          </BaseDrawer.Content>
        </BaseDrawer.Popup>
      </BaseDrawer.Viewport>
      <EdgeChrome tone={CHROME_TONES.page} edges={["top"]} />
    </BaseDrawer.Portal>
  );
}

export {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
  DrawerTrigger,
};
