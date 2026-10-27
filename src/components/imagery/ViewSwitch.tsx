"use client";

import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";

export type CloudView = "motifs" | "words";

/** 流星从一个词划到另一个词要多久，到了那个词才亮 */
export const METEOR_MS = 600;
/** 弧线拱起多高 */
const ARC_PX = 18;
/** 头一颗最亮最大，后面几颗依次变小、变淡、晚一点出发，连起来是一截尾巴 */
const TRAIL = [
  { size: 5, opacity: 1 },
  { size: 4, opacity: 0.6 },
  { size: 3.5, opacity: 0.4 },
  { size: 3, opacity: 0.25 },
  { size: 2.5, opacity: 0.12 },
];
const TRAIL_LAG_S = 0.035;

/** 亮着的词：与词云里选中的词同一种光晕，只是不带门类色 */
const LIT_GLOW =
  "0 0 10px rgba(148,163,184,0.55), 0 0 24px rgba(148,163,184,0.28)";

type Point = { x: number; y: number };

export function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * 卷首副标题即视图切换：「母题 · 具象」，当前的那个像夜空里的星一样亮着。
 * 点暗的那个，亮着的熄下去，一颗流星沿浅弧划过去，到了才把它点亮（由父组件在 METEOR_MS 后换视图）。
 */
export default function ViewSwitch({
  lit,
  onChoose,
  className,
  style,
}: {
  /** 亮着的视图；流星在路上时为 null，两个都暗 */
  lit: CloudView | null;
  onChoose: (view: CloudView) => void;
  className?: string;
  style?: React.CSSProperties;
}) {
  const t = useTranslations("common.imagery.view");
  const boxRef = useRef<HTMLDivElement>(null);
  const refs = {
    motifs: useRef<HTMLButtonElement>(null),
    words: useRef<HTMLButtonElement>(null),
  };
  const [flight, setFlight] = useState<{
    from: Point;
    to: Point;
    key: number;
  } | null>(null);

  const centerOf = (view: CloudView): Point | null => {
    const box = boxRef.current?.getBoundingClientRect();
    const r = refs[view].current?.getBoundingClientRect();
    if (!box || !r) return null;
    return {
      x: r.left + r.width / 2 - box.left,
      y: r.top + r.height / 2 - box.top,
    };
  };

  const choose = (view: CloudView) => {
    if (lit === null || view === lit) return;
    const from = centerOf(lit);
    const to = centerOf(view);
    if (from && to && !prefersReducedMotion()) {
      // 每次一个新 key，重新挂载流星，动画从头放
      setFlight((prev) => ({ from, to, key: (prev?.key ?? 0) + 1 }));
    }
    onChoose(view);
  };

  const option = (view: CloudView) => {
    const on = lit === view;
    return (
      <button
        ref={refs[view]}
        type="button"
        aria-pressed={on}
        onClick={() => choose(view)}
        className={`transition-[color,text-shadow] duration-500 ${
          on
            ? "text-slate-800 dark:text-slate-100"
            : "text-slate-400 dark:text-slate-600 hover:text-slate-500 dark:hover:text-slate-400"
        }`}
        style={{ textShadow: on ? LIT_GLOW : "none" }}
      >
        {t(view)}
      </button>
    );
  };

  return (
    <div
      ref={boxRef}
      role="group"
      aria-label={t("label")}
      className={`relative inline-flex items-center ${className ?? ""}`}
      style={{ columnGap: "2.6em", ...style }}
    >
      {option("motifs")}
      {option("words")}
      {flight && (
        <span key={flight.key} aria-hidden className="pointer-events-none">
          {TRAIL.map(({ size, opacity }, i) => {
            const topY = Math.min(flight.from.y, flight.to.y) - ARC_PX;
            const delay = i * TRAIL_LAG_S;
            const duration = METEOR_MS / 1000;
            return (
              <motion.span
                key={i}
                className="absolute left-0 top-0 rounded-full bg-slate-500 dark:bg-white"
                style={{
                  width: size,
                  height: size,
                  marginLeft: -size / 2,
                  marginTop: -size / 2,
                  boxShadow:
                    i === 0 ? "0 0 6px 2px rgba(148,163,184,0.65)" : undefined,
                }}
                initial={{ x: flight.from.x, y: flight.from.y, opacity: 0 }}
                animate={{
                  x: flight.to.x,
                  y: [flight.from.y, topY, flight.to.y],
                  opacity: [0, opacity, opacity, 0],
                }}
                // 横向一口气划过去；纵向先升后落，成一道弧；起落时淡入淡出
                transition={{
                  x: { duration, delay, ease: [0.45, 0, 0.25, 1] },
                  y: {
                    duration,
                    delay,
                    times: [0, 0.5, 1],
                    ease: ["easeOut", "easeIn"],
                  },
                  opacity: {
                    duration,
                    delay,
                    times: [0, 0.15, 0.75, 1],
                    ease: "linear",
                  },
                }}
              />
            );
          })}
        </span>
      )}
    </div>
  );
}
