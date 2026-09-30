// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import React from "react";
import messages from "../../../../messages/zh-CN";

// ─── mock 依赖 ────────────────────────────────────────────────────────────────

// 真实 <audio> 在 jsdom 里只是桩；用 EventTarget 做一个能派发事件、可写 currentTime 的假对象
const { fakeAudio } = vi.hoisted(() => {
  class FakeAudio extends EventTarget {
    paused = true;
    muted = false;
    volume = 0.8;
    currentTime = 0;
    playbackRate = 1;
    src = "";
    play() {
      this.paused = false;
      return Promise.resolve();
    }
    pause() {
      this.paused = true;
    }
    load() {
      /* 假 audio：load() 不需要做任何事 */
    }
  }
  return { fakeAudio: new FakeAudio() };
});

vi.mock("@/lib/player/audio-engine", () => ({ getAudio: () => fakeAudio }));

vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...rest }: React.ComponentProps<"a">) => (
    <a href={String(href)} {...rest}>
      {children}
    </a>
  ),
  usePathname: () => "/song/1",
}));

vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} />
  ),
}));

import { usePlayerStore } from "@/store/player-store";
import GlobalPlayer from "../GlobalPlayer";

// ─── 测试辅助 ─────────────────────────────────────────────────────────────────

const LRC = "[00:00.00]第一句\n[00:10.00]第二句\n[00:20.00]第三句";

function renderPlayer() {
  return render(
    <NextIntlClientProvider locale="zh-CN" messages={messages}>
      <GlobalPlayer />
    </NextIntlClientProvider>,
  );
}

function emit(type: string) {
  act(() => {
    fakeAudio.dispatchEvent(new Event(type));
  });
}

