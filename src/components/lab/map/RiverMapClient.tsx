"use client";

/**
 * 水系图原型：不画底图，只画河。地点是河上的站，选中后只留同一首歌到过的地方，
 * 其余退下去，词句竖排在左栏。窄屏改成从入海口往上读的目录。
 */

import TopBar from "@/components/shared/topbar/TopBar";
import { useMediaQuery } from "@/hooks/ui/useMediaQuery";
import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  GROUPS,
  RIVERS,
  SEAS,
  STOPS,
  TREE,
  VIEW,
  type River,
  type Stop,
  type TreeNode,
} from "./data";

const EASE = [0.23, 1, 0.32, 1] as const;
const FONT = 17;
const CHAR_STEP = 18;
const TICK = 8;
const LABEL_GAP = 13;
const DRAW_SECONDS = 1.8;

const STOP_BY_ID = new Map(STOPS.map((s) => [s.id, s]));
const RIVER_BY_ID = new Map(RIVERS.map((r) => [r.id, r]));
const SONG_COUNT = new Set(STOPS.flatMap((s) => s.entries.map((e) => e.song)))
  .size;

/**
 * 不用 framer 的 useReducedMotion：它在首屏就读浏览器设置，与服务端渲染的属性对不上。
 * 这里水合时先按服务端的结果走，之后只把动画时长归零。
 */
function useReduce(): boolean {
  return useMediaQuery("(prefers-reduced-motion: reduce)");
}

