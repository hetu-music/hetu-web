import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// player-store.ts 里所有需要浏览器环境（window/navigator.mediaSession/事件监听绑定）
// 的部分都被 `typeof window !== "undefined"` 守卫包裹，在 Vitest 的 node 环境下
// （没有 window）这些代码块在模块加载时会被直接跳过——这正好让我们能在不引入
// jsdom 的情况下，纯粹测试队列/播放状态机这部分核心逻辑。
// audio 本身用一个手写的假对象 mock 掉，行为上只关心 play()/pause()/属性读写。

const { getFakeAudio, resetFakeAudio } = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let audio: any;
  function makeFakeAudio() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const a: any = {
      paused: true,
      muted: false,
      volume: 0.8,
      currentTime: 0,
      src: "",
      playbackRate: 1,
      readyState: 0,
      listeners: {} as Record<string, (() => void)[]>,
    };
    // 只实现 once 语义用得到的部分：emit 时调用并清掉
    a.addEventListener = (type: string, fn: () => void) => {
      (a.listeners[type] ??= []).push(fn);
    };
    a.emit = (type: string) => {
      const fns = a.listeners[type] ?? [];
      a.listeners[type] = [];
      fns.forEach((fn: () => void) => fn());
    };
    a.play = () => {
      a.paused = false;
      return Promise.resolve();
    };
    a.pause = () => {
      a.paused = true;
    };
    a.load = () => {
      /* 假 audio：load() 不需要做任何事 */
    };
    return a;
  }
  function resetFakeAudio() {
    audio = makeFakeAudio();
    return audio;
  }
  function getFakeAudio() {
    return audio;
  }
  resetFakeAudio();
  return { getFakeAudio, resetFakeAudio };
});

vi.mock("@/lib/player/audio-engine", () => ({
  getAudio: () => getFakeAudio(),
}));

import { usePlayerStore, type PlayerTrack } from "./player-store";

const INITIAL_STATE = {
  currentTrack: null,
  queue: [] as PlayerTrack[],
  currentIndex: -1,
  isPlaying: false,
  isLoading: false,
  volume: 0.8,
  isMuted: false,
  error: null,
  playerVisible: false,
  lyricsMap: new Map<number, string>(),
  trackDuration: 0,
  seekBase: 0,
};

function track(
  songId: number,
  overrides: Partial<PlayerTrack> = {},
): PlayerTrack {
  return { songId, title: `song-${songId}`, ...overrides };
}

beforeEach(() => {
  resetFakeAudio();
  usePlayerStore.setState(INITIAL_STATE); // 合并模式，不会清掉 action 方法
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: true,
      json: async () => ({ url: "https://example.com/stream", duration: 120 }),
    })),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("enqueue", () => {
  it("添加新曲目到队列末尾", () => {
    usePlayerStore.getState().enqueue(track(1));
    expect(usePlayerStore.getState().queue.map((t) => t.songId)).toEqual([1]);
  });

  it("已在队列中的曲目不会重复添加", () => {
    usePlayerStore.getState().enqueue(track(1));
    usePlayerStore.getState().enqueue(track(1));
    expect(usePlayerStore.getState().queue).toHaveLength(1);
  });
});

