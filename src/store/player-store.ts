"use client";

import { create } from "zustand";
import { getAudio } from "@/lib/player/audio-engine";
import {
  createRetryBudget,
  createStallWatchdog,
} from "@/lib/player/stall-watchdog";

// ─── 类型 ─────────────────────────────────────────────────────────────────────

export interface PlayerTrack {
  songId: number;
  title: string;
  artist?: string | null;
  coverUrl?: string | null;
}

/**
 * 播放错误的种类。store 里只存代码，文案由组件按 common.player.errors 翻译
 */
export type PlayerErrorCode =
  | "blocked"
  | "forbidden"
  | "notFound"
  | "unavailable"
  | "rateLimited"
  | "streamFailed"
  | "network"
  | "decode"
  | "unsupported"
  | "failed";

export interface PlayerState {
  currentTrack: PlayerTrack | null;
  queue: PlayerTrack[];
  currentIndex: number;
  isPlaying: boolean;
  isLoading: boolean;
  volume: number;
  isMuted: boolean;
  error: PlayerErrorCode | null;
  playerVisible: boolean;
  lyricsMap: Map<number, string>;
  /** 从 Navidrome getSong 获取的准确时长（秒），opus 流无法从 audio.duration 读取 */
  trackDuration: number;
  /** seek 后的时间基准：显示时间 = seekBase + audio.currentTime */
  seekBase: number;
}

export interface PlayerActions {
  play: (track: PlayerTrack) => void;
  enqueue: (track: PlayerTrack) => void;
  toggle: () => void;
  pause: () => void;
  jumpTo: (index: number) => void;
  prev: () => void;
  next: () => void;
  removeFromQueue: (index: number) => void;
  clearQueue: () => void;
  seek: (time: number) => void;
  setVolume: (vol: number) => void;
  toggleMute: () => void;
  setPlayerVisible: (v: boolean) => void;
  /** 内部：audio 事件回调用 */
  _setPlaying: (v: boolean) => void;
  _setLoading: (v: boolean) => void;
  _setError: (code: PlayerErrorCode | null) => void;
  _setVolumeState: (volume: number, isMuted: boolean) => void;
  _onEnded: () => void;
  _addLyrics: (songId: number, lyrics: string) => void;
  /**
   * 内部：stream-url fetch。timeOffset 是起播位置：转码流由服务端从这里开始转，
   * 原文件则在元数据就绪后由浏览器跳过去
   */
  _fetchAndSetSrc: (
    songId: number,
    isRetry?: boolean,
    timeOffset?: number,
  ) => void;
}

// ─── 内部可变 refs（不放 store，避免触发订阅） ────────────────────────────────

/** 竞态锁：当前正在加载的 songId */
let _loadingTrackId: number | null = null;
/** 重试计数 */
let _retryCount = 0;
/** 播放意图：canplay 时是否自动播放 */
let _shouldPlayAfterLoad = false;
/** seek 中：_fetchAndSetSrc 内部 audio.pause() 触发的 pause 事件应被忽略 */
let _isSeeking = false;
/** seek 进行中：暂停 MediaSession position 更新，避免系统控件收到非法值 */
let _isSeekingMediaSession = false;
/** seek 目标时间，seek 进行中用于立即更新系统控件显示位置 */
let _seekTargetTime: number | null = null;
/** MediaSession seekto debounce timer */
let _seekToTimer: ReturnType<typeof setTimeout> | null = null;
/**
 * 当前音源能否原生跳转：原文件（mp3 等有损源）带长度、支持分段请求，
 * 跳转直接改 audio.currentTime；转码的 opus 流不行，要带 timeOffset 重新取流。
 * 由 stream-url 返回的 seekable 决定，每次取新地址前先复位
 */
let _nativeSeek = false;
/** fetch 请求版本号，每次 _fetchAndSetSrc 递增，回调里不匹配则丢弃（防并发竞态） */
let _fetchGeneration = 0;

