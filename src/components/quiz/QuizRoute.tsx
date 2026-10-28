"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useMemo } from "react";

export interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

interface Props {
  /** 十二个站名，即各题标题 */
  stations: string[];
  /** 画布（整页）尺寸 */
  width: number;
  height: number;
  /** 启程页文字区域，路线绕着它走 */
  content: Box;
  /** 已启程：路线收成顶部的进度线 */
  departed: boolean;
  /** 当前走到第几站（0 起） */
  current: number;
  /** 悬停「启程」时，起点微微亮起 */
  ready: boolean;
}

interface Point {
  x: number;
  y: number;
}

const EASE = [0.16, 1, 0.3, 1] as const;
const NAV_H = 80;
/** 与 main 的 max-w-2xl px-6 pt-32 对齐：进度线就画在原进度条的位置 */
const MAIN_MAX_W = 672;
const MAIN_PAD_X = 24;
const BAR_Y = 128.5;

const f = (n: number) => n.toFixed(1);

/** 超椭圆上的一点；n 越大越方 */
function superellipse(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  n: number,
  theta: number,
): Point {
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  const e = 2 / n;
  return {
    x: cx + rx * Math.sign(c) * Math.abs(c) ** e,
    y: cy + ry * Math.sign(s) * Math.abs(s) ** e,
  };
}

/**
 * 启程页上的路线：从左下出发，绕过标题上方，到右下结束。
 * 站点按弧长等距取在一条超椭圆上，带一点不对称的起伏，免得像个画框。
 */
function loopStations(
  count: number,
  width: number,
  content: Box,
): { points: Point[]; center: Point; radii: Point } {
  const narrow = width < 640;
  const mx = narrow ? 0 : Math.min(320, width * 0.18);
  const edge = narrow ? 14 : 32;
  const left = Math.max(edge, content.left - mx);
  const right = Math.min(width - edge, content.right + mx);
  const top = Math.max(NAV_H + (narrow ? 40 : 56), content.top - 90);
  const cx = (left + right) / 2;
  const rx = (right - left) / 2;
  // 圆心放在文字中线略下，让两端落到按钮下方
  const cy = content.top + (content.bottom - content.top) * 0.62;
  const ry = cy - top;
  const n = narrow ? 3.4 : 2.1;

  // 起点在左下，终点停在右侧偏下：不对称，免得像一道门
  const from = (136 * Math.PI) / 180;
  const to = (392 * Math.PI) / 180;
  const samples: Point[] = [];
  const lengths: number[] = [0];
  const steps = 600;
  for (let i = 0; i <= steps; i += 1) {
    const theta = from + ((to - from) * i) / steps;
    const p = superellipse(cx, cy, rx, ry, n, theta);
    // 缓缓的起伏，像远处的山脊
    const wobble = 1 + (narrow ? 0.015 : 0.04) * Math.sin(3 * theta + 0.6);
    const q = { x: cx + (p.x - cx) * wobble, y: cy + (p.y - cy) * wobble };
    if (i > 0) {
      const prev = samples[i - 1];
      lengths.push(lengths[i - 1] + Math.hypot(q.x - prev.x, q.y - prev.y));
    }
    samples.push(q);
  }
  const total = lengths[steps];
  const points: Point[] = [];
  let j = 0;
  for (let k = 0; k < count; k += 1) {
    const target = (total * k) / (count - 1);
    while (j < steps && lengths[j + 1] < target) j += 1;
    const span = lengths[j + 1] - lengths[j] || 1;
    const t = Math.min(1, (target - lengths[j]) / span);
    const a = samples[j];
    const b = samples[Math.min(steps, j + 1)];
    points.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
  }
  return { points, center: { x: cx, y: cy }, radii: { x: rx, y: ry } };
}

/** 过各站的平滑曲线（Catmull-Rom 转三次贝塞尔），每段一条 path，方便逐段着色与变形 */
function catmullSegments(points: Point[]): string[] {
  const segs: string[] = [];
  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];
    const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 };
    const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 };
    segs.push(
      `M ${f(p1.x)} ${f(p1.y)} C ${f(c1.x)} ${f(c1.y)} ${f(c2.x)} ${f(c2.y)} ${f(p2.x)} ${f(p2.y)}`,
    );
  }
  return segs;
}

function lineSegments(points: Point[]): string[] {
  const segs: string[] = [];
  for (let i = 0; i < points.length - 1; i += 1) {
    const a = points[i];
    const b = points[i + 1];
    const dx = (b.x - a.x) / 3;
    segs.push(
      `M ${f(a.x)} ${f(a.y)} C ${f(a.x + dx)} ${f(a.y)} ${f(b.x - dx)} ${f(b.y)} ${f(b.x)} ${f(b.y)}`,
    );
  }
  return segs;
}

