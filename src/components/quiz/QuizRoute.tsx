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
  /** 启程页文字区域：站点和站名避开它，线可以从文字后面穿过 */
  content: Box;
  /** 已启程：路线收进顶部进度条的位置，随后淡出 */
  departed: boolean;
  /** 悬停「启程」时，起点微微亮起 */
  ready: boolean;
}

interface Point {
  x: number;
  y: number;
}

/** 路线的途经点，按画面比例给出；station 为站序，其余点只用来塑形 */
interface Waypoint {
  x: number;
  y: number;
  station?: number;
}

const EASE = [0.16, 1, 0.3, 1] as const;
/** 与 main 的 max-w-2xl px-6 pt-32 对齐：收拢后正好落在进度条上 */
const MAIN_MAX_W = 672;
const MAIN_PAD_X = 24;
const BAR_Y = 128.5;
/** 相邻两站之间再细分几段三次曲线，变形成直线时才平滑 */
const SUB = 4;

/**
 * 宽屏：从左下出发，沿左侧上行，到歧路后转向，从「寻曲」背后斜穿过去，
 * 登上右上的山行，沿右侧下来，在回望处打一个圈，最后飘向下方的浮生。
 */
const WIDE: Waypoint[] = [
  { x: 0.1, y: 0.86, station: 0 },
  { x: 0.15, y: 0.68, station: 1 },
  { x: 0.16, y: 0.48, station: 2 },
  { x: 0.24, y: 0.28, station: 3 },
  { x: 0.34, y: 0.23 },
  { x: 0.45, y: 0.33 },
  { x: 0.57, y: 0.47 },
  { x: 0.68, y: 0.55, station: 4 },
  { x: 0.76, y: 0.42, station: 5 },
  { x: 0.8, y: 0.23, station: 6 },
  { x: 0.87, y: 0.19 },
  { x: 0.91, y: 0.33, station: 7 },
  { x: 0.89, y: 0.5, station: 8 },
  { x: 0.83, y: 0.64, station: 9 },
  { x: 0.79, y: 0.73 },
  { x: 0.745, y: 0.775 },
  { x: 0.715, y: 0.73, station: 10 },
  { x: 0.74, y: 0.695 },
  { x: 0.765, y: 0.74 },
  { x: 0.75, y: 0.82 },
  { x: 0.71, y: 0.9, station: 11 },
];

/**
 * 窄屏：沿左侧上行，从「寻曲」背后横穿到右侧，绕上顶部，
 * 在顶上打一个圈回望，最后向左上飘去。
 */
const NARROW: Waypoint[] = [
  { x: 0.16, y: 0.92, station: 0 },
  { x: 0.07, y: 0.79, station: 1 },
  { x: 0.05, y: 0.64, station: 2 },
  { x: 0.08, y: 0.47, station: 3 },
  { x: 0.3, y: 0.44 },
  { x: 0.7, y: 0.39 },
  { x: 0.94, y: 0.36, station: 4 },
  { x: 0.92, y: 0.24, station: 5 },
  { x: 0.8, y: 0.16, station: 6 },
  { x: 0.64, y: 0.13, station: 7 },
  { x: 0.52, y: 0.155, station: 8 },
  { x: 0.46, y: 0.215, station: 9 },
  { x: 0.39, y: 0.255 },
  { x: 0.31, y: 0.25 },
  { x: 0.275, y: 0.21, station: 10 },
  { x: 0.31, y: 0.175 },
  { x: 0.37, y: 0.195 },
  { x: 0.36, y: 0.25 },
  { x: 0.25, y: 0.285 },
  { x: 0.09, y: 0.24, station: 11 },
];

const f = (n: number) => n.toFixed(1);

/** 向心 Catmull-Rom：过每个途经点，转弯处不会打结 */
function catmullRom(points: Point[], perSegment: number): Point[] {
  const ext = [
    {
      x: 2 * points[0].x - points[1].x,
      y: 2 * points[0].y - points[1].y,
    },
    ...points,
    {
      x: 2 * points[points.length - 1].x - points[points.length - 2].x,
      y: 2 * points[points.length - 1].y - points[points.length - 2].y,
    },
  ];
  const knot = (a: Point, b: Point) =>
    Math.max(1e-4, Math.hypot(b.x - a.x, b.y - a.y) ** 0.5);
  const lerp = (a: Point, b: Point, ta: number, tb: number, t: number) => {
    const u = (t - ta) / (tb - ta);
    return { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u };
  };
  const out: Point[] = [points[0]];
  for (let i = 0; i < points.length - 1; i += 1) {
    const [p0, p1, p2, p3] = ext.slice(i, i + 4);
    const t0 = 0;
    const t1 = t0 + knot(p0, p1);
    const t2 = t1 + knot(p1, p2);
    const t3 = t2 + knot(p2, p3);
    for (let s = 1; s <= perSegment; s += 1) {
      const t = t1 + ((t2 - t1) * s) / perSegment;
      const a1 = lerp(p0, p1, t0, t1, t);
      const a2 = lerp(p1, p2, t1, t2, t);
      const a3 = lerp(p2, p3, t2, t3, t);
      const b1 = lerp(a1, a2, t0, t2, t);
      const b2 = lerp(a2, a3, t1, t3, t);
      out.push(lerp(b1, b2, t1, t2, t));
    }
  }
  return out;
}

