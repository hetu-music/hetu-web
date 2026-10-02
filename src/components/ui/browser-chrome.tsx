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
 *   · 铺满全屏的半透明层算「压暗层」，若这条边原来已有颜色（顶栏、播放条），保留原来的，不跟着变暗；
 *   · 没有背景、没有模糊、没有子元素的层当它不存在（透明遮罩会让状态栏一下子透出内容）；
 *   · 背景色要能直接读出（rgb、var），Tailwind 的 bg-black/80 编译成 color-mix()，读不到；
 *   · 透明度低于 0.1、高度不超过 10px 的层不算。
 *   栏是一整块纯色，换色也不会过渡，跟不上遮罩的淡入淡出，压暗的页面和它总接不齐。所以：
 *   · 窄屏的浮层一律是底部面板：底栏取面板的颜色；遮罩的压暗在顶栏处淡到透明，
 *     又带模糊，状态栏照旧是页面底色。开关面板时两条栏都不变，没有断层（见 ui/drawer）；
 *   · 看图铺满黑底，用 EdgeChrome 在上下沿铺黑条，两条栏跟着变黑；
 *   · 意象页的面板不压暗，遮罩透明，用 EdgeChrome 在上沿铺一条页面底色，状态栏保持原样。
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

/** 半透明的黑色盖在 base 上之后的颜色，即 Safari 涂栏的颜色 */
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
  /** 页面底色 */
  plain: { ...PAGE, css: "var(--background)" },
  /** 看图的黑底，与 globals.css 的 --scrim-viewer 同值 */
  viewer: {
    light: darken(PAGE.light, 0.8),
    dark: darken(PAGE.dark, 0.8),
    css: "var(--scrim-viewer)",
  },
  /** 主页夜展：不论站内主题都是深色，两条栏也跟着深 */
  night: { light: PAGE.dark, dark: PAGE.dark, css: PAGE.dark },
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
 * 浮层挂着（含退场动画）的这段时间，在贴边处铺一条 12px 高的条，浏览器栏按 tone 着色。
 * 条自己的背景只画在内容区里，而内容区被内边距挤成了 0 高，所以页面上看不见；
 * Safari 读的是样式，不受影响
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
