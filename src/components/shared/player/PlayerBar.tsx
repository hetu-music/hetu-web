"use client";

import { Link } from "@/i18n/navigation";
import { formatPlayerTime } from "@/lib/player/player-utils";
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
import { LyricText, useCurrentLyric } from "./lyrics";
import { ProgressLine, useProgress } from "./progress";
import QueueControl from "./QueuePanel";

const SKIP_BUTTON =
  "flex size-8 items-center justify-center rounded-full text-slate-400 transition-colors hover:text-slate-700 disabled:pointer-events-none disabled:opacity-30 md:size-9 dark:text-slate-500 dark:hover:text-slate-200";

/**
 * 贴底的播放条，与顶栏上下对称：页面底色，上沿一道进度细线。
 *
 * 本组件不订阅播放进度：进度线与时间码由 useProgress 直接写 DOM，
 * 歌词由 TrackSubline 自己跟进度，整条播放条只在曲目或播放状态变化时重渲染。
 *
 * 窄屏只有一行：歌词代替歌手显示在歌名下，不另起一行——另起的一行无论怎么修饰，
 * 都像挂在满满一排控件下的附件，头重脚轻。为给歌词腾宽度，窄屏不放「上一首」。
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
        {/* 曲目：封面、歌名，下一行是歌手或错误；宽屏有歌词时换成当前句 */}
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
          {/* @container：宽屏歌词按这一栏的宽度缩放字号 */}
          <div className="@container min-w-0 flex-1">
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
              className={cn(SKIP_BUTTON, "max-md:hidden")}
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

          <div className="flex items-center justify-end gap-4 md:pl-0">
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
 * 歌名下的一行：出错时显示错误，有当前句时显示歌词，否则显示歌手。
 * 歌词字号按这一栏的宽度缩放（父级带 @container），窄屏长句会缩小，缩到下限才省略。
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
  const { index, text } = useCurrentLyric(songId);

  if (error) {
    return (
      <p className="mt-0.5 flex items-center gap-1 text-xs text-rose-500">
        <AlertCircle size={12} className="shrink-0" />
        <span className="truncate">{t(`errors.${error}`)}</span>
        {/* 错误代码不截断：用户截图反馈时靠它判断断在哪一环 */}
        <span className="shrink-0 font-mono text-[10px] opacity-60">
          {error}
        </span>
      </p>
    );
  }
  if (text) {
    return (
      <LyricText
        key={index}
        text={text}
        maxPx={13}
        className="mt-0.5 leading-4"
      />
    );
  }
  return (
    <p className="mt-0.5 truncate text-xs tracking-wider text-slate-400 dark:text-slate-500">
      {artist || t("unknownArtist")}
    </p>
  );
}