/** 折角倒圆，像线路图而不是折线图 */
function roundedPath(pts: [number, number][], radius = 16): string {
  let d = `M ${pts[0][0]} ${pts[0][1]}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const [x, y] = pts[i];
    const [px, py] = pts[i - 1];
    const [nx, ny] = pts[i + 1];
    const inLen = Math.hypot(x - px, y - py);
    const outLen = Math.hypot(nx - x, ny - y);
    const r = Math.min(radius, inLen / 2, outLen / 2);
    const ax = x - ((x - px) / inLen) * r;
    const ay = y - ((y - py) / inLen) * r;
    const bx = x + ((nx - x) / outLen) * r;
    const by = y + ((ny - y) / outLen) * r;
    d += ` L ${ax} ${ay} Q ${x} ${y} ${bx} ${by}`;
  }
  const last = pts[pts.length - 1];
  return `${d} L ${last[0]} ${last[1]}`;
}

/** 站点在入场动画里出现的时刻：跟着河水从河口往上走到它 */
function stopDelay(stop: Stop): number {
  const river = RIVER_BY_ID.get(stop.river);
  if (!river) return 0;
  let total = 0;
  let toStop = 0;
  let found = false;
  for (let i = 1; i < river.pts.length; i++) {
    const [ax, ay] = river.pts[i - 1];
    const [bx, by] = river.pts[i];
    const len = Math.hypot(bx - ax, by - ay);
    total += len;
    if (found) continue;
    const along = Math.hypot(stop.x - ax, stop.y - ay);
    const off = Math.abs((bx - ax) * (stop.y - ay) - (by - ay) * (stop.x - ax));
    if (off / (len || 1) < 2 && along <= len + 1) {
      toStop += along;
      found = true;
    } else {
      toStop += len;
    }
  }
  return river.delay + (toStop / (total || 1)) * DRAW_SECONDS;
}

function songsOf(stop: Stop): string[] {
  return stop.entries.map((e) => e.song);
}

/** 同一首歌到过的其他地方，按表里的次序 */
function siblingsOf(stop: Stop): Stop[] {
  const songs = new Set(songsOf(stop));
  return STOPS.filter(
    (s) => s.id !== stop.id && s.entries.some((e) => songs.has(e.song)),
  );
}

/** 窄屏行尾的地区：省不写，只剩地名本身时才退回写省 */
function shortRegion(stop: Stop): string {
  const parts = stop.region.split(" · ");
  const rest = parts.slice(1).filter((p) => p !== stop.name);
  return rest.length > 0 ? rest.join(" · ") : parts[0];
}

/** 引句按句读切开，每个短语一列，句读不再占位 */
function phrases(line: string): string[] {
  return line.split(/[，。、！？\s]+/).filter(Boolean);
}

function RiverLine({ river, dimmed }: { river: River; dimmed: boolean }) {
  const reduce = useReduce();
  const d = roundedPath(river.pts);
  const n = river.pts.length;
  const [lx, ly] = river.pts[n - 1];
  const [px, py] = river.pts[n - 2];
  const segLen = Math.hypot(lx - px, ly - py);
  const t = river.fade ? Math.min(1, river.fade / segLen) : 0;
  const gradId = `river-${river.id}`;
  const fades = Boolean(river.fade || river.fadeBoth);
  const [fx, fy] = river.pts[0];
  // 虚线靠 dasharray 成形，pathLength 动画会把它冲掉，只能淡入
  const drawable = !river.dashed;

  return (
    <g
      className="transition-opacity duration-500"
      style={{ opacity: dimmed ? 0.3 : 1 }}
    >
      {fades && (
        <defs>
          {river.fadeBoth ? (
            <linearGradient
              id={gradId}
              gradientUnits="userSpaceOnUse"
              x1={fx}
              y1={fy}
              x2={lx}
              y2={ly}
            >
              <stop
                offset="0"
                style={{ stopColor: "var(--river)", stopOpacity: 0 }}
              />
              <stop offset="0.14" style={{ stopColor: "var(--river)" }} />
              <stop offset="0.86" style={{ stopColor: "var(--river)" }} />
              <stop
                offset="1"
                style={{ stopColor: "var(--river)", stopOpacity: 0 }}
              />
            </linearGradient>
          ) : (
            <linearGradient
              id={gradId}
              gradientUnits="userSpaceOnUse"
              x1={lx + (px - lx) * t}
              y1={ly + (py - ly) * t}
              x2={lx}
              y2={ly}
            >
              <stop offset="0" style={{ stopColor: "var(--river)" }} />
              <stop
                offset="1"
                style={{ stopColor: "var(--river)", stopOpacity: 0 }}
              />
            </linearGradient>
          )}
        </defs>
      )}
      <motion.path
        d={d}
        fill="none"
        stroke={fades ? `url(#${gradId})` : "var(--river)"}
        strokeWidth={river.width}
        strokeLinecap={river.id === "dongting" ? "butt" : "round"}
        strokeDasharray={river.dashed ? "2 6" : undefined}
        opacity={river.id === "dongting" ? 0.35 : 1}
        initial={drawable ? { pathLength: 0 } : { opacity: 0 }}
        animate={
          drawable
            ? { pathLength: 1 }
            : { opacity: river.id === "dongting" ? 0.35 : 1 }
        }
        transition={{
          duration: reduce ? 0 : DRAW_SECONDS,
          delay: reduce ? 0 : river.delay,
          ease: EASE,
        }}
      />
    </g>
  );
}

function StackedText({
  text,
  x,
  y,
  className,
  size = 15,
}: {
  text: string;
  x: number;
  y: number;
  className: string;
  size?: number;
}) {
  return (
    <g className={className} style={{ fontSize: size }}>
      {[...text].map((ch, i) => (
        <text key={i} x={x} y={y + i * (size + 1)} textAnchor="middle">
          {ch}
        </text>
      ))}
    </g>
  );
}

function RiverName({ river, dimmed }: { river: River; dimmed: boolean }) {
  const label = river.label;
  if (!label) return null;
  const opacity = dimmed ? 0.25 : 0.85;
  if (label.vertical) {
    return (
      <g className="transition-opacity duration-500" style={{ opacity }}>
        <StackedText
          text={river.name}
          x={label.x}
          y={label.y}
          className="fill-(--river) font-sans"
        />
      </g>
    );
  }
  return (
    <text
      x={label.x}
      y={label.y}
      className={
        label.large
          ? "fill-(--river) font-calligraphy transition-opacity duration-500"
          : "fill-(--river) font-sans tracking-[0.2em] transition-opacity duration-500"
      }
      style={{ fontSize: label.large ? 32 : 15, opacity }}
    >
      {river.name}
    </text>
  );
}

