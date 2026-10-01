import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRetryBudget, createStallWatchdog } from "./stall-watchdog";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("createStallWatchdog", () => {
  it("开始播放后进度一直不动，到时触发", () => {
    const onStall = vi.fn();
    const dog = createStallWatchdog(8000, onStall);
    dog.start(10);
    vi.advanceTimersByTime(7999);
    expect(onStall).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onStall).toHaveBeenCalledTimes(1);
  });

  it("进度在走就不断往后推，不触发", () => {
    const onStall = vi.fn();
    const dog = createStallWatchdog(8000, onStall);
    dog.start(0);
    for (let t = 1; t <= 40; t++) {
      vi.advanceTimersByTime(250);
      dog.progress(t * 0.25);
    }
    expect(onStall).not.toHaveBeenCalled();
  });

  it("位置不变的回报不算前进（卡住时偶尔还会来 timeupdate）", () => {
    const onStall = vi.fn();
    const dog = createStallWatchdog(8000, onStall);
    dog.start(30);
    for (let i = 0; i < 40; i++) {
      vi.advanceTimersByTime(250);
      dog.progress(30);
    }
    expect(onStall).toHaveBeenCalledTimes(1);
  });

  it("暂停后停止计时；没开始计时时的进度回报不会启动它", () => {
    const onStall = vi.fn();
    const dog = createStallWatchdog(8000, onStall);
    dog.start(0);
    dog.stop();
    dog.progress(1);
    vi.advanceTimersByTime(60_000);
    expect(onStall).not.toHaveBeenCalled();
  });

  it("触发一次后停下，等下一次开始播放再计时", () => {
    const onStall = vi.fn();
    const dog = createStallWatchdog(8000, onStall);
    dog.start(0);
    vi.advanceTimersByTime(8000);
    dog.progress(5);
    vi.advanceTimersByTime(60_000);
    expect(onStall).toHaveBeenCalledTimes(1);
  });
});

describe("createRetryBudget", () => {
  it("窗口内最多 max 次，过了窗口恢复", () => {
    const budget = createRetryBudget(3, 120_000);
    expect(budget.take(0)).toBe(true);
    expect(budget.take(1000)).toBe(true);
    expect(budget.take(2000)).toBe(true);
    expect(budget.take(3000)).toBe(false);
    // 第一次已经出了窗口
    expect(budget.take(120_001)).toBe(true);
  });
});
