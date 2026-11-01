// @vitest-environment jsdom
import {
  act,
  cleanup,
  render,
  renderHook,
  screen,
} from "@testing-library/react";
import React from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  flushUrlState,
  resetUrlStateForTests,
  URL_WRITE_INTERVAL_MS,
  useUrlState,
} from "./useUrlState";

/** 把 q 和 page 铺到 DOM 上，按钮各做一次改写 */
function Probe() {
  const [params, update] = useUrlState();
  return (
    <div>
      <span data-testid="q">{params.get("q") ?? ""}</span>
      <span data-testid="page">{params.get("page") ?? ""}</span>
      <button
        onClick={() =>
          update((d) => {
            d.set("q", "天下");
            d.delete("page");
          })
        }
      >
        search
      </button>
    </div>
  );
}

const text = (id: string) => screen.getByTestId(id).textContent;

beforeEach(() => {
  resetUrlStateForTests();
  window.history.replaceState(null, "", "/");
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("useUrlState：读", () => {
  it("服务端渲染用默认状态，不读地址栏", () => {
    window.history.replaceState(null, "", "/?q=明月");
    const html = renderToString(<Probe />);
    expect(html).not.toContain("明月");
  });

  it("水合时先按默认状态，水合完成后换成地址栏里的值", async () => {
    window.history.replaceState(null, "", "/?q=明月");
    const container = document.createElement("div");
    container.innerHTML = renderToString(<Probe />);
    document.body.appendChild(container);
    const errors = vi.spyOn(console, "error").mockImplementation(() => null);
    await act(async () => {
      hydrateRoot(container, <Probe />);
    });
    expect(container.querySelector("[data-testid=q]")?.textContent).toBe(
      "明月",
    );
    // 水合本身没有不一致
    expect(errors).not.toHaveBeenCalled();
    container.remove();
  });

  it("返回键之后跟着地址栏变", () => {
    render(<Probe />);
    expect(text("q")).toBe("");
    act(() => {
      window.history.pushState(null, "", "/?q=如花");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    expect(text("q")).toBe("如花");
  });
});

describe("useUrlState：写", () => {
  it("立刻反映在界面上，再写进地址栏", () => {
    vi.useFakeTimers();
    window.history.replaceState(null, "", "/?page=3");
    render(<Probe />);
    act(() => screen.getByText("search").click());
    expect(text("q")).toBe("天下");
    expect(text("page")).toBe("");
    act(() => vi.runAllTimers());
    expect(window.location.search).toBe(
      `?${new URLSearchParams({ q: "天下" })}`,
    );
  });

  it("一次改写里改几个参数，只写一次地址栏", () => {
    vi.useFakeTimers();
    const replace = vi.spyOn(window.history, "replaceState");
    window.history.replaceState(null, "", "/?page=3");
    replace.mockClear();
    render(<Probe />);
    act(() => screen.getByText("search").click());
    act(() => vi.runAllTimers());
    expect(replace).toHaveBeenCalledTimes(1);
  });

  it("连续改写被节流", () => {
    vi.useFakeTimers();
    const replace = vi.spyOn(window.history, "replaceState");
    const { result } = renderHook(() => useUrlState());
    const update = (...args: Parameters<ReturnType<typeof useUrlState>[1]>) =>
      result.current[1](...args);
    // 20 毫秒敲一个字，一共 10 个字，用时 200 毫秒
    for (let i = 1; i <= 10; i++) {
      act(() => update((d) => d.set("q", "字".repeat(i))));
      act(() => vi.advanceTimersByTime(20));
    }
    act(() => vi.runAllTimers());
    expect(result.current[0].get("q")).toBe("字".repeat(10));
    expect(replace.mock.calls.length).toBeLessThanOrEqual(
      Math.ceil(200 / URL_WRITE_INTERVAL_MS) + 1,
    );
    expect(replace.mock.calls.length).toBeLessThan(10);
    expect(new URLSearchParams(window.location.search).get("q")).toBe(
      "字".repeat(10),
    );
  });

  it("history: push 记进浏览历史", () => {
    vi.useFakeTimers();
    const push = vi.spyOn(window.history, "pushState");
    const { result } = renderHook(() => useUrlState());
    const update = (...args: Parameters<ReturnType<typeof useUrlState>[1]>) =>
      result.current[1](...args);
    act(() => update((d) => d.set("tab", "quiz"), { history: "push" }));
    act(() => vi.runAllTimers());
    expect(push).toHaveBeenCalledTimes(1);
  });

  it("flushUrlState 立刻写；跳到别的页面后不再写回来", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useUrlState());
    const update = (...args: Parameters<ReturnType<typeof useUrlState>[1]>) =>
      result.current[1](...args);
    act(() => update((d) => d.set("q", "一")));
    flushUrlState();
    expect(window.location.search).toContain("q=");

    act(() => update((d) => d.set("q", "二")));
    window.history.pushState(null, "", "/song/9");
    act(() => vi.runAllTimers());
    expect(window.location.pathname).toBe("/song/9");
    expect(window.location.search).toBe("");
  });

  it("值没变时不写", () => {
    vi.useFakeTimers();
    const replace = vi.spyOn(window.history, "replaceState");
    const { result } = renderHook(() => useUrlState());
    const update = (...args: Parameters<ReturnType<typeof useUrlState>[1]>) =>
      result.current[1](...args);
    act(() => update((d) => d.delete("q")));
    act(() => vi.runAllTimers());
    expect(replace).not.toHaveBeenCalled();
  });
});