describe("play", () => {
  it("播放新曲目：加入队列、设为当前曲目、显示播放器、请求流地址", async () => {
    usePlayerStore.getState().play(track(1));

    expect(usePlayerStore.getState().playerVisible).toBe(true);
    expect(usePlayerStore.getState().currentTrack?.songId).toBe(1);
    expect(usePlayerStore.getState().isPlaying).toBe(true);

    await vi.waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/navidrome/stream-url?songId=1"),
      );
    });
  });

  it("重复播放当前已在播放的曲目：只是恢复播放，不改变队列", async () => {
    usePlayerStore.getState().play(track(1));
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));

    usePlayerStore.getState().play(track(1));

    expect(usePlayerStore.getState().queue).toHaveLength(1);
    expect(fetch).toHaveBeenCalledTimes(1); // 没有再发起新的流请求
  });

  it("播放队列中已存在但非当前的曲目：切换 currentIndex，不重复入队", async () => {
    usePlayerStore.getState().enqueue(track(1));
    usePlayerStore.getState().enqueue(track(2));

    usePlayerStore.getState().play(track(2));

    expect(usePlayerStore.getState().currentTrack?.songId).toBe(2);
    expect(usePlayerStore.getState().queue).toHaveLength(2);
  });

  it("stream-url 请求成功后写入 audio.src 和 trackDuration", async () => {
    usePlayerStore.getState().play(track(1));
    await vi.waitFor(() => {
      expect(getFakeAudio().src).toBe("https://example.com/stream");
    });
    expect(usePlayerStore.getState().trackDuration).toBe(120);
  });

  it("stream-url 请求失败时设置 error 并停止播放状态", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 500 })),
    );
    usePlayerStore.getState().play(track(1));

    await vi.waitFor(() => {
      expect(usePlayerStore.getState().error).toBe("streamFailed");
    });
    expect(usePlayerStore.getState().isPlaying).toBe(false);
  });

  it.each([
    [401, "forbidden"],
    [403, "forbidden"],
    [404, "notFound"],
    [429, "rateLimited"],
    [503, "unavailable"],
  ] as const)("stream-url 返回 %i 时错误为 %s", async (status, code) => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status })),
    );
    usePlayerStore.getState().play(track(1));

    await vi.waitFor(() => {
      expect(usePlayerStore.getState().error).toBe(code);
    });
  });

  it("接口成功但没给地址时按取地址失败处理", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, json: async () => ({}) })),
    );
    usePlayerStore.getState().play(track(1));

    await vi.waitFor(() => {
      expect(usePlayerStore.getState().error).toBe("streamFailed");
    });
  });

  it("网络异常（fetch reject）时降级为 error 状态而不抛出未捕获异常", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("Failed to fetch");
      }),
    );
    usePlayerStore.getState().play(track(1));

    await vi.waitFor(() => {
      expect(usePlayerStore.getState().error).toBe("network");
    });
  });

  it("竞态：连续切换两首曲目，只有最后一次请求的结果生效", async () => {
    let resolveFirst!: (value: {
      ok: boolean;
      json: () => Promise<{ url: string; duration: number }>;
    }) => void;
    const firstResponse = new Promise((resolve) => {
      resolveFirst = resolve;
    });

    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockImplementationOnce(() => firstResponse)
        .mockImplementationOnce(async () => ({
          ok: true,
          json: async () => ({
            url: "https://example.com/second",
            duration: 200,
          }),
        })),
    );

    usePlayerStore.getState().play(track(1));
    usePlayerStore.getState().play(track(2)); // 第二次调用在第一次 resolve 之前发生

    await vi.waitFor(() => {
      expect(getFakeAudio().src).toBe("https://example.com/second");
    });

    // 第一次请求这时才姗姗来迟地 resolve，不应覆盖已经生效的第二首曲目
    resolveFirst({
      ok: true,
      json: async () => ({ url: "https://example.com/first", duration: 100 }),
    });
    await Promise.resolve();
    await Promise.resolve();

    expect(getFakeAudio().src).toBe("https://example.com/second");
    expect(usePlayerStore.getState().trackDuration).toBe(200);
  });
});

describe("toggle / pause", () => {
  it("audio 暂停中时 toggle() 触发播放", () => {
    getFakeAudio().paused = true;
    usePlayerStore.getState().toggle();
    expect(getFakeAudio().paused).toBe(false);
  });

  it("audio 播放中时 toggle() 触发暂停", () => {
    getFakeAudio().paused = false;
    usePlayerStore.getState().toggle();
    expect(getFakeAudio().paused).toBe(true);
  });

  it("pause() 直接暂停 audio", () => {
    getFakeAudio().paused = false;
    usePlayerStore.getState().pause();
    expect(getFakeAudio().paused).toBe(true);
  });
});

describe("jumpTo / next / prev", () => {
  beforeEach(() => {
    usePlayerStore.setState({
      queue: [track(1), track(2), track(3)],
      currentIndex: 1,
      currentTrack: track(2),
    });
  });

  it("jumpTo 越界索引时忽略，不改变状态", () => {
    usePlayerStore.getState().jumpTo(99);
    expect(usePlayerStore.getState().currentIndex).toBe(1);
    usePlayerStore.getState().jumpTo(-1);
    expect(usePlayerStore.getState().currentIndex).toBe(1);
  });

  it("jumpTo 合法索引时切换到对应曲目", () => {
    usePlayerStore.getState().jumpTo(2);
    expect(usePlayerStore.getState().currentTrack?.songId).toBe(3);
  });

  it("next 到达队列末尾时忽略", () => {
    usePlayerStore.getState().jumpTo(2); // 切到最后一首
    usePlayerStore.getState().next();
    expect(usePlayerStore.getState().currentIndex).toBe(2); // 没有越界前进
  });

  it("prev 在队首时忽略", () => {
    usePlayerStore.getState().jumpTo(0);
    usePlayerStore.getState().prev();
    expect(usePlayerStore.getState().currentIndex).toBe(0);
  });

  it("next/prev 在中间位置正常移动", () => {
    usePlayerStore.getState().next();
    expect(usePlayerStore.getState().currentTrack?.songId).toBe(3);
    usePlayerStore.getState().prev();
    usePlayerStore.getState().prev();
    expect(usePlayerStore.getState().currentTrack?.songId).toBe(1);
  });
});

