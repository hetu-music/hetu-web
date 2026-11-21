// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { bumpNavDepth, popNavDepth, readNavDepth } from "./nav-depth";

beforeEach(() => sessionStorage.clear());
afterEach(() => vi.unstubAllGlobals());

describe("支持 Navigation API 时", () => {
  it("看上一条历史是不是本站，不看手动记的深度", () => {
    vi.stubGlobal("navigation", { canGoBack: true });
    expect(popNavDepth()).toBe(true);
    vi.stubGlobal("navigation", { canGoBack: false });
    bumpNavDepth();
    expect(popNavDepth()).toBe(false);
  });
});

describe("不支持时退回站内导航深度", () => {
  it("进入内页加一，返回退一层，退到底回主页", () => {
    expect(readNavDepth()).toBe(0);
    bumpNavDepth();
    bumpNavDepth();
    expect(readNavDepth()).toBe(2);
    expect(popNavDepth()).toBe(true);
    expect(popNavDepth()).toBe(true);
    expect(popNavDepth()).toBe(false);
    expect(readNavDepth()).toBe(0);
  });

  it("存的值坏了按 0 算", () => {
    sessionStorage.setItem("__hetu_web_nav_depth", "abc");
    expect(readNavDepth()).toBe(0);
    bumpNavDepth();
    expect(readNavDepth()).toBe(1);
  });
});