// ─── 工具 ─────────────────────────────────────────────────────────────────────

/**
 * 原文件跳到指定位置。元数据还没到时先等 loadedmetadata：
 * 这之前改 currentTime，有的浏览器（Safari）会直接忽略
 */
function nativeSeekTo(audio: HTMLAudioElement, time: number) {
  // 1 即 HTMLMediaElement.HAVE_METADATA；不引用全局常量，node 下的单测也能跑
  if (audio.readyState >= 1) {
    audio.currentTime = time;
    return;
  }
  audio.addEventListener(
    "loadedmetadata",
    () => {
      audio.currentTime = time;
    },
    { once: true },
  );
}

/** 取播放地址失败，带上给用户看的错误种类 */
class StreamUrlError extends Error {
  code: PlayerErrorCode;
  constructor(code: PlayerErrorCode) {
    super(code);
    this.code = code;
  }
}

function streamUrlErrorCode(status: number): PlayerErrorCode {
  if (status === 401 || status === 403) return "forbidden";
  if (status === 404) return "notFound";
  if (status === 429) return "rateLimited";
  if (status === 503) return "unavailable";
  return "streamFailed";
}

function safePlay() {
  const audio = getAudio();
  if (!audio) return;
  const promise = audio.play();
  if (promise !== undefined) {
    promise.catch((err: Error) => {
      if (err.name !== "AbortError") {
        console.warn("[Player] play() failed:", err.message);
        if (err.name === "NotAllowedError") {
          usePlayerStore.getState()._setError("blocked");
          usePlayerStore.getState()._setPlaying(false);
        }
      }
    });
  }
}

function syncUnlockAudio() {
  const audio = getAudio();
  if (!audio) return;
  const promise = audio.play();
  if (promise !== undefined) {
    promise
      .then(() => audio.pause())
      .catch((_err: unknown) => {
        /* iOS unlock: ignore */
      });
  }
}