describe("removeFromQueue", () => {
  it("移除后队列为空：完全重置状态", () => {
    usePlayerStore.setState({
      queue: [track(1)],
      currentIndex: 0,
      currentTrack: track(1),
      isPlaying: true,
    });
    usePlayerStore.getState().removeFromQueue(0);
    const s = usePlayerStore.getState();
    expect(s.queue).toEqual([]);
    expect(s.currentIndex).toBe(-1);
    expect(s.currentTrack).toBeNull();
    expect(s.isPlaying).toBe(false);
  });

  it("移除当前曲目且队列还有剩余：索引钳制到有效范围内的下一首", () => {
    usePlayerStore.setState({
      queue: [track(1), track(2), track(3)],
      currentIndex: 2, // 当前是最后一首
      currentTrack: track(3),
    });
    usePlayerStore.getState().removeFromQueue(2);
    const s = usePlayerStore.getState();
    expect(s.queue.map((t) => t.songId)).toEqual([1, 2]);
    expect(s.currentTrack?.songId).toBe(2); // 钳制到新的最后一首
  });

  it("移除非当前曲目：currentIndex 跟随前移，但不触发重新加载", async () => {
    usePlayerStore.setState({
      queue: [track(1), track(2), track(3)],
      currentIndex: 2,
      currentTrack: track(3),
    });
    usePlayerStore.getState().removeFromQueue(0); // 移除队首（非当前）

    const s = usePlayerStore.getState();
    expect(s.queue.map((t) => t.songId)).toEqual([2, 3]);
    expect(s.currentIndex).toBe(1); // 索引跟着前移一位
    expect(s.currentTrack?.songId).toBe(3); // 当前曲目不变
    expect(fetch).not.toHaveBeenCalled(); // 没有触发重新拉流
  });
});

describe("clearQueue", () => {
  it("清空队列并暂停 audio", () => {
    usePlayerStore.setState({
      queue: [track(1)],
      currentIndex: 0,
      currentTrack: track(1),
      isPlaying: true,
    });
    usePlayerStore.getState().clearQueue();
    const s = usePlayerStore.getState();
    expect(s.queue).toEqual([]);
    expect(s.currentTrack).toBeNull();
    expect(getFakeAudio().paused).toBe(true);
  });
});

