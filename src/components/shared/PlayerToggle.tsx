"use client";

import { cn } from "@/lib/utils/utils";
import { usePlayerStore } from "@/store/player-store";
import { Disc3 } from "lucide-react";

/** 播放条的开关：有曲目时才出现，播放中唱片转动 */
export default function PlayerToggle({ className }: { className?: string }) {
  const { currentTrack, isPlaying, playerVisible, setPlayerVisible } =
    usePlayerStore();
  if (!currentTrack) return null;

  const label = playerVisible ? "收起播放器" : "展开播放器";
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
          playerVisible && "text-blue-500 dark:text-blue-400",
          isPlaying && "animate-spin animation-duration-[3s]",
        )}
      />
    </button>
  );
}