function StopMark({
  stop,
  state,
  onEnter,
  onLeave,
  onPick,
}: {
  stop: Stop;
  state: "rest" | "dim" | "kin" | "current";
  onEnter: () => void;
  onLeave: () => void;
  onPick: () => void;
}) {
  const reduce = useReduce();
  const { x, y, side, name } = stop;
  const len = [...name].length;
  const horizontal = side === "l" || side === "r";
  const dir = side === "l" || side === "a" ? -1 : 1;
  const textWidth = len * FONT;
  const textHeight = len * CHAR_STEP;
  const hit = horizontal
    ? {
        x: dir > 0 ? x - 6 : x - LABEL_GAP - textWidth - 4,
        y: y - 14,
        width: LABEL_GAP + textWidth + 10,
        height: 28,
      }
    : {
        x: x - 14,
        y: dir > 0 ? y - 6 : y - LABEL_GAP - textHeight - 4,
        width: 28,
        height: LABEL_GAP + textHeight + 10,
      };
  const lit = state === "current" || state === "kin";

  return (
    <motion.g
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{
        duration: reduce ? 0 : 0.7,
        delay: reduce ? 0 : stopDelay(stop),
      }}
    >
      <g
        role="button"
        tabIndex={0}
        aria-label={`${stop.full ?? name}，${songsOf(stop).join("、")}`}
        aria-pressed={state === "current"}
        className="group cursor-pointer outline-none transition-opacity duration-500"
        style={{ opacity: state === "dim" ? 0.22 : 1 }}
        onPointerEnter={(e) => e.pointerType === "mouse" && onEnter()}
        onPointerLeave={(e) => e.pointerType === "mouse" && onLeave()}
        onFocus={onEnter}
        onBlur={onLeave}
        onClick={(e) => {
          e.stopPropagation();
          onPick();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onPick();
          }
        }}
      >
        <rect {...hit} fill="transparent" />
        <line
          x1={x}
          y1={y}
          x2={horizontal ? x + dir * TICK : x}
          y2={horizontal ? y : y + dir * TICK}
          strokeWidth={lit ? 2.4 : 1.6}
          strokeLinecap="round"
          className={
            lit
              ? "stroke-(--accent)"
              : "stroke-(--river) group-hover:stroke-(--accent) group-focus-visible:stroke-(--accent)"
          }
        />
        {horizontal ? (
          <text
            x={x + dir * LABEL_GAP}
            y={y + 6}
            textAnchor={dir > 0 ? "start" : "end"}
            className={labelClass(state)}
            style={{ fontSize: FONT }}
          >
            {name}
          </text>
        ) : (
          <g className={labelClass(state)} style={{ fontSize: FONT }}>
            {[...name].map((ch, i) => (
              <text
                key={i}
                x={x}
                textAnchor="middle"
                y={
                  dir > 0
                    ? y + LABEL_GAP + FONT - 2 + i * CHAR_STEP
                    : y - LABEL_GAP - 3 - (len - 1 - i) * CHAR_STEP
                }
              >
                {ch}
              </text>
            ))}
          </g>
        )}
      </g>
    </motion.g>
  );
}

function labelClass(state: "rest" | "dim" | "kin" | "current"): string {
  const base = "font-serif transition-colors duration-300";
  if (state === "current") return `${base} fill-(--accent) font-bold`;
  if (state === "kin") return `${base} fill-(--accent)`;
  return `${base} fill-slate-700 dark:fill-slate-300 group-hover:fill-(--accent) group-focus-visible:fill-(--accent)`;
}

