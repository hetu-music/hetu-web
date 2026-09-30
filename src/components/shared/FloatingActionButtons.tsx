"use client";

import PlayerToggle from "@/components/shared/PlayerToggle";
import { cn } from "@/lib/utils/utils";
import { usePlayerStore } from "@/store/player-store";
import { ArrowDown, ArrowUp } from "lucide-react";
import { useTranslations } from "next-intl";
import React, { useEffect, useState } from "react";

interface FloatingActionButtonsProps {
  /** 已滚下去：跳转按钮指向顶部，否则指向底部 */
  showScrollTop: boolean;
  onScrollToTop: () => void;
  className?: string;
}

/** 停止滚动多久后收起跳转按钮 */
const IDLE_MS = 2000;

const BUTTON_CLASS =
  "size-11 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-900/5 dark:hover:bg-white/10 active:bg-slate-900/10 dark:active:bg-white/15 transition-colors";

/** 页面正在滚动，停下 IDLE_MS 后复位 */
function useScrolling() {
  const [scrolling, setScrolling] = useState(false);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onScroll = () => {
      setScrolling(true);
      clearTimeout(timer);
      timer = setTimeout(() => setScrolling(false), IDLE_MS);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      clearTimeout(timer);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);
  return scrolling;
}

function scrollToBottom() {
  window.scrollTo({
    top: document.documentElement.scrollHeight,
    behavior: "smooth",
  });
}

/**
 * 页面右下角的竖向胶囊：播放条开关（有曲目时常驻）与跳转按钮。
 * 跳转按钮只在滚动时出现，停下一会儿后收起；指针停在胶囊上时不收。
 * 没滚下去时指向底部，滚下去后指向顶部。
 * 两者都不显示时整条隐去；只剩一个时胶囊收成圆形。
 */
const FloatingActionButtons: React.FC<FloatingActionButtonsProps> = ({
  showScrollTop,
  onScrollToTop,
  className,
}) => {
  const t = useTranslations("common.scroll");
  const hasPlayer = usePlayerStore((s) => !!s.currentTrack);
  // 播放条展开时让到它上方
  const playerShown = usePlayerStore(
    (s) => !!s.currentTrack && s.playerVisible,
  );
  const scrolling = useScrolling();
  const [held, setHeld] = useState(false);
  const showJump = scrolling || held;
  const visible = hasPlayer || showJump;

  return (
    <div
      onPointerEnter={(e) => e.pointerType === "mouse" && setHeld(true)}
      onPointerLeave={() => setHeld(false)}
      // 只有键盘聚焦才留住；鼠标点过后按钮仍带焦点，不能因此一直不收
      onFocus={(e) => e.target.matches(":focus-visible") && setHeld(true)}
      onBlur={() => setHeld(false)}
      className={cn(
        "fixed right-4 sm:right-6 z-50 flex flex-col overflow-hidden rounded-full",
        // 与播放条、下拉同用页面底色：不透明，不做毛玻璃（常驻元素的模糊会持续耗电）
        "bg-[#FAFAFA] dark:bg-[#0B0F19]",
        "ring-1 ring-slate-900/[0.06] dark:ring-white/10",
        "shadow-[0_10px_28px_-12px_rgba(15,23,42,0.35)] dark:shadow-[0_10px_28px_-12px_rgba(0,0,0,0.6)]",
        "transition-[bottom,opacity,translate] duration-300 ease-out",
        // 播放条高 4rem（另加底部安全区），胶囊浮在它上方 1rem
        playerShown
          ? "bottom-[calc(5rem+env(safe-area-inset-bottom))]"
          : "bottom-6 sm:bottom-8",
        !visible && "opacity-0 translate-y-3 pointer-events-none",
        className,
      )}
    >
      <PlayerToggle className={BUTTON_CLASS} />

      {/* 跳转：不显示时高度收起，胶囊随之缩短 */}
      <div
        className={cn(
          "grid transition-[grid-template-rows,opacity] duration-300 ease-out",
          showJump ? "grid-rows-[1fr]" : "grid-rows-[0fr] opacity-0",
        )}
      >
        <div className="min-h-0 overflow-hidden">
          {hasPlayer && (
            <div className="mx-auto h-px w-5 bg-slate-200 dark:bg-slate-700" />
          )}
          <button
            type="button"
            onClick={showScrollTop ? onScrollToTop : scrollToBottom}
            className={cn(BUTTON_CLASS, "relative")}
            title={showScrollTop ? t("toTop") : t("toBottom")}
            aria-label={showScrollTop ? t("toTop") : t("toBottom")}
            aria-hidden={!showJump}
            tabIndex={showJump ? 0 : -1}
          >
            <ArrowUp
              size={18}
              strokeWidth={2.25}
              className={cn(
                "absolute transition-[opacity,rotate] duration-300",
                showScrollTop ? "opacity-100" : "opacity-0 -rotate-90",
              )}
            />
            <ArrowDown
              size={18}
              strokeWidth={2.25}
              className={cn(
                "absolute transition-[opacity,rotate] duration-300",
                showScrollTop ? "opacity-0 rotate-90" : "opacity-100",
              )}
            />
          </button>
        </div>
      </div>
    </div>
  );
};

export default FloatingActionButtons;
