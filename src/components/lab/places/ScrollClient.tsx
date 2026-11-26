"use client";

/**
 * 方案二：溯洄横卷 · 平远水墨长卷（/lab/places/scroll）
 *
 * 依中国传统手卷「自右向左」展阅：
 * - 卷首在最右（东海入海口），滚轮向下或拖拽即向左「溯洄」展卷，
 *   历经「沧海东望 → 赣水楚天 → 潇湘烟雨 → 沅陵深谷 → 关山雪域」五段景致；
 * - 三远法多层水墨视差（远山 / 中景墨峦与烟岚 / 主水脉与地标），全程直接操作 DOM 变换，零掉帧；
 * - 45 处地点在 5400px 画卷中尽数舒展，彻底化解湖南密集区拥挤问题；
 * - 选中某处时在山水留白处浮现「画上题诗」竖排词句，同曲地点间牵朱砂长弧，点同曲地名即沿卷平滑飞渡。
 */

import TopBar from "@/components/shared/topbar/TopBar";
import { useMediaQuery } from "@/hooks/ui/useMediaQuery";
import type { Place } from "@/lib/places/types";
import { AnimatePresence, motion } from "framer-motion";
import { useTranslations } from "next-intl";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { MountainSilhouette, OrganicRiver } from "./atlas-data";
import {
  FAR_MOUNTAINS,
  MID_MOUNTAINS,
  SCROLL_CHAPTERS,
  SCROLL_H,
  SCROLL_INSCRIPTIONS,
  SCROLL_RIVERS,
  SCROLL_STOPS,
  SCROLL_W,
  type ScrollStop,
} from "./scroll-data";
import {
  LabModeNav,
  PlaceGlyph,
  PlaceReadingBody,
  SealStamp,
  brushRiverPath,
  glyphOf,
  inkMountainPath,
  splineCenterPath,
} from "./shared";

const EASE = [0.23, 1, 0.32, 1] as const;

function songsOf(place: Place): Set<number> {
  return new Set(place.entries.map((e) => e.songId));
}

function ScrollMountain({ m }: { m: MountainSilhouette }) {
  const fillPath = useMemo(() => inkMountainPath(m.ridge, m.baseY), [m]);
  const ridgePath = useMemo(() => splineCenterPath(m.ridge, 10), [m]);
  return (
    <g opacity={m.opacity}>
      <path d={fillPath} fill={`url(#scroll-mtn-${m.tone})`} />
      <path
        d={ridgePath}
        fill="none"
        stroke={`var(--mtn-${m.tone})`}
        strokeWidth={0.9}
        strokeLinecap="round"
        opacity={0.5}
      />
    </g>
  );
}

function ScrollRiver({
  river,
  dimmed,
}: {
  river: OrganicRiver;
  dimmed: boolean;
}) {
  const body = useMemo(
    () =>
      brushRiverPath(river.pts, river.mouthWidth, river.sourceWidth ?? 0.8, {
        bothTaper: river.bothTaper,
        subdivisions: 12,
      }),
    [river],
  );
  const center = useMemo(() => splineCenterPath(river.pts, 12), [river]);
  const ripple = useMemo(
    () =>
      river.rippleOffset
        ? splineCenterPath(river.pts, 12, river.rippleOffset)
        : null,
    [river],
  );
  const ripple2 = useMemo(
    () =>
      river.rippleOffset
        ? splineCenterPath(river.pts, 12, -river.rippleOffset * 0.82)
        : null,
    [river],
  );

  return (
    <g
      className="transition-opacity duration-500"
      style={{ opacity: dimmed ? 0.3 : 1 }}
    >
      {river.dashed ? (
        <path
          d={center}
          fill="none"
          stroke="var(--river)"
          strokeWidth={1.6}
          strokeDasharray="4 6"
          strokeLinecap="round"
          opacity={0.62}
        />
      ) : (
        <>
          <path
            d={body}
            fill="var(--river-wash)"
            opacity={0.22}
            transform="translate(0, 1.6)"
          />
          <path d={body} fill="var(--river)" opacity={0.88} />
          {ripple && (
            <path
              d={ripple}
              fill="none"
              stroke="var(--river-wash)"
              strokeWidth={0.8}
              strokeDasharray="20 14 8 14"
              strokeLinecap="round"
              opacity={0.35}
            />
          )}
          {ripple2 && (
            <path
              d={ripple2}
              fill="none"
              stroke="var(--river-wash)"
              strokeWidth={0.7}
              strokeDasharray="12 18 24 14"
              strokeLinecap="round"
              opacity={0.26}
            />
          )}
        </>
      )}

      {river.label && (
        <text
          x={river.label.x}
          y={river.label.y}
          className={
            river.label.large
              ? "fill-(--river) font-calligraphy"
              : "fill-(--river) font-serif tracking-[0.26em]"
          }
          style={{ fontSize: river.label.large ? 28 : 13, opacity: 0.7 }}
        >
          {river.name}
        </text>
      )}
    </g>
  );
}

