"use client";

import { GRAY_PALETTE } from "@/lib/imagery/palette";
import {
  animate,
  motion,
  useMotionValue,
  useTransform,
  type AnimationPlaybackControls,
} from "framer-motion";
import { useTranslations } from "next-intl";
import { useLayoutEffect, useRef } from "react";
import { CLOUD_EXIT_TOTAL_MS } from "./cloud";

export type CloudView = "motifs" | "words";

/** 换视图要等多久：与词云散开、收拢同长，下划线在这段时间里滑过去 */
export const GLIDE_MS = CLOUD_EXIT_TOTAL_MS;

/** 下划线滑动：前沿先走，后沿晚一点跟上，线先拉长再收拢 */
const LEAD_S = 0.42;
const TRAIL_DELAY_S = 0.18;
const TRAIL_S = 0.48;
const EASE = [0.65, 0, 0.35, 1] as const;
/** 线与字的距离、字后面多出来的字距（tracking-[0.4em]）不算进线长 */
const LINE_GAP_PX = 4;
const TRACKING_EM = 0.4;

export function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * 卷首副标题即视图切换：「312 个母题 · 4006 个具象」，只有「母题」「具象」能点。
 * 写法同筛选栏的「全部 / 自然 / 人文」：当前的字亮起，底下一道细线；
 * 换视图时线滑到另一个词下面。
 */
export default function ViewSwitch({
  active,
  counts,
  onChoose,
  className,
  style,
}: {
  active: CloudView;
  /** 全库的母题数、具象数 */
  counts: Record<CloudView, number>;
  onChoose: (view: CloudView) => void;
  className?: string;
  style?: React.CSSProperties;
}) {
  const t = useTranslations("common.imagery.view");
  const rootRef = useRef<HTMLDivElement>(null);
  const refs = {
    motifs: useRef<HTMLButtonElement>(null),
    words: useRef<HTMLButtonElement>(null),
  };

  // 线的左右两端分开动，才能一端先走、一端后跟
  const left = useMotionValue(0);
  const right = useMotionValue(0);
  const top = useMotionValue(0);
  const width = useTransform(() => right.get() - left.get());
  const opacity = useMotionValue(0);
  const running = useRef<AnimationPlaybackControls[]>([]);
  const placed = useRef<CloudView | null>(null);

  useLayoutEffect(() => {
    const measure = () => {
      const el = refs[active].current;
      if (!el) return null;
      const tracking = parseFloat(getComputedStyle(el).fontSize) * TRACKING_EM;
      // offset* 相对外层，不受卷首浮现动画的 transform 影响
      return {
        l: el.offsetLeft,
        r: el.offsetLeft + el.offsetWidth - tracking,
        y: el.offsetTop + el.offsetHeight + LINE_GAP_PX,
      };
    };
    const place = () => {
      const m = measure();
      if (!m) return;
      running.current.forEach((c) => c.stop());
      left.set(m.l);
      right.set(m.r);
      top.set(m.y);
      opacity.set(0.8);
    };

    const m = measure();
    if (!m) return;
    // 第一次、或要求减少动态效果：直接放好
    if (placed.current === null || prefersReducedMotion()) {
      place();
    } else if (placed.current !== active) {
      running.current.forEach((c) => c.stop());
      const toRight = m.l > left.get();
      const [lead, trail] = toRight ? [right, left] : [left, right];
      const [leadTo, trailTo] = toRight ? [m.r, m.l] : [m.l, m.r];
      top.set(m.y);
      running.current = [
        animate(lead, leadTo, { duration: LEAD_S, ease: EASE }),
        animate(trail, trailTo, {
          duration: TRAIL_S,
          delay: TRAIL_DELAY_S,
          ease: EASE,
        }),
      ];
    }
    placed.current = active;

    // 字体载入、窗口变宽窄时重新对齐，不放动画
    // ResizeObserver 一开始观察就会先回调一次，那一次不算：否则刚开始的滑动会被它直接放到终点
    const root = rootRef.current;
    if (!root) return;
    let size = `${root.offsetWidth}x${root.offsetHeight}`;
    const ro = new ResizeObserver(() => {
      const next = `${root.offsetWidth}x${root.offsetHeight}`;
      if (next === size) return;
      size = next;
      place();
    });
    ro.observe(root);
    return () => ro.disconnect();
    // refs 是稳定的 ref 对象
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, left, right, top, opacity]);

  const option = (view: CloudView) => {
    const on = active === view;
    return (
      <span className="whitespace-nowrap">
        {t("count", { count: counts[view] })}
        <button
          ref={refs[view]}
          type="button"
          aria-pressed={on}
          onClick={() => !on && onChoose(view)}
          className={`transition-colors duration-700 ${
            on
              ? "text-slate-900 dark:text-white"
              : "hover:text-slate-700 dark:hover:text-slate-200"
          }`}
        >
          {t(view)}
        </button>
      </span>
    );
  };

  return (
    <div
      ref={rootRef}
      role="group"
      aria-label={t("label")}
      className={`relative text-slate-400 dark:text-slate-500 ${className ?? ""}`}
      style={style}
    >
      {option("motifs")}
      <span
        aria-hidden
        className="text-slate-300 dark:text-slate-700"
        style={{ marginInline: "1em" }}
      >
        ·
      </span>
      {option("words")}
      <motion.span
        aria-hidden
        className="pointer-events-none absolute left-0 top-0 h-[1.5px]"
        style={{
          x: left,
          y: top,
          width,
          opacity,
          backgroundColor: GRAY_PALETTE.accent,
          boxShadow: `0 1px 10px ${GRAY_PALETTE.accent}22`,
        }}
      />
    </div>
  );
}
