// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDebouncedDraft } from "./useDebouncedDraft";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

function setup(initial: string) {
  const commit = vi.fn();
  const hook = renderHook(
    ({ value }) => useDebouncedDraft(value, commit, 300),
    { initialProps: { value: initial } },
  );
  return { commit, hook };
}

describe("useDebouncedDraft", () => {
  it("草稿立刻变，停下之后才提交", () => {
    const { commit, hook } = setup("");
    act(() => hook.result.current[1]("天"));
    act(() => hook.result.current[1]("天下"));
    expect(hook.result.current[0]).toBe("天下");
    expect(commit).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(300));
    expect(commit).toHaveBeenCalledTimes(1);
    expect(commit).toHaveBeenCalledWith("天下");
  });

  it("immediate 立刻提交", () => {
    const { commit, hook } = setup("天下");
    act(() => hook.result.current[1]("", true));
    expect(commit).toHaveBeenCalledWith("");
  });

  it("外面的值变了：草稿换成外面的，还没提交的作废", () => {
    const { commit, hook } = setup("");
    act(() => hook.result.current[1]("天下"));
    hook.rerender({ value: "明月" });
    expect(hook.result.current[0]).toBe("明月");
    act(() => vi.advanceTimersByTime(300));
    expect(commit).not.toHaveBeenCalled();
  });

  it("水合后外面的值从默认换成地址栏里的，草稿跟着换", () => {
    const { hook } = setup("");
    hook.rerender({ value: "如花" });
    expect(hook.result.current[0]).toBe("如花");
  });
});
