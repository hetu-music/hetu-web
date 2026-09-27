"use client";

import PlayerToggle from "@/components/shared/PlayerToggle";
import { cn } from "@/lib/utils/utils";
import { usePlayerStore } from "@/store/player-store";
import { ArrowUp } from "lucide-react";
import React from "react";

interface FloatingActionButtonsProps {
  showScrollTop: boolean;
  onScrollToTop: () => void;
  className?: string;
}

const BUTTON_CLASS =
  "size-10 flex items-center justify-center rounded-full bg-[#FAFAFA]/85 dark:bg-[#0B0F19]/85 backdrop-blur-md ring-1 ring-slate-200/80 dark:ring-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-colors";

/**
 * 页面右下角的两个小按钮：播放条开关（有曲目时）与回到顶部（滚下去后）。
 * 分享、安装等次要操作都在顶栏里。
 */
const FloatingActionButtons: React.FC<FloatingActionButtonsProps> = ({
  showScrollTop,
  onScrollToTop,
  className,
}) => {
  // 播放条展开时让到它上方
  const playerShown = usePlayerStore((s) => !!s.currentTrack && s.playerVisible);

  return (
    <div
      className={cn(
        "fixed right-6 z-50 flex flex-col items-center gap-2 transition-[bottom] duration-300",
        playerShown ? "bottom-[112px]" : "bottom-8",
        className,
      )}
    >
      <PlayerToggle className={BUTTON_CLASS} />
      <button
        type="button"
        onClick={onScrollToTop}
        className={cn(
          BUTTON_CLASS,
          "transition-[color,opacity,translate] duration-300",
          !showScrollTop && "opacity-0 translate-y-2 pointer-events-none",
        )}
        title="返回顶部"
        aria-label="返回顶部"
        aria-hidden={!showScrollTop}
        tabIndex={showScrollTop ? 0 : -1}
      >
        <ArrowUp size={18} />
      </button>
    </div>
  );
};

export default FloatingActionButtons;