describe("seek", () => {
  it("没有 currentTrack 时忽略", () => {
    usePlayerStore.getState().seek(30);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("目标时间被钳制到 [0, trackDuration] 区间", async () => {
    usePlayerStore.setState({
      currentTrack: track(1),
      trackDuration: 100,
    });

    usePlayerStore.getState().seek(-10);
    await vi.waitFor(() => expect(fetch).toHaveBeenCalled());
    // -10 被钳制为 0，timeOffset > 0 才会加入 querystring，所以不应出现 timeOffset 参数
    const firstCallUrl = vi.mocked(fetch).mock.calls[0][0] as string;
    expect(firstCallUrl).not.toContain("timeOffset");

    vi.mocked(fetch).mockClear();
    usePlayerStore.getState().seek(9999); // 超过 trackDuration=100
    await vi.waitFor(() => expect(fetch).toHaveBeenCalled());
    const secondCallUrl = vi.mocked(fetch).mock.calls[0][0] as string;
    expect(secondCallUrl).toContain("timeOffset=100");
  });
});

describe("seek：转码流", () => {
  it("取流期间就显示目标位置，不回到旧流的起点", () => {
    usePlayerStore.setState({
      currentTrack: track(1),
      trackDuration: 200,
      seekBase: 0,
    });
    usePlayerStore.getState().seek(150);
    const { seekBase, isLoading } = usePlayerStore.getState();
    expect(isLoading).toBe(true);
    expect(seekBase).toBe(150);
  });
});

describe("seek：原文件（seekable）", () => {
  function stubSeekable() {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          url: "https://example.com/file",
          duration: 200,
          seekable: true,
        }),
      })),
    );
  }

  it("原文件直接改 currentTime，不重新取流", async () => {
    stubSeekable();
    usePlayerStore.getState().play(track(1));
    await vi.waitFor(() =>
      expect(getFakeAudio().src).toBe("https://example.com/file"),
    );
    getFakeAudio().readyState = 4;
    vi.mocked(fetch).mockClear();

    usePlayerStore.getState().seek(80);
    expect(getFakeAudio().currentTime).toBe(80);
    expect(fetch).not.toHaveBeenCalled();
    // 原文件的 currentTime 就是整首里的位置
    expect(usePlayerStore.getState().seekBase).toBe(0);
  });

  it("元数据没到时先等 loadedmetadata 再跳", async () => {
    stubSeekable();
    usePlayerStore.getState().play(track(1));
    await vi.waitFor(() =>
      expect(getFakeAudio().src).toBe("https://example.com/file"),
    );

    usePlayerStore.getState().seek(50);
    expect(getFakeAudio().currentTime).toBe(0);
    getFakeAudio().emit("loadedmetadata");
    expect(getFakeAudio().currentTime).toBe(50);
  });

  it("带起播位置取到原文件时：从头发，元数据就绪后跳过去，seekBase 为 0", async () => {
    stubSeekable();
    usePlayerStore.setState({ currentTrack: track(1) });
    usePlayerStore.getState()._fetchAndSetSrc(1, false, 42);
    await vi.waitFor(() =>
      expect(getFakeAudio().src).toBe("https://example.com/file"),
    );
    expect(usePlayerStore.getState().seekBase).toBe(0);
    getFakeAudio().emit("loadedmetadata");
    expect(getFakeAudio().currentTime).toBe(42);
  });

  it("换成转码流后恢复为重新取流", async () => {
    stubSeekable();
    usePlayerStore.getState().play(track(1));
    await vi.waitFor(() =>
      expect(getFakeAudio().src).toBe("https://example.com/file"),
    );
    // 不带 seekable 即转码流
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          url: "https://example.com/stream",
          duration: 120,
        }),
      })),
    );
    usePlayerStore.getState().play(track(2));
    await vi.waitFor(() =>
      expect(getFakeAudio().src).toBe("https://example.com/stream"),
    );
    vi.mocked(fetch).mockClear();

    usePlayerStore.getState().seek(30);
    await vi.waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(vi.mocked(fetch).mock.calls[0][0]).toContain("timeOffset=30");
  });
});

describe("setVolume / toggleMute", () => {
  it("音量被钳制到 [0, 1] 区间", () => {
    usePlayerStore.getState().setVolume(1.5);
    expect(getFakeAudio().volume).toBe(1);
    usePlayerStore.getState().setVolume(-0.5);
    expect(getFakeAudio().volume).toBe(0);
  });

  it("设置音量 > 0 时自动取消静音", () => {
    getFakeAudio().muted = true;
    usePlayerStore.getState().setVolume(0.5);
    expect(getFakeAudio().muted).toBe(false);
  });

  it("toggleMute 翻转静音状态", () => {
    getFakeAudio().muted = false;
    usePlayerStore.getState().toggleMute();
    expect(getFakeAudio().muted).toBe(true);
    usePlayerStore.getState().toggleMute();
    expect(getFakeAudio().muted).toBe(false);
  });
});

describe("_onEnded", () => {
  it("队列还有下一首时自动前进并继续播放", () => {
    usePlayerStore.setState({
      queue: [track(1), track(2)],
      currentIndex: 0,
      currentTrack: track(1),
    });
    usePlayerStore.getState()._onEnded();
    const s = usePlayerStore.getState();
    expect(s.currentIndex).toBe(1);
    expect(s.currentTrack?.songId).toBe(2);
    expect(s.isPlaying).toBe(true);
  });

  it("已经是队列最后一首时停止播放，不越界", () => {
    usePlayerStore.setState({
      queue: [track(1)],
      currentIndex: 0,
      currentTrack: track(1),
      isPlaying: true,
    });
    usePlayerStore.getState()._onEnded();
    const s = usePlayerStore.getState();
    expect(s.isPlaying).toBe(false);
    expect(s.currentIndex).toBe(0); // 没有变化
  });
});

describe("_addLyrics", () => {
  it("首次写入指定 songId 的歌词", () => {
    usePlayerStore.getState()._addLyrics(1, "[00:01.00]歌词");
    expect(usePlayerStore.getState().lyricsMap.get(1)).toBe("[00:01.00]歌词");
  });

  it("已存在该 songId 时不覆盖（避免不必要的重渲染）", () => {
    usePlayerStore.getState()._addLyrics(1, "原始歌词");
    usePlayerStore.getState()._addLyrics(1, "新歌词");
    expect(usePlayerStore.getState().lyricsMap.get(1)).toBe("原始歌词");
  });
});