interface Route {
  /** 整条路线：SUB × 段数 条三次曲线 */
  d: string;
  stations: Point[];
  /** 各站处的单位切向 */
  tangents: Point[];
}

/** 按途经点画出路线，并在相邻两站之间等弧长细分成三次曲线 */
function buildRoute(waypoints: Waypoint[], width: number, height: number) {
  const span = Math.min(width, 1600);
  const pts = waypoints.map((w) => ({
    x: width / 2 + (w.x - 0.5) * span,
    y: w.y * height,
  }));
  const PER = 24;
  const dense = catmullRom(pts, PER);
  const lengths = [0];
  for (let i = 1; i < dense.length; i += 1) {
    lengths.push(
      lengths[i - 1] +
        Math.hypot(dense[i].x - dense[i - 1].x, dense[i].y - dense[i - 1].y),
    );
  }
  const at = (s: number) => {
    let j = 0;
    while (j < dense.length - 2 && lengths[j + 1] < s) j += 1;
    const a = dense[j];
    const b = dense[j + 1];
    const len = lengths[j + 1] - lengths[j] || 1;
    const u = Math.min(1, Math.max(0, (s - lengths[j]) / len));
    return {
      p: { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u },
      t: { x: (b.x - a.x) / len, y: (b.y - a.y) / len },
    };
  };
  const stationArcs = waypoints.flatMap((w, i) =>
    w.station === undefined ? [] : [lengths[i * PER]],
  );

  const parts: string[] = [];
  const stations: Point[] = [];
  const tangents: Point[] = [];
  for (let k = 0; k < stationArcs.length; k += 1) {
    const here = at(stationArcs[k]);
    stations.push(here.p);
    tangents.push(here.t);
    if (k === stationArcs.length - 1) break;
    for (let q = 0; q < SUB; q += 1) {
      const s0 =
        stationArcs[k] + ((stationArcs[k + 1] - stationArcs[k]) * q) / SUB;
      const s1 =
        stationArcs[k] +
        ((stationArcs[k + 1] - stationArcs[k]) * (q + 1)) / SUB;
      const a = at(s0);
      const b = at(s1);
      const h = (s1 - s0) / 3;
      if (parts.length === 0) parts.push(`M ${f(a.p.x)} ${f(a.p.y)}`);
      parts.push(
        `C ${f(a.p.x + a.t.x * h)} ${f(a.p.y + a.t.y * h)} ${f(b.p.x - b.t.x * h)} ${f(b.p.y - b.t.y * h)} ${f(b.p.x)} ${f(b.p.y)}`,
      );
    }
  }
  return { d: parts.join(" "), stations, tangents } satisfies Route;
}

/** 同样结构的直线：收拢时逐段变形到进度条上 */
function buildBar(count: number, width: number) {
  const mainW = Math.min(width, MAIN_MAX_W);
  const barL = (width - mainW) / 2 + MAIN_PAD_X;
  const barW = mainW - MAIN_PAD_X * 2;
  const pieces = (count - 1) * SUB;
  const x = (i: number) => barL + (barW * i) / pieces;
  const parts = [`M ${f(x(0))} ${f(BAR_Y)}`];
  for (let i = 0; i < pieces; i += 1) {
    const a = x(i);
    const b = x(i + 1);
    const h = (b - a) / 3;
    parts.push(
      `C ${f(a + h)} ${f(BAR_Y)} ${f(b - h)} ${f(BAR_Y)} ${f(b)} ${f(BAR_Y)}`,
    );
  }
  return {
    d: parts.join(" "),
    stations: Array.from({ length: count }, (_, k) => ({
      x: x(k * SUB),
      y: BAR_Y,
    })),
  };
}

const intersects = (a: Box, b: Box) =>
  a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;

