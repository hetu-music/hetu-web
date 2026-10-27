"use client";

import { GRAY_PALETTE } from "@/lib/imagery/palette";
import {
  animate,
  motion,
  useMotionValue,
  useTransform,
  type AnimationPlaybackControls,
  type MotionValue,
} from "framer-motion";
import { useTranslations } from "next-intl";
import { useLayoutEffect, useRef } from "react";
import { CLOUD_EXIT_TOTAL_MS } from "./cloud";

export type CloudView = "motifs" | "words";

/** 换视图要等多久：与词云散开、收拢同长，下划线在这段时间里换到另一个词下面 */
export const GLIDE_MS = CLOUD_EXIT_TOTAL_MS;

/**
 * 下划线换位，仿 Windows 11 导航栏的选中指示条：两个词各有一条线，各自裁在自己的格子里，
 * 不越过中间的空隙。旧线朝新词的方向拉长、从格子边上溜出去；新线从靠旧词那一侧钻进来，
 * 再收拢到字底下。两端都是一快一慢，像橡皮筋。
 *
 * 节奏跟着词云走：旧线与旧词云一同离场，新线在新词云开始展开时钻进来
 */
const EXIT_S = CLOUD_EXIT_TOTAL_MS / 1000;
const ENTER_DELAY_S = CLOUD_EXIT_TOTAL_MS / 1000;
const ENTER_S = 0.55;
const easeLead = (t: number) => Math.sin((t * Math.PI) / 2);
const easeTrail = (t: number) => 1 - Math.cos((t * Math.PI) / 2);
/** 格子比字左右各宽这么多，线在里面伸缩；字后面多出来的字距（tracking-[0.4em]）不算 */
const PAD_EM = 0.6;
const TRACKING_EM = 0.4;

const ORDER: CloudView[] = ["motifs", "words"];

export function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

type Edges = { l: MotionValue<number>; r: MotionValue<number> };

function Line({ edges }: { edges: Edges }) {
  const width = useTransform(() => edges.r.get() - edges.l.get());
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute overflow-hidden"
      // 格子：比字左右各宽 PAD_EM，右边扣掉字距
      style={{
        left: `-${PAD_EM}em`,
        width: `calc(100% + ${2 * PAD_EM - TRACKING_EM}em)`,
        top: "calc(100% + 1px)",
        height: 12,
      }}
    >
      <motion.span
        className="absolute left-0 h-[1.5px] rounded-full"
        style={{
          top: 3,
          x: edges.l,
          width,
          opacity: 0.8,
          backgroundColor: GRAY_PALETTE.accent,
          boxShadow: `0 1px 10px ${GRAY_PALETTE.accent}22`,
        }}
      />
    </span>
  );
}

/**
 * 卷首副标题即视图切换：「312 个母题 · 4006 个具象」，只有「母题」「具象」能点。
 * 写法同筛选栏的「全部 / 自然 / 人文」：当前的字亮起，底下一道细线。
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
  // 每条线的左右两端，坐标从各自格子的左边算起
  const edges: Record<CloudView, Edges> = {
    motifs: { l: useMotionValue(0), r: useMotionValue(0) },
    words: { l: useMotionValue(0), r: useMotionValue(0) },
  };
  const running = useRef<AnimationPlaybackControls[]>([]);
  const placed = useRef<CloudView | null>(null);

  useLayoutEffect(() => {
    /** 字宽（不含字距）与格子边距，px */
    const measure = (view: CloudView) => {
      const el = refs[view].current;
      if (!el) return null;
      const em = parseFloat(getComputedStyle(el).fontSize);
      const pad = em * PAD_EM;
      const w = el.offsetWidth - em * TRACKING_EM;
      return { pad, w, slot: w + 2 * pad };
    };
    const stop = () => {
      running.current.forEach((c) => c.stop());
      running.current = [];
    };
    // 当前的线停在字底下，另一条收成零长
    const place = () => {
      stop();
      for (const view of ORDER) {
        const m = measure(view);
        if (!m) continue;
        const on = view === active;
        edges[view].l.set(on ? m.pad : 0);
        edges[view].r.set(on ? m.pad + m.w : 0);
      }
    };

    const from = placed.current;
    if (from === null || from === active || prefersReducedMotion()) {
      place();
    } else {
      const a = measure(from);
      const b = measure(active);
      if (a && b) {
        stop();
        const old = edges[from];
        const next = edges[active];
        const toRight = ORDER.indexOf(active) > ORDER.indexOf(from);
        // 旧线：朝新词那边，前沿冲到格子边，后沿追过去，整条溜出格子
        const exitEdge = toRight ? a.slot : 0;
        const [oldLead, oldTrail] = toRight ? [old.r, old.l] : [old.l, old.r];
        // 新线：从靠旧词那一侧的格子边钻进来，前沿先到位，后沿再收拢
        const enterEdge = toRight ? 0 : b.slot;
        next.l.set(enterEdge);
        next.r.set(enterEdge);
        const [newLead, newTrail] = toRight
          ? [next.r, next.l]
          : [next.l, next.r];
        const [leadTo, trailTo] = toRight
          ? [b.pad + b.w, b.pad]
          : [b.pad, b.pad + b.w];
        const enter = { duration: ENTER_S, delay: ENTER_DELAY_S };
        running.current = [
          animate(oldLead, exitEdge, { duration: EXIT_S, ease: easeLead }),
          animate(oldTrail, exitEdge, { duration: EXIT_S, ease: easeTrail }),
          animate(newLead, leadTo, { ...enter, ease: easeLead }),
          animate(newTrail, trailTo, { ...enter, ease: easeTrail }),
        ];
      } else {
        place();
      }
    }
    placed.current = active;

    // 字体载入、窗口变宽窄时重新对齐，不放动画。
    // ResizeObserver 一开始观察就会先回调一次，那一次不算，否则刚开始的动画会被它直接放到终点
    const root = rootRef.current;
    if (!root) return;
    let size = `${root.offsetWidth}x${root.offsetHeight}`;
    const ro = new ResizeObserver(() => {
      const nextSize = `${root.offsetWidth}x${root.offsetHeight}`;
      if (nextSize === size) return;
      size = nextSize;
      place();
    });
    ro.observe(root);
    return () => ro.disconnect();
    // refs、edges 里都是稳定的 ref 与 motion value
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

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
          className={`relative transition-colors duration-700 ${
            on
              ? "text-slate-900 dark:text-white"
              : "hover:text-slate-700 dark:hover:text-slate-200"
          }`}
        >
          {t(view)}
          <Line edges={edges[view]} />
        </button>
      </span>
    );
  };

  return (
    <div
      ref={rootRef}
      role="group"
      aria-label={t("label")}
      className={`text-slate-400 dark:text-slate-500 ${className ?? ""}`}
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
    </div>
  );
}
