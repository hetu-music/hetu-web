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
import messages from "../../../messages/zh-CN";

vi.mock("@/lib/player/audio-engine", () => ({ getAudio: () => null }));

import { usePlayerStore } from "@/store/player-store";
import FloatingActionButtons from "./FloatingActionButtons";

function renderFab() {
  return render(
    <NextIntlClientProvider locale="zh-CN" messages={messages}>
      <FloatingActionButtons showScrollTop onScrollToTop={vi.fn()} />
    </NextIntlClientProvider>,
  );
}

// 收起时带 aria-hidden，按角色查不到，按 title 取
const jumpButton = () =>
  document.querySelector('button[title="返回顶部"]') as HTMLButtonElement;

beforeEach(() => {
  vi.useFakeTimers();
  usePlayerStore.setState({
    currentTrack: { songId: 1, title: "歌一" },
    isPlaying: false,
    playerVisible: false,
  });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("浮动胶囊", () => {
  it("开关在最下面，跳转按钮在它上方伸缩", () => {
    const { container } = renderFab();
    const capsule = container.firstElementChild as HTMLElement;
    expect(capsule.lastElementChild?.getAttribute("aria-label")).toBe(
      "展开播放器",
    );
  });

  it("指针移入不会展开收起的跳转按钮", () => {
    const { container } = renderFab();
    const capsule = container.firstElementChild as HTMLElement;
    fireEvent.pointerEnter(capsule, { pointerType: "mouse" });
    expect(jumpButton().getAttribute("aria-hidden")).toBe("true");
  });

  it("滚动时展开，指针停在上面时不收", () => {
    const { container } = renderFab();
    const capsule = container.firstElementChild as HTMLElement;
    act(() => {
      window.dispatchEvent(new Event("scroll"));
    });
    expect(jumpButton().getAttribute("aria-hidden")).toBe("false");

    fireEvent.pointerEnter(capsule, { pointerType: "mouse" });
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(jumpButton().getAttribute("aria-hidden")).toBe("false");

    fireEvent.pointerLeave(capsule);
    expect(jumpButton().getAttribute("aria-hidden")).toBe("true");
  });

  it("唱片跟播放状态：暂停时停在原角度，播放时转", () => {
    renderFab();
    const disc = screen
      .getByRole("button", { name: "展开播放器" })
      .querySelector("svg") as SVGElement;
    expect(disc.getAttribute("class")).toContain("animate-spin");
    expect(disc.getAttribute("class")).toContain(
      "[animation-play-state:paused]",
    );
    act(() => usePlayerStore.setState({ isPlaying: true }));
    expect(disc.getAttribute("class")).not.toContain(
      "[animation-play-state:paused]",
    );
  });
});
