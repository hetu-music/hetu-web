// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { bumpNavDepth, popNavDepth, readNavDepth } from "./nav-depth";

beforeEach(() => sessionStorage.clear());

describe("站内导航深度", () => {
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