function ScrollMarker({
  stop,
  place,
  state,
  onEnter,
  onLeave,
  onPick,
}: {
  stop: ScrollStop;
  place: Place;
  state: "rest" | "dim" | "kin" | "current";
  onEnter: () => void;
  onLeave: () => void;
  onPick: () => void;
}) {
  const { x, y, dir, vertical } = stop;
  const name = place.name;
  const chars = [...name];
  const fontSize = 15.5;
  const gap = 13;
  const active = state === "current";
  const kin = state === "kin";
  const lit = active || kin;

  const textClass = active
    ? "fill-(--seal) font-serif font-bold transition-colors duration-300"
    : kin
      ? "fill-(--seal) font-serif transition-colors duration-300"
      : "fill-(--ink) font-serif transition-colors duration-300 group-hover:fill-(--seal)";

  const renderLabel = () => {
    if (vertical) {
      const step = fontSize + 1.5;
      const startY =
        dir === "a"
          ? y - gap - 4 - (chars.length - 1) * step
          : y + gap + fontSize - 2;
      return (
        <g className={textClass} style={{ fontSize }}>
          {chars.map((ch, i) => (
            <text key={i} x={x} y={startY + i * step} textAnchor="middle">
              {ch}
            </text>
          ))}
        </g>
      );
    }
    if (dir === "a") {
      return (
        <text
          x={x}
          y={y - gap - 3}
          textAnchor="middle"
          className={textClass}
          style={{ fontSize }}
        >
          {name}
        </text>
      );
    }
    if (dir === "b") {
      return (
        <text
          x={x}
          y={y + gap + fontSize - 2}
          textAnchor="middle"
          className={textClass}
          style={{ fontSize }}
        >
          {name}
        </text>
      );
    }
    return (
      <text
        x={dir === "r" ? x + gap : x - gap}
        y={y + fontSize * 0.35}
        textAnchor={dir === "r" ? "start" : "end"}
        className={textClass}
        style={{ fontSize }}
      >
        {name}
      </text>
    );
  };

  return (
    <g
      role="button"
      tabIndex={0}
      aria-label={place.fullName ?? name}
      aria-pressed={active}
      className="group cursor-pointer outline-none transition-opacity duration-500"
      style={{ opacity: state === "dim" ? 0.24 : 1 }}
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
      <circle cx={x} cy={y} r={22} fill="transparent" />
      <PlaceGlyph
        kind={glyphOf(place.id)}
        x={x}
        y={y}
        active={active}
        kin={kin}
        scale={lit ? 1.18 : 1.02}
      />
      {renderLabel()}
    </g>
  );
}

/** 东海入海口浪纹 */
const EAST_SEA_WAVES = [
  { x: 5015, y: 315, scale: 1.1 },
  { x: 5055, y: 425, scale: 1.25 },
  { x: 5005, y: 555, scale: 1.15 },
  { x: 5045, y: 675, scale: 1.0 },
];

