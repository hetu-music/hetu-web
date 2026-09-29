"use client";

import { usePlaybackTick } from "@/hooks/player/usePlayerTime";
import { Link } from "@/i18n/navigation";
import {
  formatPlayerTime,
  getCurrentLrcIndex,
  parseLrc,
} from "@/lib/player/player-utils";
import { cn } from "@/lib/utils/utils";
import { usePlayerStore } from "@/store/player-store";
import {
  AlertCircle,
  Loader2,
  Music,
  Pause,
  Play,
  SkipBack,
  SkipForward,
} from "lucide-react";
import { useTranslations } from "next-intl";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ProgressLine, useProgress } from "./progress";
import QueueControl from "./QueuePanel";

const SKIP_BUTTON =
  "flex size-8 items-center justify-center rounded-full text-slate-400 transition-colors hover:text-slate-700 disabled:pointer-events-none disabled:opacity-30 md:size-9 dark:text-slate-500 dark:hover:text-slate-200";

/**
 * 贴底的播放条，与顶栏上下对称：页面底色，上沿一道进度细线。
 *
 * 本组件不订阅播放进度：进度线与时间码由 useProgress 直接写 DOM，
 * 歌词行由 TrackSubline 自己跟进度，整条播放条只在曲目或播放状态变化时重渲染。
 */
export default function PlayerBar() {
  const t = useTranslations("common.player");
  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const playerVisible = usePlayerStore((s) => s.playerVisible);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const isLoading = usePlayerStore((s) => s.isLoading);
  const hasPrev = usePlayerStore((s) => s.currentIndex > 0);
  const hasNext = usePlayerStore((s) => s.currentIndex < s.queue.length - 1);
  const toggle = usePlayerStore((s) => s.toggle);
  const prev = usePlayerStore((s) => s.prev);
  const next = usePlayerStore((s) => s.next);
  const duration = usePlayerStore((s) => s.trackDuration);
  const progress = useProgress();
  const { timeRef } = progress;

  if (!currentTrack) return null;

  return (
    <div
      inert={!playerVisible}
      className={cn(
        "fixed inset-x-0 bottom-0 z-50 bg-[#FAFAFA] pb-[env(safe-area-inset-bottom)] select-none dark:bg-[#0B0F19]",
        "transition-[translate] duration-300 ease-[cubic-bezier(0.23,1,0.32,1)]",
        // 多移 1rem，把伸出上沿的进度线点按区域也藏掉
        !playerVisible && "translate-y-[calc(100%+1rem)]",
      )}
    >
      <ProgressLine progress={progress} label={t("progress")} />

      <div className="mx-auto grid h-16 max-w-7xl grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 sm:px-6 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:gap-6">
        {/* 曲目：封面、歌名，下一行是歌词 / 歌手 / 错误 */}
        <div className="flex min-w-0 items-center gap-3">
          <div className="relative size-10 shrink-0 overflow-hidden rounded-md bg-slate-100 ring-1 ring-slate-900/5 dark:bg-slate-800 dark:ring-white/10">
            {currentTrack.coverUrl ? (
              <Image
                src={currentTrack.coverUrl}
                alt=""
                width={40}
                height={40}
                className="size-full object-cover"
              />
            ) : (
              <div className="flex size-full items-center justify-center text-slate-400">
                <Music size={14} />
              </div>
            )}
          </div>
          <div className="min-w-0">
            <Link
              href={`/song/${currentTrack.songId}`}
              className="block truncate font-serif text-sm text-slate-900 transition-colors hover:text-(--tone) dark:text-slate-50"
            >
              {currentTrack.title}
            </Link>
            <TrackSubline
              songId={currentTrack.songId}
              artist={currentTrack.artist}
            />
          </div>
        </div>

        {/* 窄屏：控制与队列挤在右侧一组；宽屏 contents 展开成居中的控制和靠右的工具 */}
        <div className="flex items-center gap-1 md:contents">
          <div className="flex items-center gap-1 md:gap-3">
            <button
              type="button"
              onClick={prev}
              disabled={!hasPrev}
              aria-label={t("prev")}
              className={SKIP_BUTTON}
            >
              <SkipBack size={15} className="fill-current" />
            </button>
            {/* 与歌曲页试听按钮同一写法：常态描边，播放中实心 */}
            <button
              type="button"
              onClick={toggle}
              disabled={isLoading}
              aria-label={
                isLoading ? t("loading") : isPlaying ? t("pause") : t("play")
              }
              className={cn(
                "flex size-9 shrink-0 items-center justify-center rounded-full border transition-colors duration-300 md:size-10",
                "focus-visible:ring-2 focus-visible:ring-(--tone)/40 focus-visible:outline-none",
                isLoading
                  ? "border-slate-200 text-slate-400 dark:border-slate-700"
                  : isPlaying
                    ? "border-(--tone) bg-(--tone) text-white active:scale-95 dark:text-slate-950"
                    : "border-(--tone)/40 text-(--tone) hover:border-(--tone) hover:bg-(--tone) hover:text-white active:scale-95 dark:hover:text-slate-950",
              )}
            >
              {isLoading ? (
                <Loader2 size={14} className="animate-spin" />
              ) : isPlaying ? (
                <Pause size={14} className="fill-current" />
              ) : (
                <Play size={14} className="translate-x-px fill-current" />
              )}
            </button>
            <button
              type="button"
              onClick={next}
              disabled={!hasNext}
              aria-label={t("next")}
              className={SKIP_BUTTON}
            >
              <SkipForward size={15} className="fill-current" />
            </button>
          </div>

          <div className="flex items-center justify-end gap-4 pl-2 md:pl-0">
            <span className="hidden text-xs tracking-wider text-slate-400 tabular-nums md:inline dark:text-slate-500">
              {/* 由 useProgress 直接写入，React 不管它的内容 */}
              <span ref={timeRef} />
              <span className="mx-1.5 opacity-60">/</span>
              {formatPlayerTime(duration)}
            </span>
            <span className="hidden h-3 w-px bg-slate-200 md:block dark:bg-slate-800" />
            <QueueControl />
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * 歌名下的一行：出错时显示错误，有歌词时显示当前句，否则显示歌手。
 * 当前句跟 timeupdate 算，只在句子变化时重渲染这一行。
 */
function TrackSubline({
  songId,
  artist,
}: {
  songId: number;
  artist?: string | null;
}) {
  const t = useTranslations("common.player");
  const error = usePlayerStore((s) => s.error);
  const lrc = usePlayerStore((s) => s.lyricsMap.get(songId));
  const lines = useMemo(() => (lrc ? parseLrc(lrc) : []), [lrc]);

  const [index, setIndex] = useState(-1);
  const refresh = usePlaybackTick(
    useCallback(
      (ct: number) => setIndex(getCurrentLrcIndex(lines, ct)),
      [lines],
    ),
  );
  // 换曲或歌词刚到时立即算一次；暂停中不会有 timeupdate
  useEffect(() => refresh(), [lines, refresh]);

  const text = index >= 0 ? lines[index]?.text : null;

  if (error) {
    return (
      <p className="mt-0.5 flex items-center gap-1 text-xs text-rose-500">
        <AlertCircle size={12} className="shrink-0" />
        <span className="truncate">{error}</span>
      </p>
    );
  }
  if (text) {
    return (
      <p
        key={index}
        className="mt-0.5 truncate font-serif text-xs text-(--tone) animate-in fade-in duration-500"
      >
        {text}
      </p>
    );
  }
  return (
    <p className="mt-0.5 truncate text-xs tracking-wider text-slate-400 dark:text-slate-500">
      {artist || t("unknownArtist")}
    </p>
  );
}
