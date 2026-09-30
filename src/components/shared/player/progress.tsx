"use client";

import { usePlaybackTick } from "@/hooks/player/usePlayerTime";
import { getAudio } from "@/lib/player/audio-engine";
import { formatPlayerTime } from "@/lib/player/player-utils";
import { cn } from "@/lib/utils/utils";
import { usePlayerStore } from "@/store/player-store";
import React, { useCallback, useEffect, useRef } from "react";

/** 键盘左右键一次跳多少秒 */
const KEY_STEP = 10;

/** 进度线悬停变粗的过渡，与下面按帧滑动的过渡写在同一条 transition 里 */
const HOVER_TRANSITION = "height 200ms, top 200ms";

/** 两次 timeupdate 间前进超过这么多秒就不算「正常走」，直接跳过去 */
const MAX_GLIDE_STEP = 1.5;

const reducedMotion = () =>
  typeof matchMedia === "function" &&
  matchMedia("(prefers-reduced-motion: reduce)").matches;

export type Progress = ReturnType<typeof useProgress>;

/**
 * 进度条与时间码：直接写 DOM，不经过 React 渲染。
 *
 * opus 流不能原生跳转，跳转是带 timeOffset 重新取流，新流就绪前 audio 里还是旧位置。
 * 所以拖动时和跳转后到新流就绪前，都显示「预览位置」而不是实际位置，免得进度条闪回。
 *
 * timeupdate 约 4 次/秒，宽屏上每次要跳好几个像素。正常往前走时给进度线一段匀速过渡，
 * 时长取两次更新的实际间隔，在两次更新之间滑过去：过渡由合成器跑，不需要每帧执行 JS。
 * 拖动、跳转、换曲时直接跳到位。
 */