beforeEach(() => {
  // 取流、取歌词都不需要真的返回
  vi.stubGlobal(
    "fetch",
    vi.fn(
      () =>
        new Promise(() => {
          /* 永不返回 */
        }),
    ),
  );
  // useIsDesktop：按宽屏处理，队列是下拉而不是底部面板；没开「减少动态效果」
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches: !query.includes("reduced-motion"),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
  fakeAudio.currentTime = 0;
  usePlayerStore.setState({
    currentTrack: { songId: 1, title: "歌一", artist: "河图" },
    queue: [
      { songId: 1, title: "歌一", artist: "河图" },
      { songId: 2, title: "歌二", artist: null },
    ],
    currentIndex: 0,
    isPlaying: false,
    isLoading: false,
    error: null,
    playerVisible: true,
    lyricsMap: new Map([[1, LRC]]),
    trackDuration: 245,
    seekBase: 0,
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

// ─── 用例 ─────────────────────────────────────────────────────────────────────

describe("播放条", () => {
  it("没有曲目时不渲染", () => {
    usePlayerStore.setState({ currentTrack: null });
    const { container } = renderPlayer();
    expect(container.innerHTML).toBe("");
  });

  it("显示歌名、当前句与时长", () => {
    renderPlayer();
    expect(
      screen.getByRole("link", { name: "歌一" }).getAttribute("href"),
    ).toBe("/song/1");
    // 有当前句时歌词代替歌手，窄屏宽屏都在歌名下这一行
    expect(screen.getByText("第一句")).toBeTruthy();
    expect(screen.queryByText("河图")).toBeNull();
    expect(screen.getByText("4:05")).toBeTruthy();
    expect(screen.getByRole("button", { name: "播放" })).toBeTruthy();
    // 第一首没有上一首；窄屏给歌词腾宽度，不放上一首
    const prev = screen.getByRole("button", {
      name: "上一首",
    }) as HTMLButtonElement;
    expect(prev.disabled).toBe(true);
    expect(prev.className).toContain("max-md:hidden");
    // 队列是图标按钮，数量写在无障碍名里
    expect(
      screen.getByRole("button", { name: "播放队列，共 2 首" }).textContent,
    ).toBe("");
  });

  it("timeupdate 时直接改写进度线、时间码与歌词行", () => {
    renderPlayer();
    const slider = screen.getByRole("slider", { name: "播放进度" });
    fakeAudio.currentTime = 12.3;
    emit("timeupdate");

    expect(screen.getByText("0:12")).toBeTruthy();
    expect(slider.getAttribute("aria-valuenow")).toBe("12");
    const fill = slider.lastElementChild as HTMLElement;
    expect(fill.style.transform).toBe(`scaleX(${12.3 / 245})`);
    expect(screen.getByText("第二句")).toBeTruthy();
  });

  it("正常往前走时进度线在两次更新之间匀速滑过去，跳转时直接到位", () => {
    renderPlayer();
    const fill = screen.getByRole("slider").lastElementChild as HTMLElement;
    fakeAudio.currentTime = 1;
    emit("timeupdate");
    fakeAudio.currentTime = 1.25;
    emit("timeupdate");
    expect(fill.style.transition).toMatch(/^transform [0-9]+ms linear, /);

    // 往回跳或一次走太远：不滑
    fakeAudio.currentTime = 0.5;
    emit("timeupdate");
    expect(fill.style.transition).not.toContain("transform");
    fakeAudio.currentTime = 30;
    emit("timeupdate");
    expect(fill.style.transition).not.toContain("transform");
  });

  it("播放条收起时进度线不滑", () => {
    renderPlayer();
    const fill = screen.getByRole("slider").lastElementChild as HTMLElement;
    act(() => usePlayerStore.setState({ playerVisible: false }));
    fakeAudio.currentTime = 1;
    emit("timeupdate");
    fakeAudio.currentTime = 1.25;
    emit("timeupdate");
    expect(fill.style.transition).not.toContain("transform");
  });

  it("加载中显示新流的起点，而不是旧流的位置", () => {
    renderPlayer();
    fakeAudio.currentTime = 100;
    act(() => usePlayerStore.setState({ isLoading: true, seekBase: 30 }));
    expect(screen.getByText("0:30")).toBeTruthy();
  });

  it("拖动进度线：预览位置保持到新流就绪", () => {
    renderPlayer();
    const slider = screen.getByRole("slider", { name: "播放进度" });
    slider.getBoundingClientRect = () => ({ left: 0, width: 245 }) as DOMRect;

    fireEvent.pointerDown(slider, { clientX: 60, pointerId: 1 });
    fireEvent.pointerUp(slider, { clientX: 60, pointerId: 1 });
    expect(screen.getByText("1:00")).toBeTruthy();
    expect(usePlayerStore.getState().isLoading).toBe(true);

    // 取流期间旧流还在走，不能闪回
    fakeAudio.currentTime = 5;
    emit("timeupdate");
    expect(screen.getByText("1:00")).toBeTruthy();

    // 新流就绪：seekBase 已是目标位置，audio 从 0 开始
    fakeAudio.currentTime = 0;
    act(() => usePlayerStore.setState({ seekBase: 60, isLoading: false }));
    fakeAudio.currentTime = 2;
    emit("timeupdate");
    expect(screen.getByText("1:02")).toBeTruthy();
  });

  it("原文件原生跳转：预览位置保持到 seeked", () => {
    renderPlayer();
    const slider = screen.getByRole("slider", { name: "播放进度" });
    slider.getBoundingClientRect = () => ({ left: 0, width: 245 }) as DOMRect;

    // 原生跳转不经过 isLoading；这里只看进度条这一侧，store 的跳转换成桩
    const seek = usePlayerStore.getState().seek;
    act(() => usePlayerStore.setState({ seek: vi.fn() }));
    fireEvent.pointerDown(slider, { clientX: 90, pointerId: 1 });
    fireEvent.pointerUp(slider, { clientX: 90, pointerId: 1 });
    expect(screen.getByText("1:30")).toBeTruthy();

    // 跳转完成前的旧位置不能闪回
    fakeAudio.currentTime = 5;
    emit("timeupdate");
    expect(screen.getByText("1:30")).toBeTruthy();

    fakeAudio.currentTime = 90;
    emit("seeked");
    fakeAudio.currentTime = 91;
    emit("timeupdate");
    expect(screen.getByText("1:31")).toBeTruthy();
    act(() => usePlayerStore.setState({ seek }));
  });

  it("歌词用楷体，字号按字数缩放", () => {
    renderPlayer();
    const line = screen.getByText("第一句");
    expect(line.className).toContain("font-kaiti");
    // 3 个汉字 × 1.08 的余量：100cqw / 3.24，jsdom 会把 calc 化简
    expect(line.style.fontSize).toMatch(/^clamp\(11px, 30\.86\d*cqw, 13px\)$/);
  });

  it("没有时间轴歌词时显示歌手", () => {
    usePlayerStore.setState({
      lyricsMap: new Map([[1, "没有时间轴的纯文本"]]),
    });
    renderPlayer();
    expect(screen.queryByText("没有时间轴的纯文本")).toBeNull();
    expect(screen.getByText("河图")).toBeTruthy();
  });

  it("前奏还没有句子时显示歌手，第一句到了再换成歌词", () => {
    usePlayerStore.setState({
      lyricsMap: new Map([[1, "[00:15.00]迟来的第一句"]]),
    });
    renderPlayer();
    expect(screen.getByText("河图")).toBeTruthy();
    fakeAudio.currentTime = 15;
    emit("timeupdate");
    expect(screen.getByText("迟来的第一句")).toBeTruthy();
    expect(screen.queryByText("河图")).toBeNull();
  });

  it("出错时错误优先于歌词", () => {
    usePlayerStore.setState({ error: "network" });
    renderPlayer();
    expect(screen.getByText("网络错误，无法加载音频")).toBeTruthy();
    expect(screen.queryByText("第一句")).toBeNull();
  });

  it("收起时整条 inert", () => {
    renderPlayer();
    const bar = screen.getByRole("slider").parentElement as HTMLElement;
    expect(bar.hasAttribute("inert")).toBe(false);
    act(() => usePlayerStore.setState({ playerVisible: false }));
    expect(bar.hasAttribute("inert")).toBe(true);
  });
});

describe("队列", () => {
  it("打开后列出曲目，当前曲标 aria-current，缺歌手写佚名", () => {
    renderPlayer();
    fireEvent.click(screen.getByRole("button", { name: /队列/ }));
    const dialog = screen.getByRole("dialog", { name: "播放队列" });
    expect(dialog.textContent).toContain("2 首");
    expect(screen.getByRole("button", { current: true }).textContent).toContain(
      "歌一",
    );
    expect(dialog.textContent).toContain("佚名");
  });

  it("清空要点两次", () => {
    renderPlayer();
    fireEvent.click(screen.getByRole("button", { name: /队列/ }));
    fireEvent.click(screen.getByRole("button", { name: "清空" }));
    expect(usePlayerStore.getState().queue).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: "确认清空" }));
    expect(usePlayerStore.getState().queue).toHaveLength(0);
    // 没有曲目了，播放条整条卸载
    expect(screen.queryByRole("slider")).toBeNull();
  });

  it("Esc 关闭", () => {
    renderPlayer();
    fireEvent.click(screen.getByRole("button", { name: /队列/ }));
    fireEvent.keyDown(window, { key: "Escape" });
    // AnimatePresence 退场动画期间节点还在，等它结束
    return vi.waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });
});
