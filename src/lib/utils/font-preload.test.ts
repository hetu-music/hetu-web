// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SPLIT_FONT_STYLESHEETS } from "@/lib/split-fonts";

// stylesReady 是模块级缓存，每个用例重新载入模块，免得互相影响
async function load() {
  vi.resetModules();
  return import("./font-preload");
}

function splitFontLinks() {
  return [
    ...document.head.querySelectorAll<HTMLLinkElement>(
      'link[rel="stylesheet"]',
    ),
  ].filter((link) =>
    SPLIT_FONT_STYLESHEETS.includes(link.getAttribute("href") ?? ""),
  );
}

function fire(type: "load" | "error") {
  for (const link of splitFontLinks()) link.dispatchEvent(new Event(type));
}

function stubFonts(fonts: Partial<FontFaceSet> | undefined) {
  Object.defineProperty(document, "fonts", {
    value: fonts,
    configurable: true,
  });
}

beforeEach(() => {
  document.head.innerHTML = "";
  document.documentElement.removeAttribute("style");
});

afterEach(() => {
  stubFonts(undefined);
});

describe("ensureSplitFontStyles", () => {
  it("每张表挂一个 link，全部载入后才 resolve", async () => {
    const { ensureSplitFontStyles } = await load();
    let done = false;
    const ready = ensureSplitFontStyles().then(() => {
      done = true;
    });

    expect(splitFontLinks().map((link) => link.getAttribute("href"))).toEqual(
      SPLIT_FONT_STYLESHEETS,
    );
    await Promise.resolve();
    expect(done).toBe(false);

    fire("load");
    await ready;
    expect(done).toBe(true);
  });

  it("载入失败也 resolve，不卡住调用方", async () => {
    const { ensureSplitFontStyles } = await load();
    const ready = ensureSplitFontStyles();
    fire("error");
    await expect(ready).resolves.toBeUndefined();
  });

  it("重复调用只挂一次", async () => {
    const { ensureSplitFontStyles } = await load();
    const first = ensureSplitFontStyles();
    expect(ensureSplitFontStyles()).toBe(first);
    expect(splitFontLinks()).toHaveLength(SPLIT_FONT_STYLESHEETS.length);
  });

  it("页面上已有的 link 不再新建；已载入的不用等", async () => {
    const [loadedHref, pendingHref] = SPLIT_FONT_STYLESHEETS;
    const loaded = document.createElement("link");
    loaded.rel = "stylesheet";
    loaded.href = loadedHref;
    Object.defineProperty(loaded, "sheet", { value: {} });
    const pending = document.createElement("link");
    pending.rel = "stylesheet";
    pending.href = pendingHref;
    document.head.append(loaded, pending);

    const { ensureSplitFontStyles } = await load();
    const ready = ensureSplitFontStyles();

    expect(splitFontLinks()).toHaveLength(SPLIT_FONT_STYLESHEETS.length);
    expect(
      splitFontLinks().filter((l) => l === loaded || l === pending),
    ).toHaveLength(2);

    // 只派发给还没载入的，已载入的那张若也在等，ready 就永远不会 resolve
    for (const link of splitFontLinks()) {
      if (link !== loaded) link.dispatchEvent(new Event("load"));
    }
    await expect(ready).resolves.toBeUndefined();
  });
});

describe("preloadFontText", () => {
  it("浏览器没有 document.fonts.load 时直接返回，不挂样式表", async () => {
    const { preloadFontText } = await load();
    await preloadFontText([{ cssVar: "--font-serif", text: "河图" }]);
    expect(splitFontLinks()).toHaveLength(0);
  });

  it("等样式表就绪后，按字体栈里的字体逐个加载", async () => {
    const fontsLoad = vi
      .fn()
      .mockResolvedValueOnce([])
      .mockRejectedValueOnce(new Error("blocked"))
      .mockResolvedValue([]);
    stubFonts({ load: fontsLoad });
    document.documentElement.style.setProperty(
      "--font-serif",
      `"Hetu Keben", 'Songti SC', serif`,
    );
    document.documentElement.style.setProperty("--font-kaiti", "Hetu KaiTi,");

    const { preloadFontText } = await load();
    const done = preloadFontText([
      { cssVar: "--font-serif", text: "河图" },
      { cssVar: "--font-kaiti", text: "洛书" },
    ]);

    await Promise.resolve();
    expect(fontsLoad).not.toHaveBeenCalled();

    fire("load");
    // 单个字体加载失败不影响整体
    await expect(done).resolves.toBeUndefined();
    expect(fontsLoad.mock.calls).toEqual([
      ['16px "Hetu Keben"', "河图"],
      ['16px "Songti SC"', "河图"],
      ['16px "serif"', "河图"],
      ['16px "Hetu KaiTi"', "洛书"],
    ]);
  });
});