export default function ScrollClient({ places }: { places: Place[] }) {
  const t = useTranslations("places");
  const reduce = useMediaQuery("(prefers-reduced-motion: reduce)");
  const scrollerRef = useRef<HTMLDivElement>(null);
  const farLayerRef = useRef<SVGGElement>(null);
  const midLayerRef = useRef<SVGGElement>(null);
  const thumbRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    active: boolean;
    startX: number;
    startScroll: number;
    moved: boolean;
  }>({ active: false, startX: 0, startScroll: 0, moved: false });

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [hoverId, setHoverId] = useState<number | null>(null);
  const [activeChapterId, setActiveChapterId] = useState<string>("east");
  const [canvasSize, setCanvasSize] = useState<{ w: number; h: number }>({
    w: SCROLL_W,
    h: SCROLL_H,
  });
  const initializedRef = useRef(false);

  const placeById = useMemo(
    () => new Map(places.map((p) => [p.id, p])),
    [places],
  );
  const stopById = useMemo(
    () => new Map(SCROLL_STOPS.map((s) => [s.id, s])),
    [],
  );
  const songCount = useMemo(
    () => new Set(places.flatMap((p) => [...songsOf(p)])).size,
    [places],
  );

  const siblingsOf = useCallback(
    (place: Place) => {
      const songs = songsOf(place);
      return places.filter(
        (p) => p.id !== place.id && p.entries.some((e) => songs.has(e.songId)),
      );
    },
    [places],
  );

  const selected = selectedId ? (placeById.get(selectedId) ?? null) : null;
  const hoverPlace = hoverId ? (placeById.get(hoverId) ?? null) : null;
  const kin = useMemo(
    () => new Set(selected ? siblingsOf(selected).map((p) => p.id) : []),
    [selected, siblingsOf],
  );

  /** 同曲朱砂飞虹：跨越山川连起同一首歌到过的各处 */
  const threads = useMemo(() => {
    if (!selected) return [];
    const pairs: { key: string; from: ScrollStop; to: ScrollStop }[] = [];
    for (const songId of songsOf(selected)) {
      const along = SCROLL_STOPS.filter((s) =>
        placeById.get(s.id)?.entries.some((e) => e.songId === songId),
      ).sort((a, b) => b.x - a.x); // 顺着溯洄方向（自右向左）画线
      for (let i = 1; i < along.length; i++) {
        pairs.push({
          key: `${songId}-${along[i - 1].id}-${along[i].id}`,
          from: along[i - 1],
          to: along[i],
        });
      }
    }
    return pairs;
  }, [selected, placeById]);

  /** 同步视差层与底部卷轴标尺（直接改 DOM，滚动全程 60fps） */
  const syncVisuals = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const maxScroll = Math.max(1, el.scrollWidth - el.clientWidth);
    const ratio = el.scrollLeft / maxScroll; // 0 = 最左卷尾，1 = 最右卷首
    const centerScrollX =
      ((el.scrollLeft + el.clientWidth / 2) / el.scrollWidth) * SCROLL_W;

    // 远山移动慢于前景（产生正向偏移补偿），拉出三远法空间感
    if (!reduce) {
      const farShift = (ratio - 0.5) * 380;
      const midShift = (ratio - 0.5) * 180;
      farLayerRef.current?.setAttribute(
        "transform",
        `translate(${farShift.toFixed(1)}, 0)`,
      );
      midLayerRef.current?.setAttribute(
        "transform",
        `translate(${midShift.toFixed(1)}, 0)`,
      );
    }

    if (thumbRef.current) {
      const visPct = Math.min(100, (el.clientWidth / el.scrollWidth) * 100);
      const leftPct = (el.scrollLeft / el.scrollWidth) * 100;
      thumbRef.current.style.width = `${visPct.toFixed(2)}%`;
      thumbRef.current.style.left = `${leftPct.toFixed(2)}%`;
    }

    const ch = SCROLL_CHAPTERS.find(
      (c) => centerScrollX >= c.range[0] && centerScrollX <= c.range[1],
    );
    if (ch) {
      setActiveChapterId((cur) => (cur === ch.id ? cur : ch.id));
    }
  }, [reduce]);

  /** 容器高度变化时按 5400:860 精确算长卷像素宽度；首次挂起直接落在最右「卷首」 */
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const updateSize = () => {
      const h = Math.max(460, el.clientHeight);
      const w = Math.round(h * (SCROLL_W / SCROLL_H));
      setCanvasSize({ w, h });
      requestAnimationFrame(() => {
        if (!initializedRef.current && el.scrollWidth > el.clientWidth) {
          el.scrollLeft = el.scrollWidth - el.clientWidth;
          initializedRef.current = true;
        }
        syncVisuals();
      });
    };
    const ro = new ResizeObserver(updateSize);
    ro.observe(el);
    updateSize();
    return () => ro.disconnect();
  }, [syncVisuals]);

  /** 鼠标滚轮竖滚 → 向左溯洄展卷（自然手卷体验） */
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      // 如果指针停在可滚动的诗文面板内，不劫持滚轮
      if ((e.target as HTMLElement | null)?.closest("[data-scroll-panel]")) {
        return;
      }
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        e.preventDefault();
        // 向下滚（deltaY > 0）= 向左展卷（scrollLeft 减小）
        el.scrollLeft -= e.deltaY * 1.15;
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  /** 滑行至画卷中的指定坐标 x */
  const scrollToCanvasX = useCallback(
    (svgX: number, offsetRatio = 0.5) => {
      const el = scrollerRef.current;
      if (!el) return;
      const px = (svgX / SCROLL_W) * el.scrollWidth;
      const target = px - el.clientWidth * offsetRatio;
      el.scrollTo({
        left: Math.max(0, Math.min(el.scrollWidth - el.clientWidth, target)),
        behavior: reduce ? "auto" : "smooth",
      });
    },
    [reduce],
  );

  /** 选中地点：平滑居中偏右一点，给左侧「画上题诗」留出呼吸空间 */
  const pickPlace = useCallback(
    (id: number) => {
      if (dragRef.current.moved) return;
      setSelectedId((cur) => {
        const next = cur === id ? null : id;
        if (next !== null) {
          const stop = stopById.get(next);
          if (stop) {
            const isWide = window.innerWidth >= 1024;
            scrollToCanvasX(stop.x, isWide ? 0.62 : 0.5);
          }
        }
        return next;
      });
    },
    [stopById, scrollToCanvasX],
  );

  const goPlace = useCallback(
    (id: number) => {
      setSelectedId(id);
      const stop = stopById.get(id);
      if (stop) {
        const isWide = window.innerWidth >= 1024;
        scrollToCanvasX(stop.x, isWide ? 0.62 : 0.5);
      }
    },
    [stopById, scrollToCanvasX],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelectedId(null);
      const el = scrollerRef.current;
      if (!el) return;
      if (e.key === "ArrowLeft") {
        el.scrollBy({ left: -320, behavior: "smooth" });
      } else if (e.key === "ArrowRight") {
        el.scrollBy({ left: 320, behavior: "smooth" });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  /** 拖拽展卷 */
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "touch") return; // 触屏交给原生丝滑横滑
    if ((e.target as HTMLElement).closest("[role='button'], button, a")) return;
    const el = scrollerRef.current;
    if (!el) return;
    dragRef.current = {
      active: true,
      startX: e.clientX,
      startScroll: el.scrollLeft,
      moved: false,
    };
    el.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current.active) return;
    const el = scrollerRef.current;
    if (!el) return;
    const dx = e.clientX - dragRef.current.startX;
    if (Math.abs(dx) > 5) dragRef.current.moved = true;
    el.scrollLeft = dragRef.current.startScroll - dx;
  };

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current.active) return;
    const wasMoved = dragRef.current.moved;
    dragRef.current.active = false;
    scrollerRef.current?.releasePointerCapture(e.pointerId);
    if (!wasMoved) setSelectedId(null);
    requestAnimationFrame(() => {
      dragRef.current.moved = false;
    });
  };

  const dimmed = selected !== null;
  const count = t("count", { places: places.length, songs: songCount });
  const activeChapter =
    SCROLL_CHAPTERS.find((c) => c.id === activeChapterId) ?? SCROLL_CHAPTERS[4];

  return (
    <div
      className="fixed inset-0 flex flex-col overflow-hidden bg-(--paper) text-(--ink) transition-colors duration-300
        [--paper:#F5F0E6] [--paper-edge:#E9E0CE] [--ink:#25221D] [--ink-muted:#797164]
        [--river:#2A4B63] [--river-wash:#6C90A6] [--seal:#B23A2A]
        [--mtn-1:#97A49E] [--mtn-2:#6B8B86] [--mtn-3:#B6A183]
        [--tone:#2A4B63]
        dark:[--paper:#0B121C] dark:[--paper-edge:#070C14] dark:[--ink:#ECE4D3] dark:[--ink-muted:#8C929D]
        dark:[--river:#C6A668] dark:[--river-wash:#587792] dark:[--seal:#DF7B5E]
        dark:[--mtn-1:#213244] dark:[--mtn-2:#233E47] dark:[--mtn-3:#3D362A]
        dark:[--tone:#C6A668]"
    >
      <TopBar exit={{ kind: "logo" }} nav={<LabModeNav active="scroll" />} />

      {/* 顶部极轻的画卷当前章回题示 + 悬停微预览 */}
      <div className="pointer-events-none fixed top-24 right-6 left-6 z-20 flex items-start justify-between">
        <div className="flex items-center gap-3">
          <span className="font-calligraphy text-2xl leading-none text-(--ink)/85 sm:text-3xl">
            {activeChapter.name}
          </span>
          <span className="hidden text-xs tracking-[0.26em] text-(--ink-muted) sm:inline">
            {activeChapter.subtitle}
          </span>
        </div>

        {/* 鼠标轻扫某处时的极简诗意提示 */}
        <AnimatePresence>
          {hoverPlace && hoverPlace.id !== selectedId && (
            <motion.div
              key={hoverPlace.id}
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="hidden border-b border-(--ink)/15 pb-1 text-right lg:block"
            >
              <span className="font-serif text-sm text-(--ink)">
                {hoverPlace.fullName ?? hoverPlace.name}
              </span>
              <span className="ml-3 text-xs tracking-[0.2em] text-(--ink-muted)">
                {hoverPlace.entries.map((e) => `《${e.title}》`).join(" ")}
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 主手卷横向展阅区 */}
      <div
        ref={scrollerRef}
        onScroll={syncVisuals}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className="relative mt-20 flex-1 cursor-grab overflow-x-auto overflow-y-hidden no-scrollbar active:cursor-grabbing"
      >
        {/* 画卷上下细绫边（手卷装裱感） */}
        <div
          className="relative h-full border-y border-(--ink)/12"
          style={{ width: canvasSize.w }}
        >
          <svg
            viewBox={`0 0 ${SCROLL_W} ${SCROLL_H}`}
            width={canvasSize.w}
            height={canvasSize.h}
            role="group"
            aria-label="河图志 · 溯洄水墨横卷"
            className="block h-full w-full select-none"
          >
            <defs>
              <filter
                id="scroll-grain"
                x="0%"
                y="0%"
                width="100%"
                height="100%"
              >
                <feTurbulence
                  type="fractalNoise"
                  baseFrequency="0.7"
                  numOctaves="3"
                  stitchTiles="stitch"
                />
                <feColorMatrix type="saturate" values="0" />
              </filter>
              <linearGradient id="scroll-mtn-1" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--mtn-1)" stopOpacity="0.88" />
                <stop offset="62%" stopColor="var(--mtn-1)" stopOpacity="0.28" />
                <stop offset="100%" stopColor="var(--mtn-1)" stopOpacity="0" />
              </linearGradient>
              <linearGradient id="scroll-mtn-2" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--mtn-2)" stopOpacity="0.9" />
                <stop offset="65%" stopColor="var(--mtn-2)" stopOpacity="0.26" />
                <stop offset="100%" stopColor="var(--mtn-2)" stopOpacity="0" />
              </linearGradient>
              <linearGradient id="scroll-mtn-3" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--mtn-3)" stopOpacity="0.82" />
                <stop offset="68%" stopColor="var(--mtn-3)" stopOpacity="0.2" />
                <stop offset="100%" stopColor="var(--mtn-3)" stopOpacity="0" />
              </linearGradient>
              <radialGradient id="scroll-lake" cx="50%" cy="50%" r="55%">
                <stop offset="0%" stopColor="var(--river)" stopOpacity="0.32" />
                <stop
                  offset="75%"
                  stopColor="var(--river-wash)"
                  stopOpacity="0.16"
                />
                <stop
                  offset="100%"
                  stopColor="var(--river-wash)"
                  stopOpacity="0"
                />
              </radialGradient>
              <linearGradient id="scroll-mist" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--paper)" stopOpacity="0" />
                <stop offset="50%" stopColor="var(--paper)" stopOpacity="0.58" />
                <stop offset="100%" stopColor="var(--paper)" stopOpacity="0" />
              </linearGradient>
            </defs>

            {/* ── 第一层：远山视差层 ── */}
            <g
              ref={farLayerRef}
              className="transition-opacity duration-500"
              style={{ opacity: dimmed ? 0.45 : 1 }}
            >
              {FAR_MOUNTAINS.map((m) => (
                <ScrollMountain key={m.id} m={m} />
              ))}
            </g>

            {/* 山腰浮动的淡淡烟岚云带 */}
            <rect
              x={0}
              y={355}
              width={SCROLL_W}
              height={115}
              fill="url(#scroll-mist)"
              className="pointer-events-none"
            />

            {/* ── 第二层：中景墨峦视差层 ── */}
            <g
              ref={midLayerRef}
              className="transition-opacity duration-500"
              style={{ opacity: dimmed ? 0.45 : 1 }}
            >
              {MID_MOUNTAINS.map((m) => (
                <ScrollMountain key={m.id} m={m} />
              ))}
            </g>

            {/* ── 第三层：手卷正文（水脉、题诗水印、地标） ── */}

            {/* 卷首（最右端）装裱引首 */}
            <g
              className="transition-opacity duration-500"
              style={{ opacity: dimmed ? 0.35 : 1 }}
            >
              {/* 卷首细竖界线 */}
              <line
                x1={5095}
                y1={95}
                x2={5095}
                y2={765}
                stroke="var(--ink)"
                strokeWidth={0.7}
                opacity={0.18}
              />
              {/* 巨幅竖排刻本卷首题名 */}
              <g className="fill-(--ink) font-calligraphy" style={{ fontSize: 78 }}>
                {[...t("title")].map((ch, i) => (
                  <text
                    key={i}
                    x={5230}
                    y={245 + i * 86}
                    textAnchor="middle"
                  >
                    {ch}
                  </text>
                ))}
              </g>
              {/* 卷首朱砂印 */}
              <g transform="translate(5156, 462)">
                <rect
                  x={0}
                  y={0}
                  width={26}
                  height={48}
                  rx={2}
                  fill="var(--seal)"
                  fillOpacity={0.12}
                  stroke="var(--seal)"
                  strokeWidth={1.1}
                />
                <text
                  x={13}
                  y={19}
                  textAnchor="middle"
                  className="fill-(--seal) font-calligraphy"
                  style={{ fontSize: 15 }}
                >
                  溯
                </text>
                <text
                  x={13}
                  y={38}
                  textAnchor="middle"
                  className="fill-(--seal) font-calligraphy"
                  style={{ fontSize: 15 }}
                >
                  洄
                </text>
              </g>
              {/* 竖排卷首小引 */}
              <g
                className="fill-(--ink-muted) font-kaiti"
                style={{ fontSize: 17 }}
              >
                {[..."顺水寻词 · 逆流而上"].map((ch, i) => (
                  <text
                    key={i}
                    x={5168}
                    y={245 + i * 22}
                    textAnchor="middle"
                  >
                    {ch}
                  </text>
                ))}
              </g>
              {/* 向左展卷提示 */}
              <text
                x={5230}
                y={605}
                textAnchor="middle"
                className="fill-(--seal) font-serif tracking-[0.28em]"
                style={{ fontSize: 12.5, opacity: 0.85 }}
              >
                ← 向左展卷
              </text>
              <text
                x={5230}
                y={632}
                textAnchor="middle"
                className="fill-(--ink-muted) font-sans tracking-[0.2em]"
                style={{ fontSize: 11, opacity: 0.75 }}
              >
                滚轮或拖拽漫游
              </text>
            </g>

            {/* 东海浪纹 */}
            <g
              className="transition-opacity duration-500"
              style={{ opacity: dimmed ? 0.22 : 1 }}
            >
              {EAST_SEA_WAVES.map((w, i) => (
                <g
                  key={i}
                  transform={`translate(${w.x}, ${w.y}) scale(${w.scale})`}
                  fill="none"
                  stroke="var(--river)"
                  strokeWidth={0.95}
                  strokeLinecap="round"
                  opacity={0.25}
                >
                  <path d="M -26 0 Q -17 -7 -8 0 Q 1 -7 10 0 Q 19 -7 28 0" />
                  <path d="M -18 8 Q -9 2 0 8 Q 9 2 18 8" opacity={0.7} />
                </g>
              ))}
              <text
                x={5025}
                y={496}
                className="fill-(--river) font-serif tracking-[0.3em]"
                style={{ fontSize: 14, opacity: 0.6 }}
              >
                东海
              </text>
            </g>

            {/* 卷尾（最左端）跋语落款 */}
            <g
              className="transition-opacity duration-500"
              style={{ opacity: dimmed ? 0.35 : 0.78 }}
            >
              <line
                x1={195}
                y1={120}
                x2={195}
                y2={740}
                stroke="var(--ink)"
                strokeWidth={0.7}
                opacity={0.18}
              />
              <g
                className="fill-(--ink-muted) font-kaiti"
                style={{ fontSize: 15 }}
              >
                {[...count].map((ch, i) => (
                  <text
                    key={i}
                    x={128}
                    y={260 + i * 21}
                    textAnchor="middle"
                  >
                    {ch}
                  </text>
                ))}
              </g>
              <g
                className="fill-(--ink-muted) font-kaiti"
                style={{ fontSize: 14, opacity: 0.78 }}
              >
                {[...t("credit")].map((ch, i) => (
                  <text
                    key={i}
                    x={92}
                    y={290 + i * 20}
                    textAnchor="middle"
                  >
                    {ch}
                  </text>
                ))}
              </g>
            </g>

            {/* 留白处淡墨题诗水印 */}
            <g
              className="pointer-events-none transition-opacity duration-500"
              style={{ opacity: dimmed ? 0.04 : 0.14 }}
            >
              {SCROLL_INSCRIPTIONS.map((ins) => (
                <g
                  key={ins.text}
                  className="fill-(--ink) font-calligraphy"
                  style={{ fontSize: ins.size ?? 18 }}
                >
                  {[...ins.text].map((ch, i) => (
                    <text
                      key={i}
                      x={ins.x}
                      y={ins.y + i * ((ins.size ?? 18) + 4)}
                      textAnchor="middle"
                    >
                      {ch}
                    </text>
                  ))}
                </g>
              ))}
            </g>

            {/* 浩渺洞庭湖水晕 */}
            <ellipse
              cx={3395}
              cy={472}
              rx={78}
              ry={34}
              fill="url(#scroll-lake)"
              stroke="var(--river)"
              strokeWidth={0.7}
              strokeOpacity={0.32}
              style={{ opacity: dimmed ? 0.3 : 1 }}
            />

            {/* 全卷书法水脉 */}
            {SCROLL_RIVERS.map((r) => (
              <ScrollRiver key={r.id} river={r} dimmed={dimmed} />
            ))}

            {/* 同曲朱砂飞虹 */}
            <AnimatePresence>
              {threads.map((th) => {
                const dx = th.to.x - th.from.x;
                const dy = th.to.y - th.from.y;
                const dist = Math.hypot(dx, dy) || 1;
                const arch = Math.min(220, 48 + dist * 0.14);
                const mx = (th.from.x + th.to.x) / 2;
                const my = Math.min(th.from.y, th.to.y) - arch;
                return (
                  <motion.path
                    key={th.key}
                    d={`M ${th.from.x} ${th.from.y} Q ${mx} ${my} ${th.to.x} ${th.to.y}`}
                    fill="none"
                    stroke="var(--seal)"
                    strokeWidth={1.5}
                    strokeDasharray="6 6"
                    strokeLinecap="round"
                    initial={{ pathLength: 0, opacity: 0 }}
                    animate={{ pathLength: 1, opacity: 0.85 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: reduce ? 0 : 0.85, ease: EASE }}
                  />
                );
              })}
            </AnimatePresence>

            {/* 全卷 45 处地点 */}
            {SCROLL_STOPS.map((stop) => {
              const place = placeById.get(stop.id);
              if (!place) return null;
              const state =
                selected?.id === stop.id
                  ? "current"
                  : kin.has(stop.id)
                    ? "kin"
                    : selected
                      ? "dim"
                      : "rest";
              return (
                <ScrollMarker
                  key={stop.id}
                  stop={stop}
                  place={place}
                  state={state}
                  onEnter={() => setHoverId(stop.id)}
                  onLeave={() =>
                    setHoverId((cur) => (cur === stop.id ? null : cur))
                  }
                  onPick={() => pickPlace(stop.id)}
                />
              );
            })}

            {/* 宣纸纤维微粒 */}
            <rect
              width={SCROLL_W}
              height={SCROLL_H}
              filter="url(#scroll-grain)"
              opacity={0.04}
              className="pointer-events-none"
            />
          </svg>
        </div>
      </div>

      {/* 选中某处后浮现的「画上题诗」半透明宣纸栏 */}
      <AnimatePresence mode="wait">
        {selected && (
          <motion.aside
            key={selected.id}
            data-scroll-panel
            initial={{ opacity: 0, x: -24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.35, ease: EASE }}
            className="fixed z-30 border-(--ink)/14 bg-(--paper)/92 backdrop-blur-md
              max-lg:inset-x-0 max-lg:bottom-0 max-lg:max-h-[58svh] max-lg:overflow-y-auto max-lg:rounded-t-2xl max-lg:border-t max-lg:px-6 max-lg:pt-5 max-lg:pb-9
              lg:top-28 lg:bottom-24 lg:left-8 lg:flex lg:w-[24rem] lg:flex-col lg:justify-end lg:overflow-y-auto lg:border lg:px-8 lg:py-8 lg:shadow-[0_24px_60px_-24px_rgba(15,23,42,0.22)] thin-scrollbar"
          >
            <div className="mb-3 flex items-baseline justify-between gap-4">
              <p className="text-xs tracking-[0.28em] text-(--ink-muted)">
                {selected.region}
              </p>
              <button
                type="button"
                onClick={() => setSelectedId(null)}
                className="cursor-pointer text-xs tracking-[0.26em] text-(--ink-muted) transition-colors hover:text-(--seal)"
              >
                收起
              </button>
            </div>
            <div className="mb-6 flex items-end justify-between gap-3">
              <h2 className="font-serif text-3xl font-semibold tracking-tight text-(--ink) lg:text-4xl">
                {selected.fullName ?? selected.name}
              </h2>
              <SealStamp text="题诗" className="shrink-0 scale-90" />
            </div>
            <PlaceReadingBody
              place={selected}
              siblings={siblingsOf(selected)}
              onGo={goPlace}
            />
          </motion.aside>
        )}
      </AnimatePresence>

      {/* 底部手卷缩略导览尺（五段景致 + 45 处微点 + 视窗滑块） */}
      <footer className="relative z-20 shrink-0 border-t border-(--ink)/12 bg-(--paper)/92 px-4 py-2.5 backdrop-blur-sm sm:px-8">
        <div className="mx-auto max-w-5xl">
          {/* 微缩卷轴轨道 */}
          <div
            role="presentation"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const ratio = (e.clientX - rect.left) / rect.width;
              scrollToCanvasX(ratio * SCROLL_W, 0.5);
            }}
            className="relative mb-2 h-3 cursor-pointer border-y border-(--ink)/12"
          >
            {/* 45 处地点的微缩印点 */}
            {SCROLL_STOPS.map((s) => {
              const isSelected = s.id === selectedId;
              const isKin = kin.has(s.id);
              return (
                <span
                  key={s.id}
                  className="pointer-events-none absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full transition-colors"
                  style={{
                    left: `${(s.x / SCROLL_W) * 100}%`,
                    width: isSelected ? 6 : isKin ? 4.5 : 2.5,
                    height: isSelected ? 6 : isKin ? 4.5 : 2.5,
                    backgroundColor:
                      isSelected || isKin ? "var(--seal)" : "var(--river)",
                    opacity: isSelected || isKin ? 1 : 0.45,
                  }}
                />
              );
            })}
            {/* 当前视窗在长卷上的位置 */}
            <div
              ref={thumbRef}
              className="pointer-events-none absolute top-0 bottom-0 border border-(--seal)/70 bg-(--seal)/10"
              style={{ left: "75%", width: "25%" }}
            />
          </div>

          {/* 五段章回直达（自右向左逆流溯洄） */}
          <div className="flex items-center justify-between gap-2 text-[11px] tracking-[0.22em] text-(--ink-muted)">
            {SCROLL_CHAPTERS.map((ch) => {
              const isCurrent = ch.id === activeChapterId;
              return (
                <button
                  key={ch.id}
                  type="button"
                  onClick={() => scrollToCanvasX(ch.anchorX, 0.5)}
                  className={`cursor-pointer truncate transition-colors ${
                    isCurrent
                      ? "font-serif font-semibold text-(--seal)"
                      : "hover:text-(--ink)"
                  }`}
                >
                  {ch.name}
                </button>
              );
            })}
          </div>
        </div>
      </footer>
    </div>
  );
}
