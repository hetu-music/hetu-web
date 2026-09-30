"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getAudio } from "@/lib/player/audio-engine";
import { usePlayerStore } from "@/store/player-store";

type Tick = (currentTime: number, duration: number) => void;

/**
 * usePlaybackTick
 *
 * 播放进度回调，不产生 React state，供调用方直接写 DOM（进度条、时间码）。
 *
 * 跟随 audio 的 timeupdate（约每秒 4 次）而不是 rAF：一首三分钟的歌，
 * 进度条约半秒才走 1px，逐帧（高刷屏上每秒 120 次）重绘几乎全是白算，
 * 手机上会持续占着 GPU 发热。
 *
 * 返回的 refresh 用于元素晚于本 hook 挂载时补一次（暂停时不会有 timeupdate）。
 */
export function usePlaybackTick(onTick: Tick): () => void {
  const onTickRef = useRef(onTick);
  useEffect(() => {
    onTickRef.current = onTick;
  });

  const refresh = useCallback(() => {
    const audio = getAudio();
    if (!audio) return;
    const { seekBase, trackDuration, isLoading } = usePlayerStore.getState();
    // 加载中（换曲或 opus 重新取流）audio 里还是旧流或已归零，位置不可信，
    // 此时 seekBase 就是新流的起点：换曲为 0，跳转为目标秒数
    const ct = isLoading ? seekBase : seekBase + audio.currentTime;
    onTickRef.current(ct, trackDuration);
  }, []);

  useEffect(() => {
    const audio = getAudio();
    if (!audio) return;

    const events = ["timeupdate", "seeked", "loadedmetadata", "pause"];
    events.forEach((e) => audio.addEventListener(e, refresh));
    // 新流就绪（isLoading 落回 false）和 seekBase / trackDuration 更新时
    // 未必伴随 audio 事件，直接跟 store
    const unsubscribe = usePlayerStore.subscribe((s, prev) => {
      if (
        s.isLoading !== prev.isLoading ||
        s.seekBase !== prev.seekBase ||
        s.trackDuration !== prev.trackDuration
      )
        refresh();
    });
    refresh();

    return () => {
      events.forEach((e) => audio.removeEventListener(e, refresh));
      unsubscribe();
    };
  }, [refresh]);

  return refresh;
}

/**
 * usePlayerTime
 *
 * 整秒粒度的 React state，用于歌词行切换这类低频渲染。
 * 高频的进度条、时间码请用 usePlaybackTick 直接写 DOM。
 */
export function usePlayerTime(): { currentTime: number; duration: number } {
  const trackDuration = usePlayerStore((s) => s.trackDuration);
  const [currentTime, setCurrentTime] = useState(0);
  const lastSecRef = useRef(-1);

  usePlaybackTick(
    useCallback((ct: number) => {
      const sec = Math.floor(ct);
      if (sec === lastSecRef.current) return;
      lastSecRef.current = sec;
      setCurrentTime(ct);
    }, []),
  );

  return { currentTime, duration: trackDuration };
}
