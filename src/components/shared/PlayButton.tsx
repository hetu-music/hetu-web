"use client";

import React from "react";
import { Pause, Play } from "lucide-react";
import { cn } from "@/lib/utils/utils";
import { usePlayerStore } from "@/store/player-store";
import { useUserContext } from "@/context/UserContext";

interface PlayButtonProps {
  songId: number;
  title: string;
  artist?: string | null;
  coverUrl?: string | null;
  hasAudio?: boolean;
  className?: string;
  size?: number;
}

export default function PlayButton({
  songId,
  title,
  artist,
  coverUrl,
  hasAudio = true,
  className,
  size = 15,
}: PlayButtonProps) {
  const { user, loaded } = useUserContext();
  const { currentTrack, isPlaying, play, toggle } = usePlayerStore();

  const hasBenefits = loaded && !!user?.hasBenefits;
  if (!hasBenefits || !hasAudio) return null;

  const isCurrentSong = currentTrack?.songId === songId;
  const isThisPlaying = isCurrentSong && isPlaying;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isCurrentSong) {
      toggle();
    } else {
      play({ songId, title, artist, coverUrl });
    }
  };

  return (
    <button
      onClick={handleClick}
      aria-label={isThisPlaying ? "暂停" : "播放"}
      title={isThisPlaying ? "暂停" : "播放"}
      className={cn(
        "rounded-lg p-2 transition-all duration-200",
        isThisPlaying
          ? "text-(--tone) bg-(--tone)/10"
          : "text-slate-400 dark:text-slate-500 hover:text-(--tone) hover:bg-(--tone)/10",
        className,
      )}
    >
      {isThisPlaying ? (
        <Pause size={size} className="fill-current" />
      ) : (
        <Play size={size} className="fill-current" />
      )}
    </button>
  );
}
