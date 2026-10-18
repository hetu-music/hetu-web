// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { copyPageLink, sharePage } from "./share";

function stubNavigator(nav: Partial<Navigator>) {
  vi.stubGlobal("navigator", { ...navigator, ...nav });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("sharePage", () => {
  it("有系统分享时调用它，并带上当前地址", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    stubNavigator({ share });
    await expect(sharePage({ title: "t", text: "x" })).resolves.toBe("shared");
    expect(share).toHaveBeenCalledWith({
      title: "t",
      text: "x",
      url: window.location.href,
    });
  });

  it("用户取消分享返回 cancelled", async () => {
    stubNavigator({ share: vi.fn().mockRejectedValue(new Error("abort")) });
    await expect(sharePage({ title: "t" })).resolves.toBe("cancelled");
  });

  it("没有系统分享时复制链接", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    stubNavigator({
      share: undefined,
      clipboard: { writeText } as unknown as Clipboard,
    });
    await expect(sharePage({ title: "t" })).resolves.toBe("copied");
    expect(writeText).toHaveBeenCalledWith(window.location.href);
  });
});

describe("copyPageLink", () => {
  it("剪贴板不可用时返回 failed", async () => {
    stubNavigator({
      clipboard: {
        writeText: vi.fn().mockRejectedValue(new Error("denied")),
      } as unknown as Clipboard,
    });
    await expect(copyPageLink()).resolves.toBe("failed");
  });
});