export default function QuizRoute({
  stations,
  width,
  height,
  content,
  departed,
  current,
  ready,
}: Props) {
  const reduce = useReducedMotion();
  const count = stations.length;

  const loop = useMemo(
    () => loopStations(count, width, content),
    [count, width, content],
  );
  const loopSegs = useMemo(() => catmullSegments(loop.points), [loop]);

  const line = useMemo(() => {
    const mainW = Math.min(width, MAIN_MAX_W);
    const barL = (width - mainW) / 2 + MAIN_PAD_X;
    const barW = mainW - MAIN_PAD_X * 2;
    return Array.from({ length: count }, (_, k) => ({
      x: barL + (barW * k) / (count - 1),
      y: BAR_Y,
    }));
  }, [count, width]);
  const lineSegs = useMemo(() => lineSegments(line), [line]);

  const narrow = width < 640;
  // 站名放在路线外侧；窄屏两侧没有余地，只标首尾和顶上几站
  const labels = loop.points.map((p, k) => {
    const nx = (p.x - loop.center.x) / loop.radii.x ** 2;
    const ny = (p.y - loop.center.y) / loop.radii.y ** 2;
    const len = Math.hypot(nx, ny) || 1;
    const ux = nx / len;
    const uy = ny / len;
    const sideways = Math.abs(ux) > 0.4;
    if (narrow && sideways) {
      // 窄屏首尾站名放在点的正下方，其余侧边站不标
      return {
        x: p.x,
        y: p.y + 10,
        anchor: "middle" as const,
        baseline: "hanging" as const,
        hidden: k !== 0 && k !== count - 1,
      };
    }
    const gap = 14;
    return {
      x: p.x + ux * gap,
      y: p.y + uy * gap,
      anchor:
        ux > 0.4
          ? ("start" as const)
          : ux < -0.4
            ? ("end" as const)
            : ("middle" as const),
      baseline:
        uy < -0.4
          ? ("auto" as const)
          : uy > 0.4
            ? ("hanging" as const)
            : ("central" as const),
      hidden: false,
    };
  });

  const segs = departed ? lineSegs : loopSegs;
  const points = departed ? line : loop.points;
  const morph = { duration: reduce ? 0 : 0.9, ease: EASE };

  return (
    <svg
      aria-hidden
      width={width}
      height={height}
      className="pointer-events-none absolute inset-0 overflow-visible"
    >
      {segs.map((d, k) => {
        const reached = departed && k < current;
        return (
          <motion.path
            key={k}
            fill="none"
            strokeWidth={1}
            strokeLinecap="round"
            className={
              reached
                ? "stroke-[#9A6B2F] dark:stroke-[#D4A259]"
                : departed
                  ? "stroke-slate-200 dark:stroke-slate-800"
                  : "stroke-[#9A6B2F]/35 dark:stroke-[#D4A259]/30"
            }
            initial={reduce ? false : { pathLength: 0, d }}
            animate={{ pathLength: 1, d }}
            transition={{
              pathLength: {
                duration: 0.32,
                delay: 0.5 + k * 0.16,
                ease: "linear",
              },
              d: morph,
            }}
          />
        );
      })}

      {points.map((p, k) => {
        const lit = departed ? k <= current : k === 0;
        return (
          <motion.circle
            key={k}
            strokeWidth={1}
            className={
              lit
                ? "fill-[#9A6B2F] stroke-[#9A6B2F] dark:fill-[#D4A259] dark:stroke-[#D4A259]"
                : departed
                  ? "fill-[#FAFAFA] stroke-slate-300 dark:fill-[#0B0F19] dark:stroke-slate-700"
                  : "fill-[#FAFAFA] stroke-[#9A6B2F]/45 dark:fill-[#0B0F19] dark:stroke-[#D4A259]/40"
            }
            initial={reduce ? false : { opacity: 0, cx: p.x, cy: p.y, r: 2.5 }}
            animate={{
              opacity: 1,
              cx: p.x,
              cy: p.y,
              r: departed ? (k === current ? 2.5 : 1.5) : 2.5,
            }}
            transition={{
              opacity: { duration: 0.4, delay: 0.5 + k * 0.16 },
              cx: morph,
              cy: morph,
              r: morph,
            }}
          />
        );
      })}

      {/* 起点的呼吸光晕：悬停「启程」时更明显 */}
      {!departed && (
        <motion.circle
          cx={loop.points[0].x}
          cy={loop.points[0].y}
          className="fill-none stroke-[#9A6B2F] dark:stroke-[#D4A259]"
          strokeWidth={1}
          initial={{ r: 2.5, opacity: 0 }}
          animate={
            reduce
              ? { r: 6, opacity: ready ? 0.6 : 0.25 }
              : { r: [2.5, ready ? 11 : 8], opacity: [ready ? 0.8 : 0.45, 0] }
          }
          transition={{
            duration: ready ? 1.2 : 2.4,
            repeat: reduce ? 0 : Infinity,
            ease: "easeOut",
            delay: reduce ? 0 : 0.6,
          }}
        />
      )}

      {stations.map((name, k) => {
        const l = labels[k];
        if (l.hidden) return null;
        return (
          <motion.text
            key={name}
            x={l.x}
            y={l.y}
            textAnchor={l.anchor}
            dominantBaseline={l.baseline}
            className={
              k === 0
                ? "fill-[#9A6B2F] font-serif text-[11px] tracking-[0.2em] md:text-xs dark:fill-[#D4A259]"
                : "fill-slate-400 font-serif text-[11px] tracking-[0.2em] md:text-xs dark:fill-slate-600"
            }
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: departed ? 0 : 1 }}
            transition={{
              duration: departed ? 0.25 : 0.6,
              delay: departed || reduce ? 0 : 0.6 + k * 0.16,
            }}
          >
            {name}
          </motion.text>
        );
      })}
    </svg>
  );
}