export function useProgress() {
  const seek = usePlayerStore((s) => s.seek);

  const sliderRef = useRef<HTMLDivElement>(null);
  const fillRef = useRef<HTMLDivElement>(null);
  const timeRef = useRef<HTMLSpanElement>(null);
  const previewRef = useRef<number | null>(null);
  const draggingRef = useRef(false);
  /** 上一次画的位置与时刻，用来判断这次是不是正常往前走、该滑多久 */
  const lastPaintRef = useRef({ t: 0, at: 0 });

  const paint = useCallback((t: number, dur: number, glide = false) => {
    const ratio = dur > 0 ? Math.min(1, Math.max(0, t / dur)) : 0;
    const now = performance.now();
    const last = lastPaintRef.current;
    const step = t - last.t;
    const interval = now - last.at;
    lastPaintRef.current = { t, at: now };
    const fill = fillRef.current;
    if (fill) {
      const smooth =
        glide &&
        step > 0 &&
        step < MAX_GLIDE_STEP &&
        interval < MAX_GLIDE_STEP * 1000 &&
        usePlayerStore.getState().playerVisible &&
        !reducedMotion();
      fill.style.transition = smooth
        ? `transform ${Math.round(interval)}ms linear, ${HOVER_TRANSITION}`
        : HOVER_TRANSITION;
      // 用 transform 而不是 width：只需合成，不触发重排和重绘
      fill.style.transform = `scaleX(${ratio})`;
    }
    const text = formatPlayerTime(t);
    if (timeRef.current && timeRef.current.textContent !== text) {
      timeRef.current.textContent = text;
      sliderRef.current?.setAttribute("aria-valuenow", String(Math.floor(t)));
      sliderRef.current?.setAttribute("aria-valuetext", text);
    }
  }, []);

  const refresh = usePlaybackTick(
    useCallback(
      (ct: number, dur: number) => {
        if (previewRef.current === null) paint(ct, dur, true);
      },
      [paint],
    ),
  );

  // 跳转发出后交还给实际位置：转码流在新流就绪或取流失败（isLoading 落回 false）时，
  // 原文件在浏览器原生跳转完成（seeked）时
  useEffect(() => {
    const release = () => {
      if (draggingRef.current || previewRef.current === null) return;
      previewRef.current = null;
      refresh();
    };
    const unsubscribe = usePlayerStore.subscribe((s, prev) => {
      if (prev.isLoading && !s.isLoading) release();
    });
    const audio = getAudio();
    audio?.addEventListener("seeked", release);
    return () => {
      unsubscribe();
      audio?.removeEventListener("seeked", release);
    };
  }, [refresh]);

  const preview = useCallback(
    (t: number) => {
      previewRef.current = t;
      paint(t, usePlayerStore.getState().trackDuration);
    },
    [paint],
  );

  const timeAt = useCallback((clientX: number) => {
    const el = sliderRef.current;
    const dur = usePlayerStore.getState().trackDuration;
    if (!el || !dur) return null;
    const rect = el.getBoundingClientRect();
    return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)) * dur;
  }, []);

  const start = useCallback(
    (clientX: number) => {
      const t = timeAt(clientX);
      if (t === null) return;
      draggingRef.current = true;
      preview(t);
    },
    [timeAt, preview],
  );
  const move = useCallback(
    (clientX: number) => {
      if (!draggingRef.current) return;
      const t = timeAt(clientX);
      if (t !== null) preview(t);
    },
    [timeAt, preview],
  );
  const end = useCallback(
    (clientX: number) => {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      const t = timeAt(clientX);
      if (t === null) {
        previewRef.current = null;
        refresh();
        return;
      }
      preview(t);
      seek(t);
    },
    [timeAt, preview, refresh, seek],
  );

  const handlers = {
    onPointerDown: (e: React.PointerEvent) => {
      start(e.clientX);
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // Safari 某些情况下不支持 setPointerCapture
      }
    },
    onPointerMove: (e: React.PointerEvent) => move(e.clientX),
    onPointerUp: (e: React.PointerEvent) => end(e.clientX),
    onPointerCancel: (e: React.PointerEvent) => end(e.clientX),
    // Safari 的触摸兜底：与 pointer 事件重复触发时，draggingRef 保证只处理一次
    onTouchStart: (e: React.TouchEvent) => start(e.touches[0].clientX),
    onTouchMove: (e: React.TouchEvent) => move(e.touches[0].clientX),
    onTouchEnd: (e: React.TouchEvent) => end(e.changedTouches[0].clientX),
    onKeyDown: (e: React.KeyboardEvent) => {
      const step =
        e.key === "ArrowRight"
          ? KEY_STEP
          : e.key === "ArrowLeft"
            ? -KEY_STEP
            : 0;
      // 每次跳转都要重新取流，按住不放时不连发
      if (!step || e.repeat) return;
      e.preventDefault();
      const { seekBase, trackDuration } = usePlayerStore.getState();
      const current =
        previewRef.current ?? seekBase + (getAudio()?.currentTime ?? 0);
      const t = Math.max(0, Math.min(trackDuration, current + step));
      preview(t);
      seek(t);
    },
  };

  return { sliderRef, fillRef, timeRef, handlers };
}

/**
 * 播放条上沿的进度线：一道细线，已播部分用强调色。
 * 可点按区域比线高得多（上下各 8px），手指也好拖。
 */
export function ProgressLine({
  progress,
  label,
}: {
  progress: Progress;
  label: string;
}) {
  const { sliderRef, fillRef, handlers } = progress;
  const duration = usePlayerStore((s) => s.trackDuration);
  return (
    <div
      ref={sliderRef}
      role="slider"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={Math.floor(duration)}
      // 之后由 useProgress 直接改写，这里只给初值
      aria-valuenow={0}
      tabIndex={duration ? 0 : -1}
      className={cn(
        "group absolute inset-x-0 -top-2 h-4 cursor-pointer touch-none outline-none",
        !duration && "pointer-events-none",
      )}
      {...handlers}
    >
      <div className="absolute inset-x-0 top-2 h-px bg-slate-200 dark:bg-slate-800" />
      <div
        ref={fillRef}
        className="absolute inset-x-0 top-1.75 h-0.5 origin-left bg-(--tone) group-hover:top-1.5 group-hover:h-1 group-focus-visible:top-1.5 group-focus-visible:h-1"
        style={{ transform: "scaleX(0)", transition: HOVER_TRANSITION }}
      />
    </div>
  );
}
