"use client";

import { CHROME_TONES, EdgeChrome } from "@/components/ui/browser-chrome";
import { PanelHeader } from "@/components/ui/dialog";
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
  /** 遮罩不着色（意象词云：面板后面的词还要看得见）。遮罩本身仍在，用来接住点击 */
  transparentBackdrop?: boolean;
};

function DrawerContent({
  className,
  contentClassName,
  title,
  description,
  transparentBackdrop = false,
  children,
  ...props
}: DrawerContentProps) {
  const host = useOverlayHost();
  return (
    <BaseDrawer.Portal container={host}>
      {/* 遮罩随拖动的进度变淡；拖动中不要过渡，松手后按甩出的速度收尾。
          顶栏那一截裁掉，不压暗也不模糊，交界落在顶栏下沿的细线上：iOS 26 的 Safari 给状态栏涂的是
          不会过渡的纯色，贴着它的顶栏保持原样，状态栏就不用跟着变，开关面板时上沿不会出现断层
          （见 ui/browser-chrome）。裁切不影响点击，点在顶栏上照样算点外面 */}
      <BaseDrawer.Backdrop
        className={cn(
          "fixed inset-0 z-60 touch-none",
          !transparentBackdrop &&
          "bg-(--scrim) backdrop-blur-[2px] mask-[linear-gradient(to_bottom,transparent_var(--nav-h),black_var(--nav-h))] opacity-[calc(1-var(--drawer-swipe-progress))] transition-opacity duration-400 ease-page data-swiping:duration-0 data-starting-style:opacity-0 data-ending-style:opacity-0 data-ending-style:duration-[calc(var(--drawer-swipe-strength)*400ms)]",
        )}
      />
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
      {/* 透明的遮罩 Safari 当它不存在，状态栏会透出内容；铺一条页面底色让它保持原样 */}
      {transparentBackdrop && (
        <EdgeChrome tone={CHROME_TONES.plain} edges={["top"]} />
      )}
    </BaseDrawer.Portal>
  );
}

export {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
  DrawerTrigger
};

