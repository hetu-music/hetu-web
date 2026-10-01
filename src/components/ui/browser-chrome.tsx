"use client";

import { useTheme } from "next-themes";
import { useEffect, useSyncExternalStore } from "react";

/**
 * 浏览器状态栏、地址栏的颜色，跟着站内主题和浮层走。
 *
 * - iOS 26 的 Safari 不读 theme-color，而是在屏幕上下沿正中各取一点，顺着往上找 fixed 元素，
 *   拿它的 background-color 涂状态栏、底栏（WebKit LocalFrameView::fixedContainerEdges）。
 *   找不到就让滚出视口的页面内容透到栏下面（fixed 元素伸出视口的部分不会画上去）。
 *   · 那一层或它的祖先带 backdrop-filter，就不取色，直接涂页面底色。顶栏带毛玻璃，所以状态栏平时是页面底色；
 *   · 没有背景、没有模糊、没有子元素的层当它不存在。浮层的遮罩是透明的，会让状态栏一下子透出内容；
 *   · 背景色要能直接读出（rgb、var），Tailwind 的 bg-x/30 编译成 color-mix()，读不到；
 *   · 透明度低于 0.1、高度不超过 10px 的层不算。
 *   所以浮层打开时在贴边处铺一条 12px 高的条（见 EdgeChrome）：它是普通的候选，
 *   Safari 拿它的颜色涂栏。条自己的背景只画在内容区里，而内容区被内边距挤成了 0 高，
 *   所以页面上看不见；Safari 读的是样式，不受影响。
 *   公开页的浮层不压暗页面，只在上沿铺一条页面底色，让状态栏保持原样；底部面板贴着下沿，
 *   底栏自然取到面板的颜色。看图铺满黑底，上下都铺黑条，两条栏跟着变暗。
 * - 其余浏览器（Android 上的 Chrome、Edge、三星浏览器，iOS 18 及以前的 Safari，添加到主屏的 PWA）
 *   读 theme-color。这里把它对齐页面底色，手动切的深浅色也跟上；看图时换成压暗后的颜色。
 */

type Mode = "light" | "dark";
export type ChromeTone = Record<Mode, string> & {
  /** 条的背景色，必须是 Safari 能直接读出的颜色 */
  css: string;
};

// 与 globals.css 的 --background 一致
const PAGE: Record<Mode, string> = { light: "#fafafa", dark: "#0b0f19" };

/** 半透明的黑色盖在 base 上之后的颜色 */
function darken(base: string, alpha: number) {
  return (
    "#" +
    [0, 1, 2]
      .map((i) =>
        Math.round(parseInt(base.slice(1 + i * 2, 3 + i * 2), 16) * (1 - alpha))
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")
  );
}

export const CHROME_TONES = {
  /** 保持页面底色：公开页弹窗、底部面板 */
  page: { ...PAGE, css: "var(--background)" },
  /** 看图的黑底，与 globals.css 的 --scrim-viewer 同值 */
  viewer: {
    light: darken(PAGE.light, 0.8),
    dark: darken(PAGE.dark, 0.8),
    css: "var(--scrim-viewer)",
  },
} satisfies Record<string, ChromeTone>;

// 开着的浮层，后开的在上面
let stack: { tone: ChromeTone }[] = [];
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function topTone() {
  return stack.at(-1)?.tone ?? null;
}

const EDGE_CLASS = {
  top: "top-0",
  bottom: "bottom-0",
};

/**
 * 放在浮层的 Portal 里、排在弹窗之后（要压在最上面才取得到）。
 * 浮层挂着（含退场动画）的这段时间，浏览器栏按 tone 着色
 */
export function EdgeChrome({
  tone,
  edges,
}: {
  tone: ChromeTone;
  edges: (keyof typeof EDGE_CLASS)[];
}) {
  useEffect(() => {
    const entry = { tone };
    stack = [...stack, entry];
    listeners.forEach((l) => l());
    return () => {
      stack = stack.filter((e) => e !== entry);
      listeners.forEach((l) => l());
    };
  }, [tone]);

  return edges.map((edge) => (
    <div
      key={edge}
      aria-hidden
      className={`pointer-events-none fixed inset-x-0 z-60 h-3 pt-3 bg-clip-content ${EDGE_CLASS[edge]}`}
      style={{ backgroundColor: tone.css }}
    />
  ));
}

/** 全站一个，把当前该有的颜色写进 theme-color */
export function BrowserChromeColor() {
  const { resolvedTheme } = useTheme();
  const tone = useSyncExternalStore(subscribe, topTone, () => null);

  useEffect(() => {
    // 主题还没解析出来时保留服务端按系统深浅给的值
    if (!resolvedTheme) return;
    const mode: Mode = resolvedTheme === "dark" ? "dark" : "light";
    const color = (tone ?? PAGE)[mode];
    // 根 layout 按系统深浅各给了一条；站内可以手动切主题，两条一起改
    document
      .querySelectorAll('meta[name="theme-color"]')
      .forEach((meta) => meta.setAttribute("content", color));
  }, [resolvedTheme, tone]);

  return null;
}