export default function QuizRoute({
  stations,
  width,
  height,
  content,
  departed,
  ready,
}: Props) {
  const reduce = useReducedMotion();
  const count = stations.length;
  const narrow = width < 640;

  const route = useMemo(
    () => buildRoute(narrow ? NARROW : WIDE, width, height),
    [narrow, width, height],
  );
  const bar = useMemo(() => buildBar(count, width), [count, width]);

  // 站名放在切线的法向一侧，朝远离文字中心的方向；和文字区域重叠的站名不显示
  const labels = useMemo(() => {
    const cx = (content.left + content.right) / 2;
    const cy = (content.top + content.bottom) / 2;
    const guard: Box = {
      left: content.left - 8,
      top: content.top - 8,
      right: content.right + 8,
      bottom: content.bottom + 8,
    };
    return route.stations.map((p, k) => {
      const t = route.tangents[k];
      let nx = -t.y;
      let ny = t.x;
      if (nx * (p.x - cx) + ny * (p.y - cy) < 0) {
        nx = -nx;
        ny = -ny;
      }
      const gap = 12;
      const x = p.x + nx * gap;
      const y = p.y + ny * gap;
      const anchor =
        nx > 0.45
          ? ("start" as const)
          : nx < -0.45
            ? ("end" as const)
            : ("middle" as const);
      const baseline =
        ny < -0.45
          ? ("auto" as const)
          : ny > 0.45
            ? ("hanging" as const)
            : ("central" as const);
      const w = stations[k].length * 16;
      const left =
        anchor === "start" ? x : anchor === "end" ? x - w : x - w / 2;
      const top =
        baseline === "auto" ? y - 14 : baseline === "hanging" ? y : y - 7;
      const rect = { left, top, right: left + w, bottom: top + 14 };
      const hidden =
        intersects(rect, guard) || rect.left < 4 || rect.right > width - 4;
      return { x, y, anchor, baseline, hidden };
    });
  }, [route, content, stations, width]);

  const points = departed ? bar.stations : route.stations;
  const morph = { duration: reduce ? 0 : 0.9, ease: EASE };
  /** 整条线画完所需时间 */
  const drawDuration = 2.4;

  return (
    <svg
      aria-hidden
      width={width}
      height={height}
      className="pointer-events-none absolute inset-0 overflow-visible"
    >
      <motion.g
        initial={false}
        animate={{ opacity: departed ? 0 : 1 }}
        transition={{
          duration: departed ? 0.3 : 0.2,
          delay: departed && !reduce ? 0.75 : 0,
        }}
      >
        <motion.path
          fill="none"
          strokeWidth={1}
          strokeLinecap="round"
          className={
            departed
              ? "stroke-slate-200 dark:stroke-slate-800"
              : "stroke-[#9A6B2F]/35 dark:stroke-[#D4A259]/30"
          }
          initial={reduce ? false : { pathLength: 0, d: route.d }}
          animate={{ pathLength: 1, d: departed ? bar.d : route.d }}
          transition={{
            pathLength: {
              duration: drawDuration,
              delay: 0.4,
              ease: "easeInOut",
            },
            d: morph,
          }}
        />

        {/* 一点光沿路线缓缓走过 */}
        {!departed && !reduce && (
          <motion.path
            d={route.d}
            fill="none"
            strokeWidth={1.5}
            strokeLinecap="round"
            pathLength={1}
            strokeDasharray="0.04 1"
            className="stroke-[#9A6B2F] dark:stroke-[#D4A259]"
            initial={{ strokeDashoffset: 0.04, opacity: 0 }}
            animate={{ strokeDashoffset: -1, opacity: [0, 0.9, 0.9, 0] }}
            transition={{
              duration: 10,
              delay: drawDuration + 0.8,
              repeat: Infinity,
              repeatDelay: 3,
              ease: "easeInOut",
              opacity: {
                duration: 10,
                delay: drawDuration + 0.8,
                repeat: Infinity,
                repeatDelay: 3,
                times: [0, 0.08, 0.92, 1],
              },
            }}
          />
        )}

        {points.map((p, k) => (
          <motion.circle
            key={k}
            strokeWidth={1}
            className={
              k === 0
                ? "fill-[#9A6B2F] stroke-[#9A6B2F] dark:fill-[#D4A259] dark:stroke-[#D4A259]"
                : "fill-[#FAFAFA] stroke-[#9A6B2F]/45 dark:fill-[#0B0F19] dark:stroke-[#D4A259]/40"
            }
            initial={reduce ? false : { opacity: 0, cx: p.x, cy: p.y, r: 2.5 }}
            animate={{ opacity: 1, cx: p.x, cy: p.y, r: departed ? 0 : 2.5 }}
            transition={{
              opacity: {
                duration: 0.4,
                delay: 0.4 + (drawDuration * k) / (count - 1),
              },
              cx: morph,
              cy: morph,
              r: morph,
            }}
          />
        ))}

        {/* 起点的呼吸光晕：悬停「启程」时更明显 */}
        {!departed && (
          <motion.circle
            cx={route.stations[0].x}
            cy={route.stations[0].y}
            className="fill-none stroke-[#9A6B2F] dark:stroke-[#D4A259]"
            strokeWidth={1}
            initial={{ r: 2.5, opacity: 0 }}
            animate={
              reduce
                ? { r: 6, opacity: ready ? 0.6 : 0.25 }
                : {
                    r: [2.5, ready ? 11 : 8],
                    opacity: [ready ? 0.8 : 0.45, 0],
                  }
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
                delay:
                  departed || reduce
                    ? 0
                    : 0.5 + (drawDuration * k) / (count - 1),
              }}
            >
              {name}
            </motion.text>
          );
        })}
      </motion.g>
    </svg>
  );
}