/** 同一首歌的地点之间牵一条弧线，隔着水系也连得上 */
function Thread({ from, to }: { from: Stop; to: Stop }) {
  const reduce = useReduce();
  const [a, b] = from.y <= to.y ? [from, to] : [to, from];
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dist = Math.hypot(dx, dy) || 1;
  // 同一条河上的近邻贴着河走，免得压到对岸的地名；隔得远才拉开
  const bulge = dist < 140 ? dist * 0.1 : Math.min(70, dist * 0.24);
  const cx = (a.x + b.x) / 2 + (dy / dist) * bulge;
  const cy = (a.y + b.y) / 2 - (dx / dist) * bulge;
  return (
    <motion.path
      d={`M ${a.x} ${a.y} Q ${cx} ${cy} ${b.x} ${b.y}`}
      fill="none"
      stroke="var(--accent)"
      strokeWidth={1.6}
      strokeLinecap="round"
      initial={{ pathLength: 0, opacity: 0.9 }}
      animate={{ pathLength: 1, opacity: 0.9 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reduce ? 0 : 0.7, ease: EASE }}
    />
  );
}

function Verse({ line, size }: { line: string; size: "lg" | "md" }) {
  return (
    <div
      className={
        size === "lg"
          ? "font-kaiti text-[1.7rem] leading-[1.45] tracking-[0.12em] text-slate-800 dark:text-slate-100"
          : "font-kaiti text-[1.35rem] leading-[1.45] tracking-[0.1em] text-slate-800 dark:text-slate-100"
      }
    >
      {phrases(line).map((p, i) => (
        <div key={i}>{p}</div>
      ))}
    </div>
  );
}

function StopBody({
  stop,
  onGo,
  size,
}: {
  stop: Stop;
  onGo: (id: string) => void;
  size: "lg" | "md";
}) {
  const sibs = siblingsOf(stop);
  return (
    <>
      <div className="flex max-h-[min(30rem,52svh)] flex-row-reverse justify-end gap-x-8 overflow-hidden">
        {stop.entries.map((entry) => (
          <div
            key={entry.song}
            className="flex flex-col flex-wrap-reverse gap-x-3 [writing-mode:vertical-rl]"
          >
            {entry.lines.map((line) => (
              <Verse key={line} line={line} size={size} />
            ))}
          </div>
        ))}
      </div>
      <div className="mt-8 space-y-3">
        {stop.entries.map((entry) => (
          <div key={entry.song}>
            <p className="font-serif text-base text-slate-900 dark:text-slate-50">
              《{entry.song}》
            </p>
            {entry.note && (
              <p className="mt-1 font-kaiti text-sm leading-relaxed text-slate-500 dark:text-slate-400">
                {entry.note}
              </p>
            )}
          </div>
        ))}
        {sibs.length > 0 && (
          <p className="pt-2 text-xs leading-loose tracking-widest text-slate-400 dark:text-slate-500">
            同一首歌还到过
            {sibs.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onGo(s.id);
                }}
                className="ml-2 text-(--accent) hover:underline"
              >
                {s.name}
              </button>
            ))}
          </p>
        )}
      </div>
    </>
  );
}

