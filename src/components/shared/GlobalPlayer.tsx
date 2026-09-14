"use client";

import { usePlayerTime } from "@/hooks/player/usePlayerTime";
import { Link, usePathname } from "@/i18n/navigation";
import { getAudio } from "@/lib/player/audio-engine";
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
  Trash2,
  X,
} from "lucide-react";
import Image from "next/image";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useShallow } from "zustand/react/shallow";

export default function GlobalPlayer() {
  const pathname = usePathname();

  // 细粒度 selector，只订阅各自需要的字段，避免无关状态变化触发整体重渲染
  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const queue = usePlayerStore((s) => s.queue);
  const currentIndex = usePlayerStore((s) => s.currentIndex);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const isLoading = usePlayerStore((s) => s.isLoading);
  const error = usePlayerStore((s) => s.error);
  const playerVisible = usePlayerStore((s) => s.playerVisible);
  const lyricsMap = usePlayerStore((s) => s.lyricsMap);

  // actions 在 Zustand store 中引用稳定，用 useShallow 避免每次返回新对象引用
  const controls = usePlayerStore(
    useShallow((s) => ({
      play: s.play,
      enqueue: s.enqueue,
      toggle: s.toggle,
      pause: s.pause,
      jumpTo: s.jumpTo,
      prev: s.prev,
      next: s.next,
      removeFromQueue: s.removeFromQueue,
      clearQueue: s.clearQueue,
      seek: s.seek,
    })),
  );

  const audioRef = useRef(getAudio());

  // ── 进度条 & 时间码的 DOM refs（高频更新绕开 React 渲染） ─────────────────
  const progressBarRef = useRef<HTMLDivElement>(null);
  const timeCurrentRef = useRef<HTMLSpanElement>(null);
  const seekPreviewRef = useRef<number | null>(null);

  // ── 进度时间：低频 state（歌词行切换）+ 高频 DOM 回调（进度条/时间码） ──
  const { currentTime, duration } = usePlayerTime(
    useCallback((ct: number, dur: number) => {
      // 拖拽预览期间不覆盖 DOM（由 seek preview 逻辑控制）
      if (seekPreviewRef.current !== null) return;
      const pct = dur > 0 ? (ct / dur) * 100 : 0;
      if (progressBarRef.current) {
        progressBarRef.current.style.width = `${pct}%`;
      }
      if (timeCurrentRef.current) {
        timeCurrentRef.current.textContent = formatPlayerTime(ct);
      }
    }, []),
  );

  // ── 进度条拖拽预览 ────────────────────────────────────────────────────────
  const isDraggingRef = useRef(false);
  // isSeeking：seek 已发出但 canplay 事件还未回来，期间继续用 preview 值防止闪回
  const isSeekingRef = useRef(false);

  /**
   * 直接操作 DOM 更新进度条和时间码，完全绕开 React 渲染管线。
   * null 表示清除预览（恢复由 rAF 驱动的正常更新）。
   */
  const applySeekPreviewDOM = useCallback((t: number | null, dur: number) => {
    seekPreviewRef.current = t;
    if (t !== null && dur > 0) {
      const pct = (t / dur) * 100;
      if (progressBarRef.current)
        progressBarRef.current.style.width = `${pct}%`;
      if (timeCurrentRef.current)
        timeCurrentRef.current.textContent = formatPlayerTime(t);
    }
  }, []);

  // ── 播放列表面板 ──────────────────────────────────────────────────────────
  const [showQueue, setShowQueue] = useState(false);
  const queueRef = useRef<HTMLDivElement>(null);
  const queueRefMobile = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!showQueue) return;
    const handler = (e: MouseEvent) => {
      const isClickInsideDesktop = queueRef.current?.contains(e.target as Node);
      const isClickInsideMobile = queueRefMobile.current?.contains(
        e.target as Node,
      );
      if (!isClickInsideDesktop && !isClickInsideMobile) {
        setShowQueue(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showQueue]);

  // ── LRC 歌词 ──────────────────────────────────────────────────────────────
  const lrcLines = useMemo(() => {
    if (!currentTrack) return [];
    const lrc = lyricsMap.get(currentTrack.songId);
    return lrc ? parseLrc(lrc) : [];
  }, [currentTrack, lyricsMap]);

  const currentLrcIndex = useMemo(
    () => getCurrentLrcIndex(lrcLines, currentTime),
    [lrcLines, currentTime],
  );
  const currentLrcText =
    currentLrcIndex >= 0 ? lrcLines[currentLrcIndex]?.text : null;

  // ── 进度条拖拽 ────────────────────────────────────────────────────────────
  const trackRef = useRef<HTMLDivElement>(null);
  const getTimeFromPointer = useCallback(
    (clientX: number) => {
      const el = trackRef.current;
      if (!el || !duration) return null;
      const rect = el.getBoundingClientRect();
      return (
        Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)) * duration
      );
    },
    [duration],
  );
  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!duration) return;
      isDraggingRef.current = true;
      const t = getTimeFromPointer(e.clientX);
      if (t !== null) {
        applySeekPreviewDOM(t, duration);
      }
      try {
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      } catch {
        // Safari may not support setPointerCapture in all contexts
      }
    },
    [duration, getTimeFromPointer, applySeekPreviewDOM],
  );
  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDraggingRef.current || !duration) return;
      const t = getTimeFromPointer(e.clientX);
      if (t !== null) {
        applySeekPreviewDOM(t, duration);
      }
    },
    [duration, getTimeFromPointer, applySeekPreviewDOM],
  );
  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!isDraggingRef.current) return;
      isDraggingRef.current = false;
      const t = getTimeFromPointer(e.clientX);
      if (t !== null) {
        // 先标记 seeking，等 canplay 事件触发后再清除 preview，防止闪回
        isSeekingRef.current = true;
        applySeekPreviewDOM(t, duration);
        controls.seek(t);
      } else {
        applySeekPreviewDOM(null, duration);
      }
    },
    [controls, duration, getTimeFromPointer, applySeekPreviewDOM],
  );
  // Safari Touch Events fallback for seek bar
  const handleSeekTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (!duration) return;
      isDraggingRef.current = true;
      const t = getTimeFromPointer(e.touches[0].clientX);
      if (t !== null) applySeekPreviewDOM(t, duration);
    },
    [duration, getTimeFromPointer, applySeekPreviewDOM],
  );
  const handleSeekTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!isDraggingRef.current || !duration) return;
      const t = getTimeFromPointer(e.touches[0].clientX);
      if (t !== null) applySeekPreviewDOM(t, duration);
    },
    [duration, getTimeFromPointer, applySeekPreviewDOM],
  );
  const handleSeekTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (!isDraggingRef.current) return;
      isDraggingRef.current = false;
      const touch = e.changedTouches[0];
      const t = getTimeFromPointer(touch.clientX);
      if (t !== null) {
        isSeekingRef.current = true;
        applySeekPreviewDOM(t, duration);
        controls.seek(t);
      } else {
        applySeekPreviewDOM(null, duration);
      }
    },
    [controls, duration, getTimeFromPointer, applySeekPreviewDOM],
  );

  // opus seek 是重新请求流，触发 canplay 而非 seeked，preview 在 canplay 后清除
  // 等下一个 rAF 帧（此时 seekBase + audio.currentTime 已稳定）再释放 preview
  // 只清 ref，不操作 DOM——rAF 接管后会用正确的 seekBase + audio.currentTime 写入
  useEffect(() => {
    // getAudio() 是模块级单例，浏览器里同步返回，只有 SSR 才是 null，
    // 而 effect 不会在服务端跑——因此无需轮询等待，直接绑定即可。
    const audio = audioRef.current;
    if (!audio) return;

    const onCanPlay = () => {
      if (isSeekingRef.current) {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            isSeekingRef.current = false;
            // 清掉 preview 锁之前，先用最新的 seekBase + audio.currentTime 刷新一次 DOM
            // 避免 React 重渲染时 JSX style 用旧 currentTime 写入导致闪回
            const a = audioRef.current;
            const { seekBase, trackDuration } = usePlayerStore.getState();
            if (a && trackDuration > 0) {
              const ct = seekBase + a.currentTime;
              const pct = (ct / trackDuration) * 100;
              if (progressBarRef.current)
                progressBarRef.current.style.width = `${pct}%`;
              if (timeCurrentRef.current)
                timeCurrentRef.current.textContent = formatPlayerTime(ct);
            }
            seekPreviewRef.current = null;
          });
        });
      }
    };
    audio.addEventListener("canplay", onCanPlay);
    // 捕获绑定时的那个元素来解绑，而不是在 cleanup 时重新读 ref
    return () => audio.removeEventListener("canplay", onCanPlay);
  }, []);

  // 沉浸式全屏页面不显示播放条 UI（音频继续播放）
  const HIDDEN_PATHS = ["/imagery", "/story"];
  if (HIDDEN_PATHS.some((p) => pathname.startsWith(p))) return null;

  if (!currentTrack) return null;

  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < queue.length - 1;
  const cardHeightClass = currentLrcText
    ? "h-[88px] sm:h-[68px]"
    : "h-[60px] sm:h-[68px]";

  return (
    <>
      {/* 底部播放条 */}
      <div
        className={cn(
          "fixed bottom-4 left-6 right-6 z-50 mx-auto max-w-7xl",
          "bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl",
          "border border-slate-200/60 dark:border-slate-700/50",
          "rounded-2xl shadow-[0_12px_40px_rgba(0,0,0,0.12)] dark:shadow-[0_12px_40px_rgba(0,0,0,0.4)]",
          "transition-all duration-300 ease-in-out select-none",
          playerVisible
            ? "translate-y-0 opacity-100"
            : "translate-y-12 opacity-0 pointer-events-none",
          cardHeightClass,
        )}
      >
        {/* 顶部裁剪进度条容器 (防止其溢出卡片圆角) */}
        <div className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none z-10">
          {/* 进度条 */}
          <div
            ref={trackRef}
            className={cn(
              "absolute top-0 left-0 right-0 cursor-pointer pointer-events-auto touch-none",
              "group/prog",
              !duration && "pointer-events-none opacity-40",
            )}
            style={{ paddingBottom: "12px" }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onTouchStart={handleSeekTouchStart}
            onTouchMove={handleSeekTouchMove}
            onTouchEnd={handleSeekTouchEnd}
          >
            <div className="h-1 bg-slate-200 dark:bg-slate-700/50 rounded-t-2xl overflow-hidden group-hover/prog:h-1.5 transition-all duration-150">
              <div
                ref={progressBarRef}
                className="h-full bg-blue-500 rounded-r-full"
              />
            </div>
          </div>
        </div>

        {/* ── 桌面端布局 (sm以上显示) ────────────────────────────────────────── */}
        <div className="hidden sm:flex items-center justify-between w-full h-full px-4">
          {/* 1. 曲目基本信息与歌词 */}
          <div className="flex items-center gap-3 w-1/3 min-w-0">
            {/* 封面 */}
            <div className="shrink-0 w-11 h-11 rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-800 ring-1 ring-slate-900/5 dark:ring-white/10 shadow-sm relative">
              {currentTrack.coverUrl ? (
                <Image
                  src={currentTrack.coverUrl}
                  alt={currentTrack.title}
                  width={44}
                  height={44}
                  className={cn(
                    "w-full h-full object-cover transition-transform duration-700",
                    isPlaying && "scale-105",
                  )}
                />
              ) : isLoading ? (
                <div className="w-full h-full flex items-center justify-center">
                  <Loader2 size={16} className="animate-spin text-blue-500" />
                </div>
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Music size={16} className="text-slate-400" />
                </div>
              )}
            </div>
            {/* 标题 & 歌手/歌词 堆叠 */}
            <div className="min-w-0 flex-1">
              <Link
                href={`/song/${currentTrack.songId}`}
                className="block text-sm font-bold text-slate-800 dark:text-slate-100 truncate leading-tight hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
              >
                {currentTrack.title}
              </Link>
              <div className="h-4 overflow-hidden mt-0.5">
                {error ? (
                  <div className="flex items-center gap-1">
                    <AlertCircle size={10} className="text-rose-500 shrink-0" />
                    <p className="text-[10px] text-rose-500 truncate">
                      {error}
                    </p>
                  </div>
                ) : currentLrcText ? (
                  <p
                    key={currentLrcIndex}
                    className="text-[11px] font-medium text-blue-500 dark:text-blue-400 truncate animate-in fade-in slide-in-from-bottom-1 duration-300"
                  >
                    {currentLrcText}
                  </p>
                ) : currentTrack.artist ? (
                  <p className="text-[11px] text-slate-400 dark:text-slate-500 truncate">
                    {currentTrack.artist}
                  </p>
                ) : null}
              </div>
            </div>
          </div>

          {/* 2. 播放主控制器 */}
          <div className="flex items-center gap-3 justify-center w-1/3 shrink-0">
            <button
              onClick={controls.prev}
              disabled={!hasPrev}
              aria-label="上一首"
              className={cn(
                "p-2 rounded-full transition-all active:scale-90",
                hasPrev
                  ? "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/80"
                  : "text-slate-300 dark:text-slate-700 cursor-not-allowed",
              )}
            >
              <SkipBack size={16} className="fill-current" />
            </button>
            <button
              onClick={controls.toggle}
              disabled={isLoading}
              aria-label={isPlaying ? "暂停" : "播放"}
              className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center transition-all",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50",
                isLoading
                  ? "bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed"
                  : isPlaying
                    ? "bg-blue-500 text-white shadow-lg shadow-blue-500/25 hover:bg-blue-600 active:scale-95"
                    : "bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-md hover:bg-slate-800 dark:hover:bg-slate-100 active:scale-95",
              )}
            >
              {isLoading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : isPlaying ? (
                <Pause size={16} className="fill-current" />
              ) : (
                <Play size={16} className="fill-current" />
              )}
            </button>
            <button
              onClick={controls.next}
              disabled={!hasNext}
              aria-label="下一首"
              className={cn(
                "p-2 rounded-full transition-all active:scale-90",
                hasNext
                  ? "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/80"
                  : "text-slate-300 dark:text-slate-700 cursor-not-allowed",
              )}
            >
              <SkipForward size={16} className="fill-current" />
            </button>
          </div>

          {/* 3. 工具栏 (时间、播放列表、音量) */}
          <div className="flex items-center gap-3 justify-end w-1/3 shrink-0">
            {/* 时间码 */}
            <div className="flex items-center gap-1 text-[10px] font-mono text-slate-400 dark:text-slate-500">
              <span ref={timeCurrentRef}>{formatPlayerTime(currentTime)}</span>
              <span className="opacity-40">/</span>
              <span>{formatPlayerTime(duration)}</span>
            </div>

            {/* 播放队列容器 (带 Ref) */}
            <div className="relative shrink-0" ref={queueRef}>
              {/* 列表弹出面板 (Desktop Popover) */}
              <div
                className={cn(
                  "absolute bottom-full right-0 mb-3 rounded-2xl w-[380px] overflow-hidden",
                  "bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl",
                  "border border-slate-200/60 dark:border-slate-700/50",
                  "shadow-[0_20px_50px_rgba(0,0,0,0.15)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.5)]",
                  "transition-all duration-200 origin-bottom-right",
                  "animate-in fade-in slide-in-from-bottom-2 duration-200",
                  "flex flex-col select-none z-50",
                  showQueue
                    ? "opacity-100 scale-100 pointer-events-auto translate-y-0"
                    : "opacity-0 scale-95 pointer-events-none translate-y-2",
                )}
              >
                {/* 顶栏头部 */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800/60 bg-slate-50/40 dark:bg-slate-950/20">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                      播放队列
                    </span>
                    <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-[10px] font-bold font-mono bg-blue-50 dark:bg-blue-950/30 text-blue-500 dark:text-blue-400 border border-blue-100/30 dark:border-blue-800/10">
                      {queue.length}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => controls.clearQueue()}
                      className="flex items-center gap-1 text-[11px] font-semibold text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 px-2 py-1 rounded-lg transition-all active:scale-95"
                    >
                      <Trash2 size={12} />
                      清空
                    </button>
                    <button
                      onClick={() => setShowQueue(false)}
                      className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all active:scale-90"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>

                {/* 歌曲列表 */}
                <div className="max-h-[320px] overflow-y-auto overscroll-contain no-scrollbar">
                  {queue.map((track, i) => (
                    <div
                      key={track.songId}
                      onClick={() => controls.jumpTo(i)}
                      className={cn(
                        "flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-all group/item select-none border-b border-slate-50/50 dark:border-slate-800/5 last:border-b-0",
                        i === currentIndex
                          ? "bg-blue-500/5 dark:bg-blue-500/10"
                          : "hover:bg-slate-50/60 dark:hover:bg-slate-800/30",
                      )}
                    >
                      {/* 封面与播放指示器 */}
                      <div className="shrink-0 w-8 h-8 rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-800 relative shadow-xs">
                        {track.coverUrl ? (
                          <Image
                            src={track.coverUrl}
                            alt={track.title}
                            width={32}
                            height={32}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Music size={11} className="text-slate-400" />
                          </div>
                        )}
                        {i === currentIndex && (
                          <div className="absolute inset-0 bg-black/40 dark:bg-black/55 flex items-center justify-center">
                            {isPlaying ? (
                              <span className="flex gap-0.5 items-end h-2.5">
                                {[60, 100, 40].map((h, j) => (
                                  <span
                                    key={j}
                                    className="w-0.5 bg-blue-400 rounded-full"
                                    style={{
                                      height: `${h}%`,
                                      animation: `gpBounce 0.8s ease-in-out ${j * 0.2}s infinite`,
                                    }}
                                  />
                                ))}
                              </span>
                            ) : (
                              <Music size={10} className="text-white" />
                            )}
                          </div>
                        )}
                      </div>

                      {/* 歌曲名与歌手 */}
                      <div className="flex-1 min-w-0">
                        <p
                          className={cn(
                            "text-xs truncate",
                            i === currentIndex
                              ? "font-bold text-blue-600 dark:text-blue-400"
                              : "font-medium text-slate-700 dark:text-slate-200 group-hover/item:text-slate-900 dark:group-hover/item:text-white transition-colors",
                          )}
                        >
                          {track.title}
                        </p>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate mt-0.5 font-medium group-hover/item:text-slate-500 dark:group-hover/item:text-slate-400 transition-colors">
                          {track.artist || "未知歌手"}
                        </p>
                      </div>

                      {/* 删除单曲按钮 */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          controls.removeFromQueue(i);
                        }}
                        className="shrink-0 p-1.5 rounded-lg text-slate-300 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-all opacity-0 group-hover/item:opacity-100 active:scale-90"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* 列表按钮 */}
              <button
                onClick={() => setShowQueue((v: boolean) => !v)}
                aria-label="播放列表"
                className={cn(
                  "p-2 rounded-full transition-colors",
                  "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300",
                  "hover:bg-slate-100 dark:hover:bg-slate-800/80",
                  showQueue &&
                    "bg-blue-50 dark:bg-blue-500/10 text-blue-500 dark:text-blue-400",
                )}
              >
                <svg
                  width="15"
                  height="15"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="8" y1="6" x2="21" y2="6" />
                  <line x1="8" y1="12" x2="21" y2="12" />
                  <line x1="8" y1="18" x2="21" y2="18" />
                  <line x1="3" y1="6" x2="3.01" y2="6" />
                  <line x1="3" y1="12" x2="3.01" y2="12" />
                  <line x1="3" y1="18" x2="3.01" y2="18" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* ── 移动端布局 (sm以下显示，自适应高度) ─────────────────────────────── */}
        <div className="flex sm:hidden flex-col justify-center w-full h-full px-3.5 py-2">
          {/* 第一排：曲目封面、曲目信息与基础操作按钮 */}
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              {/* 封面 */}
              <div className="shrink-0 w-10 h-10 rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-800 ring-1 ring-slate-900/5 dark:ring-white/10 shadow-sm relative">
                {currentTrack.coverUrl ? (
                  <Image
                    src={currentTrack.coverUrl}
                    alt={currentTrack.title}
                    width={40}
                    height={40}
                    className="w-full h-full object-cover"
                  />
                ) : isLoading ? (
                  <div className="w-full h-full flex items-center justify-center">
                    <Loader2 size={14} className="animate-spin text-blue-500" />
                  </div>
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Music size={14} className="text-slate-400" />
                  </div>
                )}
              </div>

              {/* 歌曲名 & 歌手 */}
              <div className="min-w-0 flex-1">
                <div className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate leading-tight">
                  {currentTrack.title}
                </div>
                {!currentLrcText && currentTrack.artist && (
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate mt-0.5">
                    {currentTrack.artist}
                  </p>
                )}
                {error && (
                  <div className="flex items-center gap-1 mt-0.5">
                    <AlertCircle size={9} className="text-rose-500 shrink-0" />
                    <p className="text-[9px] text-rose-500 truncate">{error}</p>
                  </div>
                )}
              </div>
            </div>

            {/* 紧凑操作栏 */}
            <div className="flex items-center gap-1 shrink-0 ml-2">
              <button
                onClick={controls.prev}
                disabled={!hasPrev}
                aria-label="上一首"
                className={cn(
                  "p-1.5 rounded-full transition-all text-slate-600 dark:text-slate-300 active:scale-75",
                  !hasPrev &&
                    "text-slate-300 dark:text-slate-700 opacity-40 pointer-events-none",
                )}
              >
                <SkipBack size={14} className="fill-current" />
              </button>

              <button
                onClick={controls.toggle}
                disabled={isLoading}
                aria-label={isPlaying ? "暂停" : "播放"}
                className={cn(
                  "w-8.5 h-8.5 rounded-full flex items-center justify-center transition-all bg-blue-500 text-white shadow-md active:scale-90",
                  isLoading && "bg-slate-100 dark:bg-slate-800 text-slate-400",
                )}
              >
                {isLoading ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : isPlaying ? (
                  <Pause size={13} className="fill-current" />
                ) : (
                  <Play size={13} className="fill-current" />
                )}
              </button>

              <button
                onClick={controls.next}
                disabled={!hasNext}
                aria-label="下一首"
                className={cn(
                  "p-1.5 rounded-full transition-all text-slate-600 dark:text-slate-300 active:scale-75",
                  !hasNext &&
                    "text-slate-300 dark:text-slate-700 opacity-40 pointer-events-none",
                )}
              >
                <SkipForward size={14} className="fill-current" />
              </button>

              {/* 播放队列容器 (移动端版, 带 Ref) */}
              <div className="relative shrink-0" ref={queueRefMobile}>
                {/* 列表弹出面板 (Mobile Popover) */}
                <div
                  className={cn(
                    "fixed left-6 right-6 z-50 rounded-2xl overflow-hidden",
                    currentLrcText ? "bottom-[112px]" : "bottom-[84px]",
                    "bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl",
                    "border border-slate-200/60 dark:border-slate-700/50",
                    "shadow-[0_20px_50px_rgba(0,0,0,0.15)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.5)]",
                    "transition-all duration-200 origin-bottom",
                    "animate-in fade-in slide-in-from-bottom-2 duration-200",
                    "flex flex-col select-none",
                    showQueue
                      ? "opacity-100 scale-100 pointer-events-auto translate-y-0"
                      : "opacity-0 scale-95 pointer-events-none translate-y-2",
                  )}
                >
                  {/* 顶栏头部 */}
                  <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800/60 bg-slate-50/40 dark:bg-slate-950/20">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                        播放队列
                      </span>
                      <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-[10px] font-bold font-mono bg-blue-50 dark:bg-blue-950/30 text-blue-500 dark:text-blue-400 border border-blue-100/30 dark:border-blue-800/10">
                        {queue.length}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => controls.clearQueue()}
                        className="flex items-center gap-1 text-[11px] font-semibold text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 px-2 py-1 rounded-lg transition-all active:scale-95"
                      >
                        <Trash2 size={12} />
                        清空
                      </button>
                      <button
                        onClick={() => setShowQueue(false)}
                        className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all active:scale-90"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </div>

                  {/* 歌曲列表 */}
                  <div className="max-h-[260px] overflow-y-auto overscroll-contain no-scrollbar">
                    {queue.map((track, i) => (
                      <div
                        key={track.songId}
                        onClick={() => controls.jumpTo(i)}
                        className={cn(
                          "flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-all active:bg-slate-50/50 dark:active:bg-slate-800/20 select-none border-b border-slate-50/50 dark:border-slate-800/5 last:border-b-0",
                          i === currentIndex
                            ? "bg-blue-500/5 dark:bg-blue-500/10"
                            : "",
                        )}
                      >
                        {/* 封面与播放指示器 */}
                        <div className="shrink-0 w-8 h-8 rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-800 relative shadow-xs">
                          {track.coverUrl ? (
                            <Image
                              src={track.coverUrl}
                              alt={track.title}
                              width={32}
                              height={32}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Music size={11} className="text-slate-400" />
                            </div>
                          )}
                          {i === currentIndex && (
                            <div className="absolute inset-0 bg-black/40 dark:bg-black/55 flex items-center justify-center">
                              {isPlaying ? (
                                <span className="flex gap-0.5 items-end h-2.5">
                                  {[60, 100, 40].map((h, j) => (
                                    <span
                                      key={j}
                                      className="w-0.5 bg-blue-400 rounded-full"
                                      style={{
                                        height: `${h}%`,
                                        animation: `gpBounce 0.8s ease-in-out ${j * 0.2}s infinite`,
                                      }}
                                    />
                                  ))}
                                </span>
                              ) : (
                                <Music size={10} className="text-white" />
                              )}
                            </div>
                          )}
                        </div>

                        {/* 歌曲名与歌手 */}
                        <div className="flex-1 min-w-0">
                          <p
                            className={cn(
                              "text-xs truncate",
                              i === currentIndex
                                ? "font-bold text-blue-600 dark:text-blue-400"
                                : "font-medium text-slate-700 dark:text-slate-200",
                            )}
                          >
                            {track.title}
                          </p>
                          <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate mt-0.5 font-medium">
                            {track.artist || "未知歌手"}
                          </p>
                        </div>

                        {/* 删除单曲按钮 - 移动端默认不透明度 80% 以保持可见和便于点按 */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            controls.removeFromQueue(i);
                          }}
                          className="shrink-0 p-2 rounded-lg text-slate-400 dark:text-slate-500 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-all active:scale-90 opacity-80"
                        >
                          <X size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 列表按钮 */}
                <button
                  onClick={() => setShowQueue((v: boolean) => !v)}
                  aria-label="播放列表"
                  className={cn(
                    "p-1.5 rounded-full text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors",
                    showQueue && "text-blue-500 dark:text-blue-400",
                  )}
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <line x1="8" y1="6" x2="21" y2="6" />
                    <line x1="8" y1="12" x2="21" y2="12" />
                    <line x1="8" y1="18" x2="21" y2="18" />
                    <line x1="3" y1="6" x2="3.01" y2="6" />
                    <line x1="3" y1="12" x2="3.01" y2="12" />
                    <line x1="3" y1="18" x2="3.01" y2="18" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          {/* 第二排：移动端专属歌词舱（仅在有歌词时动态滑出，提供完整宽度空间） */}
          {currentLrcText && (
            <div className="w-full mt-2 h-4.5 overflow-hidden relative flex items-center justify-center select-none bg-blue-50/40 dark:bg-blue-950/20 rounded-lg px-2 border border-blue-100/10 dark:border-blue-900/10">
              <p
                key={currentLrcIndex}
                className="text-[10px] font-semibold text-blue-500 dark:text-blue-400 truncate text-center w-full animate-in fade-in slide-in-from-bottom-1 duration-300"
              >
                {currentLrcText}
              </p>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes gpBounce {
          0%, 100% { transform: scaleY(0.4); }
          50% { transform: scaleY(1); }
        }
      `}</style>
    </>
  );
}
