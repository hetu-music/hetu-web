import { flushSync } from "react-dom";

/**
 * 主题切换的圆形扩散动画。
 *
 * 关键点：View Transition 的伪元素（::view-transition-*）并不活在布局视口里，
 * 而是活在 snapshot containing block（SCB）中 —— 它的尺寸是“浏览器 UI 全部收起时”
 * 的视口，原点也随之上移。桌面端两者重合，所以直接用 clientX/clientY 没问题；
 * 但 Android Chrome 的地址栏是可收起的，SCB 的原点比布局视口高出一个地址栏的高度，
 * 于是圆心偏移、半径也算小了。
 *
 * 这里用一个临时探针元素测出两个坐标系的原点差，把点击坐标换算到 SCB 空间再做动画。
 */

const PROBE_NAME = "hetu-vt-probe";
const DURATION = 500;

/** 在视口原点放一个不可见的探针，用于测量 SCB 与布局视口的原点偏移 */
function createProbe(): HTMLElement {
  const probe = document.createElement("div");
  probe.style.cssText =
    "position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;pointer-events:none;";
  probe.style.viewTransitionName = PROBE_NAME;
  document.body.appendChild(probe);
  return probe;
}

function readPseudoStyle(selector: string): CSSStyleDeclaration | null {
  try {
    return getComputedStyle(document.documentElement, selector);
  } catch {
    return null;
  }
}

/**
 * 布局视口原点在 SCB 坐标系中的位置。
 * 探针固定在视口 (0,0)，所以它的 group 变换矩阵的位移量就是所求的偏移。
 * 必须在 transition.ready 之后调用。
 */
function readSnapshotOffset(): { x: number; y: number } {
  const transform = readPseudoStyle(
    `::view-transition-group(${PROBE_NAME})`,
  )?.transform;
  if (!transform || transform === "none") return { x: 0, y: 0 };
  try {
    const matrix = new DOMMatrixReadOnly(transform);
    return { x: matrix.m41, y: matrix.m42 };
  } catch {
    return { x: 0, y: 0 };
  }
}

/** SCB 的尺寸，即 root 快照的尺寸；拿不到时退回视口尺寸 */
function readSnapshotSize(): { width: number; height: number } {
  const styles = readPseudoStyle("::view-transition-group(root)");
  const width = parseFloat(styles?.width ?? "");
  const height = parseFloat(styles?.height ?? "");
  return {
    width: width > 0 ? width : window.innerWidth,
    height: height > 0 ? height : window.innerHeight,
  };
}

/**
 * 以 (x, y)（布局视口坐标，通常来自 MouseEvent.clientX/clientY）为圆心扩散切换主题。
 * 不支持 View Transition 或用户要求减少动效时，直接切换。
 */
export function runThemeTransition(
  x: number,
  y: number,
  applyTheme: () => void,
): void {
  const root = document.documentElement;

  if (
    !document.startViewTransition ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ) {
    applyTheme();
    return;
  }

  const probe = createProbe();

  // 临时禁用过渡效果，避免闪烁
  root.classList.add("no-transitions");

  const transition = document.startViewTransition(() => {
    flushSync(applyTheme);
  });

  transition.finished.finally(() => {
    root.classList.remove("no-transitions");
    probe.remove();
  });

  transition.ready
    .then(() => {
      const offset = readSnapshotOffset();
      const { width, height } = readSnapshotSize();
      const cx = x + offset.x;
      const cy = y + offset.y;
      const endRadius = Math.hypot(
        Math.max(cx, width - cx),
        Math.max(cy, height - cy),
      );

      root.animate(
        {
          clipPath: [
            `circle(0px at ${cx}px ${cy}px)`,
            `circle(${endRadius}px at ${cx}px ${cy}px)`,
          ],
        },
        {
          duration: DURATION,
          easing: "ease-in-out",
          pseudoElement: "::view-transition-new(root)",
        },
      );
    })
    .catch(() => {
      // 过渡被跳过（例如快速连点），保持无动画的即时切换即可
    });
}
