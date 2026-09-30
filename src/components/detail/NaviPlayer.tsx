"use client";

import React, { useCallback, useMemo } from "react";
import {
  AlertCircle,
  ListPlus,
  Loader2,
  Pause,
  Play,
  Check,
} from "lucide-react";
import { useTranslations } from "next-intl";
import PlayingBars from "@/components/shared/PlayingBars";
import { cn } from "@/lib/utils/utils";
import { usePlayerStore } from "@/store/player-store";
import type { PlayerTrack } from "@/store/player-store";

interface NaviPlayerProps {
  songId: number;
  title: string;
  artist?: string | null;
  coverUrl?: string | null;
  hasAudio?: boolean;
  className?: string;
}

const NaviPlayer: React.FC<NaviPlayerProps> = ({
  songId,
  title,
  artist,
  coverUrl,
  hasAudio = true,
  className,
}) => {
  const t = useTranslations("common.player");
  // 细粒度 selector，避免无关状态变化触发重渲染
  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const isLoading = usePlayerStore((s) => s.isLoading);
  const isInQueue = usePlayerStore((s) =>
    s.queue.some((t) => t.songId === songId),
  );
  const error = usePlayerStore((s) => s.error);
  const toggle = usePlayerStore((s) => s.toggle);
  const play = usePlayerStore((s) => s.play);
  const enqueue = usePlayerStore((s) => s.enqueue);

  // 稳定的 track 对象引用，避免每次渲染都创建新对象
  const track = useMemo<PlayerTrack>(
    () => ({ songId, title, artist, coverUrl }),
    [songId, title, artist, coverUrl],
  );

  const isCurrentSong = currentTrack?.songId === songId;
  const isThisPlaying = isCurrentSong && isPlaying;
  const isThisLoading = isCurrentSong && isLoading;

  const handleToggle = useCallback(() => {
    if (isCurrentSong) {
      toggle();
    } else {
      play(track);
    }
  }, [isCurrentSong, toggle, play, track]);

  const handleEnqueue = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      enqueue(track);
    },
    [enqueue, track],
  );

  const currentError = isCurrentSong ? error : null;

  if (!hasAudio) return null;

  const status = currentError
    ? t(`errors.${currentError}`)
    : isThisLoading
      ? t("loading")
      : isThisPlaying
        ? t("previewing")
        : t("preview");

  return (
    <div className={cn("flex items-center gap-4 select-none", className)}>
      <button
        type="button"
        onClick={handleToggle}
        disabled={isThisLoading}
        aria-label={
          isThisLoading ? t("loading") : isThisPlaying ? t("pause") : t("play")
        }
        className={cn(
          "w-11 h-11 shrink-0 rounded-full flex items-center justify-center transition-all duration-300",
          "border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--tone)/40",
          isThisLoading
            ? "border-slate-200 dark:border-slate-700 text-slate-400 cursor-not-allowed"
            : isThisPlaying
              ? "bg-(--tone) border-(--tone) text-white dark:text-slate-950 active:scale-95"
              : "border-(--tone)/40 text-(--tone) hover:bg-(--tone) hover:border-(--tone) hover:text-white dark:hover:text-slate-950 active:scale-95",
        )}
      >
        {isThisLoading ? (
          <Loader2 size={15} className="animate-spin" />
        ) : isThisPlaying ? (
          <Pause size={15} className="fill-current" />
        ) : (
          <Play size={15} className="fill-current translate-x-px" />
        )}
      </button>

      <div className="min-w-0 flex items-center gap-2.5">
        {isThisPlaying && !currentError && <PlayingBars />}
        <p
          className={cn(
            "text-sm tracking-wider truncate",
            currentError
              ? "text-rose-500 flex items-center gap-1.5"
              : "text-slate-600 dark:text-slate-300",
          )}
        >
          {currentError ? (
            <>
              <AlertCircle size={13} className="shrink-0" />
              <span className="truncate">{status}</span>
              {/* 错误代码不截断：用户截图反馈时靠它判断断在哪一环 */}
              <span className="shrink-0 font-mono text-[11px] tracking-normal opacity-60">
                {currentError}
              </span>
            </>
          ) : (
            status
          )}
        </p>
      </div>

      <span className="w-px h-4 bg-slate-200 dark:bg-slate-800 shrink-0" />

      {isInQueue ? (
        <span
          title={t("inQueueTitle")}
          className="flex items-center gap-1 text-xs text-slate-400 dark:text-slate-500 shrink-0"
        >
          <Check size={13} strokeWidth={2.5} />
          {t("inQueue")}
        </span>
      ) : (
        <button
          type="button"
          onClick={handleEnqueue}
          aria-label={t("enqueueTitle")}
          title={t("enqueueTitle")}
          className="flex items-center gap-1 text-xs text-slate-400 dark:text-slate-500 hover:text-(--tone) transition-colors shrink-0"
        >
          <ListPlus size={14} />
          {t("enqueue")}
        </button>
      )}
    </div>
  );
};

export default NaviPlayer;
