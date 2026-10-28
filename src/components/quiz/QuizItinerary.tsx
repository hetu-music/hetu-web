"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { Box } from "./QuizRoute";

interface Props {
  /** 十二个站名，即各题标题 */
  stations: string[];
  /** 画布（整页）尺寸 */
  width: number;
  height: number;
  /** 启程页里给行程表留出的位置：线画在它的顶边，站名竖排挂在线下 */
  anchor: Box;
  /** 已启程：线收进顶部进度条的位置，随后淡出 */
  departed: boolean;
  /** 悬停「启程」时，第一程亮起 */
  ready: boolean;
}

const EASE = [0.16, 1, 0.3, 1] as const;
/** 与 main 的 max-w-2xl px-6 pt-32 对齐：收拢后正好落在进度条上 */
const MAIN_MAX_W = 672;
const MAIN_PAD_X = 24;
const BAR_Y = 128.5;

const f = (n: number) => n.toFixed(1);

/**
 * 启程页的行程表：一条横贯全页的细线，十二站等距排开，站名竖排挂在线下。
 * 线向两侧延伸并淡出，路在这一程之外还有。启程时站名依次落下，
 * 线收短、上移，正好落在题目进度条上。
 */
export default function QuizItinerary({
  stations,
  width,
  height,
  anchor,
  departed,
  ready,
}: Props) {
  const reduce = useReducedMotion();
  const count = stations.length;
  const y = Math.round(anchor.top) + 0.5;
  const step = (anchor.right - anchor.left) / count;
  const xs = stations.map((_, k) => anchor.left + step * (k + 0.5));
  const first = xs[0];
  const last = xs[count - 1];

  const mainW = Math.min(width, MAIN_MAX_W);
  const barL = (width - mainW) / 2 + MAIN_PAD_X;
  const barR = barL + mainW - MAIN_PAD_X * 2;
  const barX = (k: number) => barL + ((barR - barL) * k) / (count - 1);

  const lineD = departed
    ? `M ${f(barL)} ${f(BAR_Y)} L ${f(barR)} ${f(BAR_Y)}`
    : `M ${f(first)} ${f(y)} L ${f(last)} ${f(y)}`;
  const firstLegD = departed
    ? `M ${f(barL)} ${f(BAR_Y)} L ${f(barL + (barR - barL) / count)} ${f(BAR_Y)}`
    : `M ${f(first)} ${f(y)} L ${f(xs[1])} ${f(y)}`;
  const morph = { duration: reduce ? 0 : 0.6, ease: EASE };
  const appear = (k: number) => (reduce ? 0 : 0.5 + k * 0.07);

  return (
    <motion.div
      aria-hidden
      className="pointer-events-none absolute inset-0"
      initial={false}
      animate={{ opacity: departed ? 0 : 1 }}
      transition={{
        duration: departed ? 0.3 : 0.2,
        delay: departed && !reduce ? 0.45 : 0,
      }}
    >
      <svg
        width={width}
        height={height}
        className="absolute inset-0 overflow-visible text-slate-300 dark:text-slate-700"
      >
        <defs>
          <linearGradient id="quiz-itinerary-left" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stopColor="currentColor" stopOpacity="0" />
            <stop offset="1" stopColor="currentColor" />
          </linearGradient>
          <linearGradient id="quiz-itinerary-right" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stopColor="currentColor" />
            <stop offset="1" stopColor="currentColor" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* 两端延伸的路：这一程之外还有路 */}
        <motion.g
          initial={reduce ? false : { opacity: 0 }}
          animate={{ opacity: departed ? 0 : 1 }}
          transition={{
            duration: departed ? 0.25 : 1.2,
            delay: departed || reduce ? 0 : 1.2,
          }}
        >
          <rect
            x={Math.max(0, first - 240)}
            y={y - 0.5}
            width={first - Math.max(0, first - 240)}
            height={1}
            fill="url(#quiz-itinerary-left)"
          />
          <rect
            x={last}
            y={y - 0.5}
            width={Math.min(width, last + 240) - last}
            height={1}
            fill="url(#quiz-itinerary-right)"
          />
        </motion.g>

        <motion.path
          fill="none"
          stroke="currentColor"
          strokeWidth={1}
          initial={reduce ? false : { pathLength: 0, d: lineD }}
          animate={{ pathLength: 1, d: lineD }}
          transition={{
            pathLength: { duration: 1.1, delay: 0.3, ease: EASE },
            d: morph,
          }}
        />

        {/* 第一程：悬停「启程」时亮起，启程后成为进度条的第一段 */}
        <motion.path
          fill="none"
          strokeWidth={1}
          className="stroke-[#9A6B2F] dark:stroke-[#D4A259]"
          initial={false}
          animate={{ d: firstLegD, pathLength: ready || departed ? 1 : 0 }}
          transition={{
            d: morph,
            pathLength: { duration: reduce ? 0 : 0.6, ease: EASE },
          }}
        />

        {xs.map((x, k) => (
          <motion.circle
            key={k}
            strokeWidth={1}
            className={
              k === 0
                ? "fill-[#9A6B2F] stroke-[#9A6B2F] dark:fill-[#D4A259] dark:stroke-[#D4A259]"
                : "fill-[#FAFAFA] stroke-slate-300 dark:fill-[#0B0F19] dark:stroke-slate-700"
            }
            initial={reduce ? false : { opacity: 0, r: 2, cx: x, cy: y }}
            animate={{
              opacity: 1,
              r: departed ? 0 : 2,
              cx: departed ? barX(k) : x,
              cy: departed ? BAR_Y : y,
            }}
            transition={{
              opacity: { duration: 0.4, delay: appear(k) },
              r: morph,
              cx: morph,
              cy: morph,
            }}
          />
        ))}

        {/* 起点的呼吸光晕：悬停「启程」时更明显 */}
        {!departed && !reduce && (
          <motion.circle
            cx={first}
            cy={y}
            fill="none"
            strokeWidth={1}
            className="stroke-[#9A6B2F] dark:stroke-[#D4A259]"
            initial={{ r: 2, opacity: 0 }}
            animate={{
              r: [2, ready ? 10 : 7],
              opacity: [ready ? 0.8 : 0.4, 0],
            }}
            transition={{
              duration: ready ? 1.2 : 2.4,
              repeat: Infinity,
              ease: "easeOut",
              delay: 1.4,
            }}
          />
        )}
      </svg>

      {stations.map((name, k) => (
        <motion.span
          key={name}
          className={
            k === 0
              ? "absolute font-serif text-xs tracking-[0.3em] md:text-sm text-[#9A6B2F] [writing-mode:vertical-rl] dark:text-[#D4A259]"
              : "absolute font-serif text-xs tracking-[0.3em] md:text-sm text-slate-400 [writing-mode:vertical-rl] dark:text-slate-500"
          }
          style={{ left: xs[k], top: y + 12, x: "-50%" }}
          initial={reduce ? false : { opacity: 0, y: -6 }}
          animate={departed ? { opacity: 0, y: 14 } : { opacity: 1, y: 0 }}
          transition={
            departed
              ? {
                  duration: 0.22,
                  delay: reduce ? 0 : k * 0.012,
                  ease: "easeIn",
                }
              : { duration: 0.6, delay: appear(k), ease: EASE }
          }
        >
          {name}
        </motion.span>
      ))}
    </motion.div>
  );
}
