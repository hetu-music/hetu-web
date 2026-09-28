"use client";

import React, { useState } from "react";
import { Check, ListPlus } from "lucide-react";
import { cn } from "@/lib/utils/utils";
import { usePlayerStore } from "@/store/player-store";
import { useUserContext } from "@/context/UserContext";

interface EnqueueButtonProps {
  songId: number;
  title: string;
  artist?: string | null;
  coverUrl?: string | null;
  hasAudio?: boolean;
  className?: string;
  size?: number;
}

export default function EnqueueButton({
  songId,
  title,
  artist,
  coverUrl,
  hasAudio = true,
  className,
  size = 15,
}: EnqueueButtonProps) {
  const { user, loaded } = useUserContext();
  const { queue, enqueue } = usePlayerStore();
  const [justAdded, setJustAdded] = useState(false);

  const hasBenefits = loaded && !!user?.hasBenefits;
  if (!hasBenefits || !hasAudio) return null;

  const alreadyInQueue = queue.some((t) => t.songId === songId);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (alreadyInQueue) return;
    enqueue({ songId, title, artist, coverUrl });
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 1500);
  };

  return (
    <button
      onClick={handleClick}
      aria-label={alreadyInQueue ? "已在播放列表" : "加入播放列表"}
      title={alreadyInQueue ? "已在播放列表" : "加入播放列表"}
      className={cn(
        "rounded-lg p-2 transition-all duration-200",
        alreadyInQueue || justAdded
          ? "text-(--tone) bg-(--tone)/10 cursor-default"
          : "text-slate-400 dark:text-slate-500 hover:text-(--tone) hover:bg-(--tone)/10",
        className,
      )}
    >
      {justAdded || alreadyInQueue ? (
        <Check size={size} />
      ) : (
        <ListPlus size={size} />
      )}
    </button>
  );
}
