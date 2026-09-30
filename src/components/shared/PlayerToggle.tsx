"use client";

import { cn } from "@/lib/utils/utils";
import { usePlayerStore } from "@/store/player-store";
import { Disc3 } from "lucide-react";
import { useTranslations } from "next-intl";

/**
 * 播放条的开关：有曲目时才出现。
 * 唱片跟播放状态走：播放时转，暂停时停在当前角度（暂停动画而不是移除，免得跳回原位）。
 * 胶囊不做毛玻璃，转动只重绘这一个图标。
 */
export default function PlayerToggle({ className }: { className?: string }) {
  const t = useTranslations("common.player");
  const hasTrack = usePlayerStore((s) => !!s.currentTrack);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const playerVisible = usePlayerStore((s) => s.playerVisible);
  const setPlayerVisible = usePlayerStore((s) => s.setPlayerVisible);
  if (!hasTrack) return null;

  const label = playerVisible ? t("hide") : t("show");
  return (
    <button
      type="button"
      onClick={() => setPlayerVisible(!playerVisible)}
      className={className}
      title={label}
      aria-label={label}
      aria-pressed={playerVisible}
    >
      <Disc3
        size={20}
        className={cn(
          "animate-spin animation-duration-[3s] motion-reduce:animate-none",
          !isPlaying && "[animation-play-state:paused]",
          playerVisible && "text-(--tone)",
        )}
      />
    </button>
  );
}