/** 窄屏：一行一站，点开就地展开 */
function TreeRows({
  nodes,
  openId,
  kin,
  onToggle,
  onGo,
}: {
  nodes: TreeNode[];
  openId: string | null;
  kin: Set<string>;
  onToggle: (id: string) => void;
  onGo: (id: string) => void;
}) {
  return (
    <ul className="border-l border-(--river)/50">
      {nodes.map((node) => {
        if (typeof node !== "string") {
          return (
            <li key={node.river} className="relative py-3 pl-6">
              <span
                aria-hidden
                className="absolute top-[1.35rem] left-0 h-px w-5 bg-(--river)/50"
              />
              <p className="mb-2 text-xs tracking-[0.3em] text-(--river)">
                {node.river}
              </p>
              <TreeRows
                nodes={node.nodes}
                openId={openId}
                kin={kin}
                onToggle={onToggle}
                onGo={onGo}
              />
            </li>
          );
        }
        const stop = STOP_BY_ID.get(node);
        if (!stop) return null;
        const open = openId === node;
        const lit = open || kin.has(node);
        return (
          <li key={node} id={`stop-${node}`} className="relative scroll-mt-24">
            <span
              aria-hidden
              className={`absolute top-[1.3rem] left-0 h-px w-2.5 ${lit ? "bg-(--accent)" : "bg-(--river)"}`}
            />
            <button
              type="button"
              aria-expanded={open}
              onClick={() => onToggle(node)}
              className="flex min-h-11 w-full items-baseline justify-between gap-4 py-2 pl-5 text-left"
            >
              <span
                className={`font-serif text-[1.05rem] transition-colors ${lit ? "text-(--accent)" : "text-slate-800 dark:text-slate-200"}`}
              >
                {stop.name}
              </span>
              <span className="shrink-0 text-[0.7rem] tracking-wider text-slate-400 dark:text-slate-500">
                {shortRegion(stop)}
              </span>
            </button>
            <div
              className={`grid transition-[grid-template-rows] duration-500 ease-page ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
            >
              <div className="min-h-0 overflow-hidden">
                {open && (
                  <div className="pt-3 pb-8 pl-5">
                    <StopBody stop={stop} onGo={onGo} size="md" />
                  </div>
                )}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export default function RiverMapClient() {
  const reduce = useReduce();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const selected = selectedId ? (STOP_BY_ID.get(selectedId) ?? null) : null;
  const shown = hoverId ? (STOP_BY_ID.get(hoverId) ?? null) : selected;

  const kin = useMemo(
    () => new Set(selected ? siblingsOf(selected).map((s) => s.id) : []),
    [selected],
  );

  const threads = useMemo(() => {
    if (!selected) return [];
    const pairs: { key: string; from: Stop; to: Stop }[] = [];
    for (const song of songsOf(selected)) {
      const places = STOPS.filter((s) =>
        s.entries.some((e) => e.song === song),
      );
      for (let i = 1; i < places.length; i++) {
        pairs.push({
          key: `${song}-${places[i - 1].id}-${places[i].id}`,
          from: places[i - 1],
          to: places[i],
        });
      }
    }
    return pairs;
  }, [selected]);

  const toggle = useCallback((id: string) => {
    setSelectedId((cur) => (cur === id ? null : id));
  }, []);

  const go = useCallback((id: string) => {
    setSelectedId(id);
    setHoverId(null);
    // 窄屏目录里跳到那一站；宽屏这一行不显示，滚动不起作用
    requestAnimationFrame(() => {
      document
        .getElementById(`stop-${id}`)
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelectedId(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const dimmed = selected !== null;

  return (
    <div className="min-h-svh bg-[#FAFAFA] [--accent:#b5452c] [--river:#394c7f] dark:bg-[#0B0F19] dark:[--accent:#ee9f7e] dark:[--river:#7f93c9]">
      <TopBar exit={{ kind: "logo" }} />

      {/* 宽屏：左栏读词，右边看河 */}
      <div className="hidden pt-20 lg:grid lg:grid-cols-[minmax(19rem,23vw)_minmax(0,1fr)]">
        <aside className="sticky top-20 flex h-[calc(100svh-5rem)] flex-col justify-end self-start px-10 pb-12 xl:px-14">
          <AnimatePresence mode="wait" initial={false}>
            {shown ? (
              <motion.div
                key={shown.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.28, ease: EASE }}
              >
                <p className="text-xs tracking-[0.3em] text-slate-400 dark:text-slate-500">
                  {shown.region}
                </p>
                <h2 className="mt-3 mb-10 font-serif text-4xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
                  {shown.full ?? shown.name}
                </h2>
                <StopBody stop={shown} onGo={go} size="lg" />
              </motion.div>
            ) : (
              <motion.div
                key="intro"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.28, ease: EASE }}
              >
                <h1 className="font-calligraphy text-8xl leading-none text-slate-900 [writing-mode:vertical-rl] dark:text-slate-50">
                  河图
                </h1>
                <p className="mt-10 font-kaiti text-lg leading-loose text-slate-600 dark:text-slate-400">
                  歌里写到的地方，
                  <br />
                  顺着水都能找到。
                </p>
                <p className="mt-6 text-xs tracking-[0.25em] text-slate-400 dark:text-slate-500">
                  {STOPS.length} 处 · {SONG_COUNT} 首
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </aside>

        <main
          className="flex min-w-0 items-start justify-center"
          onClick={() => setSelectedId(null)}
        >
          {/* 入场动画在水合时就按「不减弱」开始了，读到设置后整张图重挂一次，直接落到终态 */}
          <svg
            key={reduce ? "still" : "draw"}
            viewBox={`0 0 ${VIEW.width} ${VIEW.height}`}
            role="group"
            aria-label="河图水系图"
            className="block h-auto max-h-[calc(100svh-5rem)] min-h-[44rem] w-full select-none"
          >
            {GROUPS.map((g) => (
              <g
                key={g.name}
                className="transition-opacity duration-500"
                style={{ opacity: dimmed ? 0.06 : 0.16 }}
              >
                <StackedText
                  text={g.name}
                  x={g.x}
                  y={g.y}
                  size={40}
                  className="fill-slate-900 font-calligraphy dark:fill-slate-100"
                />
              </g>
            ))}
            {SEAS.map((s) => (
              <g
                key={s.name}
                className="transition-opacity duration-500"
                style={{ opacity: dimmed ? 0.25 : 0.7 }}
              >
                <StackedText
                  text={s.name}
                  x={s.x}
                  y={s.y}
                  className="fill-(--river) font-sans"
                />
              </g>
            ))}
            {RIVERS.map((r) => (
              <RiverLine key={r.id} river={r} dimmed={dimmed} />
            ))}
            {RIVERS.map((r) => (
              <RiverName key={r.id} river={r} dimmed={dimmed} />
            ))}
            <AnimatePresence>
              {threads.map((t) => (
                <Thread key={t.key} from={t.from} to={t.to} />
              ))}
            </AnimatePresence>
            {STOPS.map((s) => (
              <StopMark
                key={s.id}
                stop={s}
                state={
                  selected?.id === s.id
                    ? "current"
                    : kin.has(s.id)
                      ? "kin"
                      : selected
                        ? "dim"
                        : "rest"
                }
                onEnter={() => setHoverId(s.id)}
                onLeave={() => setHoverId((cur) => (cur === s.id ? null : cur))}
                onPick={() => toggle(s.id)}
              />
            ))}
          </svg>
        </main>
      </div>

      {/* 窄屏：从入海口往上读 */}
      <main className="px-6 pt-32 pb-24 lg:hidden">
        <h1 className="font-calligraphy text-7xl leading-none text-slate-900 [writing-mode:vertical-rl] dark:text-slate-50">
          河图
        </h1>
        <p className="mt-8 font-kaiti text-lg leading-loose text-slate-600 dark:text-slate-400">
          歌里写到的地方，顺着水都能找到。
        </p>
        <p className="mt-3 text-xs tracking-[0.25em] text-slate-400 dark:text-slate-500">
          {STOPS.length} 处 · {SONG_COUNT} 首
        </p>
        <div className="mt-16 space-y-14">
          {TREE.map((section) => (
            <section key={section.river}>
              <h2 className="mb-4 font-calligraphy text-3xl text-(--river)">
                {section.river}
              </h2>
              <TreeRows
                nodes={section.nodes}
                openId={selectedId}
                kin={kin}
                onToggle={toggle}
                onGo={go}
              />
            </section>
          ))}
        </div>
      </main>
    </div>
  );
}