function syncMediaSessionPosition() {
  if (typeof navigator === "undefined" || !("mediaSession" in navigator))
    return;
  const { trackDuration, seekBase } = usePlayerStore.getState();
  const audio = getAudio();
  if (!audio || !trackDuration) return;
  // seek 进行中用目标时间，避免 audio.currentTime 归零时给系统控件传错误值
  const position =
    _isSeekingMediaSession && _seekTargetTime !== null
      ? _seekTargetTime
      : Math.min(seekBase + audio.currentTime, trackDuration);
  try {
    navigator.mediaSession.setPositionState({
      duration: trackDuration,
      playbackRate: audio.playbackRate,
      position: Math.max(0, Math.min(position, trackDuration)),
    });
  } catch {
    /* ignore */
  }
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const usePlayerStore = create<PlayerState & PlayerActions>(
  (set, get) => ({
    // ── 初始状态 ──────────────────────────────────────────────────────────────
    currentTrack: null,
    queue: [],
    currentIndex: -1,
    isPlaying: false,
    isLoading: false,
    volume: 0.8,
    isMuted: false,
    error: null,
    playerVisible: false,
    lyricsMap: new Map(),
    trackDuration: 0,
    seekBase: 0,

    // ── 内部 setters ──────────────────────────────────────────────────────────
    _setPlaying: (v) => set({ isPlaying: v }),
    _setLoading: (v) => set({ isLoading: v }),
    _setError: (code) => set({ error: code }),
    _setVolumeState: (volume, isMuted) => set({ volume, isMuted }),
    _addLyrics: (songId, lyrics) =>
      set((s) => {
        if (s.lyricsMap.has(songId)) return s;
        const next = new Map(s.lyricsMap);
        next.set(songId, lyrics);
        return { lyricsMap: next };
      }),

    _onEnded: () => {
      const s = get();
      const nextIndex = s.currentIndex + 1;
      if (nextIndex < s.queue.length) {
        const nextTrack = s.queue[nextIndex];
        _shouldPlayAfterLoad = true;
        _loadingTrackId = nextTrack.songId;
        set({
          currentIndex: nextIndex,
          currentTrack: nextTrack,
          isPlaying: true,
          isLoading: true,
          seekBase: 0,
        });
        get()._fetchAndSetSrc(nextTrack.songId);
      } else {
        _shouldPlayAfterLoad = false;
        set({ isPlaying: false });
      }
    },

    // ── stream-url fetch ──────────────────────────────────────────────────────
    _fetchAndSetSrc: (songId, isRetry = false, timeOffset = 0) => {
      const audio = getAudio();
      if (!audio) return;

      if (!isRetry) {
        _retryCount = 0;
        _loadingTrackId = songId;
      }

      // 每次新请求递增版本号，回调里不匹配则说明已被更新的请求取代，直接丢弃
      const generation = ++_fetchGeneration;

      set({ isLoading: true, error: null });
      _isSeekingMediaSession = true;
      // 新地址回来之前不知道是哪种音源，期间的跳转一律按重新取流处理
      _nativeSeek = false;

      const qs = new URLSearchParams({ songId: String(songId) });
      if (timeOffset > 0) qs.set("timeOffset", String(Math.floor(timeOffset)));

      fetch(`/api/navidrome/stream-url?${qs}`)
        .then((r) => {
          if (!r.ok) throw new StreamUrlError(streamUrlErrorCode(r.status));
          return r.json() as Promise<{
            url?: string;
            duration?: number;
            seekable?: boolean;
          }>;
        })
        .then(({ url, duration, seekable }) => {
          // 版本号不匹配说明已有更新的请求，丢弃此结果
          if (generation !== _fetchGeneration) return;
          if (songId !== _loadingTrackId) return;
          if (!url) throw new StreamUrlError("streamFailed");

          _isSeeking = true;
          audio.pause();
          _isSeeking = false;
          audio.src = url;
          audio.load();
          _nativeSeek = seekable === true;
          // 原文件总是从头开始发，起播位置由浏览器自己跳过去
          if (_nativeSeek && timeOffset > 0) nativeSeekTo(audio, timeOffset);

          // 更新 seekBase 和 trackDuration，isLoading 由 loadstart/canplay 事件管理，不在这里改。
          // 原文件的 currentTime 就是整首里的位置，seekBase 恒为 0
          set({
            error: null,
            seekBase: _nativeSeek ? 0 : timeOffset,
            ...(duration != null && duration > 0
              ? { trackDuration: duration }
              : {}),
          });
        })
        .catch((err: unknown) => {
          // 版本号不匹配说明已被取代，静默丢弃
          if (generation !== _fetchGeneration) return;
          if (songId !== _loadingTrackId) return;
          // fetch 本身 reject 是断网或请求被拦（TypeError），其余按接口返回归类
          const code: PlayerErrorCode =
            err instanceof StreamUrlError
              ? err.code
              : err instanceof TypeError
                ? "network"
                : "streamFailed";
          _shouldPlayAfterLoad = false;
          _isSeekingMediaSession = false;
          _seekTargetTime = null;
          set({ isLoading: false, isPlaying: false, error: code });
        });
    },

    // ── setPlayerVisible ──────────────────────────────────────────────────────
    setPlayerVisible: (v) => set({ playerVisible: v }),

    // ── Controls ──────────────────────────────────────────────────────────────
    play: (track) => {
      set({ playerVisible: true });
      syncUnlockAudio();
      _shouldPlayAfterLoad = true;

      const s = get();
      const existingIndex = s.queue.findIndex((t) => t.songId === track.songId);

      if (existingIndex !== -1) {
        if (s.currentTrack?.songId === track.songId) {
          safePlay();
          set({ isPlaying: true });
          return;
        }
        _loadingTrackId = s.queue[existingIndex].songId;
        set({
          currentIndex: existingIndex,
          currentTrack: s.queue[existingIndex],
          isPlaying: true,
          isLoading: true,
          seekBase: 0,
          trackDuration: 0,
        });
        get()._fetchAndSetSrc(s.queue[existingIndex].songId);
        return;
      }

      const newQueue = [...s.queue, track];
      const newIndex = newQueue.length - 1;
      _loadingTrackId = track.songId;
      set({
        queue: newQueue,
        currentIndex: newIndex,
        currentTrack: track,
        isPlaying: true,
        isLoading: true,
        seekBase: 0,
        trackDuration: 0,
      });
      get()._fetchAndSetSrc(track.songId);
    },

    enqueue: (track) => {
      set((s) => {
        if (s.queue.some((t) => t.songId === track.songId)) return s;
        return { queue: [...s.queue, track] };
      });
    },

    toggle: () => {
      const audio = getAudio();
      if (!audio) return;
      if (audio.paused) {
        _shouldPlayAfterLoad = true;
        safePlay();
      } else {
        _shouldPlayAfterLoad = false;
        audio.pause();
      }
    },

    pause: () => {
      _shouldPlayAfterLoad = false;
      getAudio()?.pause();
    },

    jumpTo: (index) => {
      const s = get();
      if (index < 0 || index >= s.queue.length) return;
      _shouldPlayAfterLoad = s.isPlaying;
      const track = s.queue[index];
      _loadingTrackId = track.songId;
      set({
        currentIndex: index,
        currentTrack: track,
        isLoading: true,
        seekBase: 0,
        trackDuration: 0,
      });
      get()._fetchAndSetSrc(track.songId);
    },

    prev: () => {
      syncUnlockAudio();
      const s = get();
      const i = s.currentIndex - 1;
      if (i < 0) return;
      _shouldPlayAfterLoad = s.isPlaying;
      const track = s.queue[i];
      _loadingTrackId = track.songId;
      set({
        currentIndex: i,
        currentTrack: track,
        isLoading: true,
        seekBase: 0,
        trackDuration: 0,
      });
      get()._fetchAndSetSrc(track.songId);
    },

    next: () => {
      syncUnlockAudio();
      const s = get();
      const i = s.currentIndex + 1;
      if (i >= s.queue.length) return;
      _shouldPlayAfterLoad = s.isPlaying;
      const track = s.queue[i];
      _loadingTrackId = track.songId;
      set({
        currentIndex: i,
        currentTrack: track,
        isLoading: true,
        seekBase: 0,
        trackDuration: 0,
      });
      get()._fetchAndSetSrc(track.songId);
    },

    removeFromQueue: (index) => {
      const s = get();
      const newQueue = s.queue.filter((_, i) => i !== index);

      if (index === s.currentIndex) {
        getAudio()?.pause();
        if (newQueue.length === 0) {
          _loadingTrackId = null;
          _shouldPlayAfterLoad = false;
          set({
            queue: [],
            currentIndex: -1,
            currentTrack: null,
            isPlaying: false,
            seekBase: 0,
            trackDuration: 0,
          });
          return;
        }
        const newIndex = Math.min(index, newQueue.length - 1);
        _loadingTrackId = null;
        _shouldPlayAfterLoad = false;
        set({
          queue: newQueue,
          currentIndex: newIndex,
          currentTrack: newQueue[newIndex],
          isLoading: true,
          seekBase: 0,
          trackDuration: 0,
        });
        get()._fetchAndSetSrc(newQueue[newIndex].songId);
        return;
      }

      const newIndex =
        index < s.currentIndex ? s.currentIndex - 1 : s.currentIndex;
      set({ queue: newQueue, currentIndex: newIndex });
    },

    clearQueue: () => {
      getAudio()?.pause();
      _loadingTrackId = null;
      _shouldPlayAfterLoad = false;
      set({
        queue: [],
        currentIndex: -1,
        currentTrack: null,
        isPlaying: false,
        error: null,
        seekBase: 0,
        trackDuration: 0,
      });
    },

    // 原文件直接改 currentTime；转码流不支持原生 seek，改用 timeOffset 重新请求流
    seek: (time) => {
      const s = get();
      if (!s.currentTrack) return;
      const targetTime = Math.max(0, Math.min(time, s.trackDuration || 0));
      // 立即告知系统控件目标位置，不等 canplay / seeked
      _seekTargetTime = targetTime;
      _isSeekingMediaSession = true;
      syncMediaSessionPosition();
      // 与重新取流的行为一致：跳转后接着播
      _shouldPlayAfterLoad = true;
      const audio = getAudio();
      if (_nativeSeek && audio) {
        nativeSeekTo(audio, targetTime);
        if (audio.paused) safePlay();
        return;
      }
      // 加载中显示的是 seekBase（新流的起点），这里就先改成目标位置，
      // 免得取流期间显示旧流的起点（比如回到 0:00）。与 isLoading 同一次写入，
      // 订阅方不会看到「已改起点、还没进加载」的中间状态
      set({ seekBase: targetTime, isLoading: true });
      get()._fetchAndSetSrc(s.currentTrack.songId, false, targetTime);
    },

    setVolume: (vol) => {
      const audio = getAudio();
      if (!audio) return;
      audio.volume = Math.max(0, Math.min(1, vol));
      if (vol > 0) audio.muted = false;
    },

    toggleMute: () => {
      const audio = getAudio();
      if (!audio) return;
      audio.muted = !audio.muted;
    },
  }),
);

// ─── Audio 事件绑定（模块加载时执行一次） ─────────────────────────────────────
// 以下三段 `typeof window !== "undefined"` 守卫的代码是纯浏览器运行时绑定
// （audio 事件监听、MediaSession 订阅、歌词自动拉取），在单测的 Node 环境下
// window 不存在，这些代码永远不会执行——用 v8 ignore 标记为已知不计入覆盖率，
// 而不是伪装成"测过了"。核心状态机逻辑已经在 player-store.test.ts 里覆盖。

/* v8 ignore start */
if (typeof window !== "undefined") {
  setTimeout(() => {
    const audio = getAudio();
    if (!audio) return;

    audio.addEventListener("loadstart", () => {
      usePlayerStore.getState()._setLoading(true);
      usePlayerStore.getState()._setError(null);
    });

    audio.addEventListener("canplay", () => {
      usePlayerStore.getState()._setLoading(false);
      if (_shouldPlayAfterLoad) safePlay();
      // seek 后新流就绪，恢复 MediaSession position 更新并立即同步正确位置
      _isSeekingMediaSession = false;
      _seekTargetTime = null;
      syncMediaSessionPosition();
    });

    audio.addEventListener("play", () =>
      usePlayerStore.getState()._setPlaying(true),
    );
    audio.addEventListener("pause", () => {
      if (_isSeeking) return;
      usePlayerStore.getState()._setPlaying(false);
    });
    audio.addEventListener("ended", () => usePlayerStore.getState()._onEnded());
    audio.addEventListener("volumechange", () => {
      usePlayerStore.getState()._setVolumeState(audio.volume, audio.muted);
    });

    audio.addEventListener("error", () => {
      const err = audio.error;
      const isNetworkError =
        err?.code === MediaError.MEDIA_ERR_NETWORK ||
        err?.code === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED;

      if (isNetworkError && _retryCount < 1) {
        _retryCount += 1;
        if (_loadingTrackId !== null) {
          // 从断开的位置接着取：播到一半断线、原文件链接过期（410）都走这里
          const { seekBase } = usePlayerStore.getState();
          const resumeAt = Math.floor(seekBase + audio.currentTime);
          usePlayerStore
            .getState()
            ._fetchAndSetSrc(_loadingTrackId, true, resumeAt);
          return;
        }
      }

      let code: PlayerErrorCode = "failed";
      if (err?.code === MediaError.MEDIA_ERR_NETWORK) code = "network";
      if (err?.code === MediaError.MEDIA_ERR_DECODE) code = "decode";
      if (err?.code === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED)
        code = "unsupported";

      _shouldPlayAfterLoad = false;
      usePlayerStore.getState()._setLoading(false);
      usePlayerStore.getState()._setPlaying(false);
      usePlayerStore.getState()._setError(code);
    });

    // MediaSession 进度同步：系统控件会按 position + playbackRate 自行推算，
    // 只需在位置跳变时同步（canplay 覆盖 seek 与换曲）。timeupdate 每秒约 4 次，
    // 逐次同步会不停唤醒锁屏/通知栏控件，这里只做低频校准，防止长时间累积漂移
    let lastPositionSync = 0;
    audio.addEventListener("timeupdate", () => {
      const now = Date.now();
      if (now - lastPositionSync < 10_000) return;
      lastPositionSync = now;
      syncMediaSessionPosition();
    });
    // 原生跳转完成：恢复 MediaSession 位置同步（转码流由 canplay 负责）。
    // 要注册在下面的同步监听之前，同步时才会用实际位置而不是目标位置
    audio.addEventListener("seeked", () => {
      if (!_nativeSeek) return;
      _isSeekingMediaSession = false;
      _seekTargetTime = null;
    });
    ["play", "pause", "seeked", "ratechange", "durationchange"].forEach((e) =>
      audio.addEventListener(e, syncMediaSessionPosition),
    );

    // 卡顿自愈：转码流中途断线后 Safari 会一直停在缓冲里（按钮显示播放中、时间不走），
    // 进度 8 秒没动就从当前位置重新取流，等同于用户手动拖一下。
    // 2 分钟内最多自动恢复 3 次，再卡就停下报网络错误，不无限重试
    const stallBudget = createRetryBudget(3, 120_000);
    const stallWatchdog = createStallWatchdog(8_000, () => {
      const s = usePlayerStore.getState();
      if (audio.paused || s.isLoading || !s.currentTrack) return;
      if (!stallBudget.take()) {
        _shouldPlayAfterLoad = false;
        audio.pause();
        s._setError("network");
        return;
      }
      console.warn("[Player] 播放卡住，从当前位置重新取流");
      s.seek(s.seekBase + audio.currentTime);
    });
    audio.addEventListener("playing", () =>
      stallWatchdog.start(audio.currentTime),
    );
    audio.addEventListener("timeupdate", () =>
      stallWatchdog.progress(audio.currentTime),
    );
    ["pause", "ended", "emptied", "error"].forEach((e) =>
      audio.addEventListener(e, stallWatchdog.stop),
    );
  }, 0);
}
/* v8 ignore stop */

// ─── MediaSession 元数据 & 控制（订阅 store 变化） ───────────────────────────

/* v8 ignore start */
if (typeof window !== "undefined") {
  usePlayerStore.subscribe((state, prev) => {
    if (
      state.currentTrack === prev.currentTrack &&
      state.currentIndex === prev.currentIndex &&
      state.queue.length === prev.queue.length &&
      state.isPlaying === prev.isPlaying
    )
      return;

    if (!("mediaSession" in navigator)) return;

    const { currentTrack, currentIndex, queue, isPlaying } = state;

    navigator.mediaSession.playbackState = isPlaying ? "playing" : "paused";

    if (!currentTrack) return;

    // 只有 track 真正变化时才重新赋值 metadata，避免 seek 后 isPlaying 变化触发重新注册导致控件闪退
    const trackChanged =
      state.currentTrack !== prev.currentTrack ||
      state.currentIndex !== prev.currentIndex;

    if (trackChanged) {
      // 手拼的优化图地址不会被 Next 自动纠正：w 必须在 deviceSizes/imageSizes 里，
      // q 必须在 images.qualities 里（Next 16 默认只有 75），否则 /_next/image 直接 400。
      // 输出格式按 Accept 协商（可能是 webp/avif），所以不写 type
      const artworkSrc = currentTrack.coverUrl
        ? `/_next/image?url=${encodeURIComponent(currentTrack.coverUrl)}&w=640&q=75`
        : null;
      navigator.mediaSession.metadata = new MediaMetadata({
        title: currentTrack.title,
        artist: currentTrack.artist ?? undefined,
        artwork: artworkSrc
          ? [{ src: artworkSrc, sizes: "640x640" }]
          : undefined,
      });
    }

    navigator.mediaSession.setActionHandler("play", () => {
      _shouldPlayAfterLoad = true;
      safePlay();
    });
    navigator.mediaSession.setActionHandler("pause", () => {
      _shouldPlayAfterLoad = false;
      getAudio()?.pause();
    });
    navigator.mediaSession.setActionHandler("seekbackward", (d) => {
      const s = usePlayerStore.getState();
      const audio = getAudio();
      if (!audio) return;
      s.seek(s.seekBase + audio.currentTime - (d.seekOffset ?? 10));
    });
    navigator.mediaSession.setActionHandler("seekforward", (d) => {
      const s = usePlayerStore.getState();
      const audio = getAudio();
      if (!audio) return;
      s.seek(s.seekBase + audio.currentTime + (d.seekOffset ?? 10));
    });
    navigator.mediaSession.setActionHandler("seekto", (d) => {
      if (d.seekTime == null) return;
      const seekTime = d.seekTime;

      // 立即更新系统控件显示位置（用目标时间），让进度条跟手
      _seekTargetTime = seekTime;
      _isSeekingMediaSession = true;
      syncMediaSessionPosition();

      // fastSeek=true 表示还在拖动（部分浏览器支持），跳过实际 seek
      if (d.fastSeek) {
        if (_seekToTimer !== null) clearTimeout(_seekToTimer);
        // 设一个较长的 fallback timer，防止 fastSeek 后没有 fastSeek=false 的收尾事件
        _seekToTimer = setTimeout(() => {
          _seekToTimer = null;
          usePlayerStore.getState().seek(seekTime);
        }, 500);
        return;
      }

      // fastSeek 不支持或已松手：debounce 300ms，防止拖动时每帧都发请求
      if (_seekToTimer !== null) clearTimeout(_seekToTimer);
      _seekToTimer = setTimeout(() => {
        _seekToTimer = null;
        usePlayerStore.getState().seek(seekTime);
      }, 300);
    });

    // previoustrack/nexttrack 依赖队列位置，只在 track/queue 变化时重新注册
    if (!trackChanged && state.queue.length === prev.queue.length) return;

    navigator.mediaSession.setActionHandler(
      "previoustrack",
      currentIndex > 0
        ? () => {
            syncUnlockAudio();
            usePlayerStore.getState().prev();
          }
        : null,
    );
    navigator.mediaSession.setActionHandler(
      "nexttrack",
      currentIndex < queue.length - 1
        ? () => {
            syncUnlockAudio();
            usePlayerStore.getState().next();
          }
        : null,
    );
  });
}
/* v8 ignore stop */

// ─── 歌词自动 fetch（订阅 currentTrack 变化） ────────────────────────────────

/* v8 ignore start */
if (typeof window !== "undefined") {
  usePlayerStore.subscribe((state, prev) => {
    const songId = state.currentTrack?.songId;
    if (!songId || songId === prev.currentTrack?.songId) return;
    if (state.lyricsMap.has(songId)) return;

    fetch(`/api/public/songs/${songId}/lyrics`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { lyrics: string | null } | null) => {
        if (!data?.lyrics) return;
        usePlayerStore.getState()._addLyrics(songId, data.lyrics);
      })
      .catch(() => {
        /* 歌词加载失败不影响播放 */
      });
  });
}
/* v8 ignore stop */
