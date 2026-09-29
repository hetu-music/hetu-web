"use client";

import { cn } from "@/lib/utils/utils";
import { usePlayerStore } from "@/store/player-store";
import { Disc3 } from "lucide-react";
import { useTranslations } from "next-intl";

/**
 * 播放条的开关：有曲目时才出现。
 * 播放条收起时，唱片转动是唯一的「正在播放」提示；展开后播放条自己会显示状态，
 * 唱片就停下，只留强调色——无限旋转会让整条浮动胶囊逐帧重新合成。
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
          playerVisible && "text-(--tone)",
          isPlaying &&
            !playerVisible &&
            "animate-spin animation-duration-[3s] motion-reduce:animate-none",
        )}
      />
    </button>
  );
}
