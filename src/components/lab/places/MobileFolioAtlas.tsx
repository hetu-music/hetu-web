"use client";

/**
 * 方案一移动端 · M2「方域册页」（一屏一幅 3:4 竖版水墨小画，左右翻页）
 *
 * 借鉴古籍《山水册页》：不把全国大图硬缩进巴掌，而是拆成 6 幅专为手机竖屏构图的小画：
 * 卷一 燕京东海 · 卷二 金陵钱塘 · 卷三 赣水楚天 · 卷四 潇湘岳麓 · 卷五 武陵沅水 · 卷六 关山雪域。
 * 零缩放、零裁剪，左右轻滑翻页，每一屏都是一幅完整的书画页。
 */

import type { Place } from "@/lib/places/types";
import { AnimatePresence, motion } from "framer-motion";
import { useMemo, useRef, useState } from "react";
import type { MountainSilhouette, OrganicRiver } from "./atlas-data";
import {
  FOLIO_H,
  FOLIO_PAGES,
  FOLIO_W,
  folioIndexOfPlace,
  type FolioPage,
  type MobileStop,
} from "./mobile-data";
import {
  PlaceGlyph,
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

function FolioMountain({
  m,
  prefix,
}: {
  m: MountainSilhouette;
  prefix: string;
}) {
  const fillPath = useMemo(() => inkMountainPath(m.ridge, m.baseY), [m]);
  const ridgePath = useMemo(() => splineCenterPath(m.ridge, 10), [m]);
  return (
    <g opacity={m.opacity}>
      <path d={fillPath} fill={`url(#${prefix}-mtn-${m.tone})`} />
      <path
        d={ridgePath}
        fill="none"
        stroke={`var(--mtn-${m.tone})`}
        strokeWidth={0.85}
        strokeLinecap="round"
        opacity={0.55}
      />
    </g>
  );
}

function FolioRiver({
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
          strokeWidth={1.35}
          strokeDasharray="4 6"
          strokeLinecap="round"
          opacity={0.58}
        />
      ) : (
        <>
          <path
            d={body}
            fill="var(--river-wash)"
            opacity={0.22}
            transform="translate(0, 1.2)"
          />
          <path d={body} fill="var(--river)" opacity={0.88} />
          {ripple && (
            <path
              d={ripple}
              fill="none"
              stroke="var(--river-wash)"
              strokeWidth={0.7}
              strokeDasharray="16 12 6 12"
              strokeLinecap="round"
              opacity={0.34}
            />
          )}
        </>
      )}

      {(() => {
        const label = river.label;
        if (!label) return null;
        return label.vertical ? (
          <g
            className={
              label.large
                ? "fill-(--river) font-calligraphy"
                : "fill-(--river) font-serif"
            }
            style={{
              fontSize: label.large ? 22 : 12,
              opacity: 0.68,
            }}
          >
            {[...river.name].map((ch, i) => (
              <text
                key={i}
                x={label.x}
                y={label.y + i * (label.large ? 24 : 15)}
                textAnchor="middle"
              >
                {ch}
              </text>
            ))}
          </g>
        ) : (
          <text
            x={label.x}
            y={label.y}
            className={
              label.large
                ? "fill-(--river) font-calligraphy"
                : "fill-(--river) font-serif tracking-[0.2em]"
            }
            style={{
              fontSize: label.large ? 22 : 11.5,
              opacity: 0.7,
            }}
          >
            {river.name}
          </text>
        );
      })()}
    </g>
  );
}

function FolioMarker({
  stop,
  place,
  active,
  isKin,
  isDim,
  onPick,
}: {
  stop: MobileStop;
  place: Place;
  active: boolean;
  isKin: boolean;
  isDim: boolean;
  onPick: () => void;
}) {
  const { x, y, dir, vertical } = stop;
  const name = place.name;
  const chars = [...name];
  const fontSize = 15;
  const gap = 12;
  const lit = active || isKin;
  const textClass = active
    ? "fill-(--seal) font-serif font-bold"
    : isKin
      ? "fill-(--seal) font-serif"
      : "fill-(--ink) font-serif";

  const renderLabel = () => {
    if (vertical) {
      const step = fontSize + 1.5;
      const startY =
        dir === "a"
          ? y - gap - 3 - (chars.length - 1) * step
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
          y={y - gap - 2}
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
      className="cursor-pointer outline-none transition-opacity duration-500"
      style={{ opacity: isDim ? 0.25 : 1 }}
      onClick={(e) => {
        e.stopPropagation();
        onPick();
      }}
    >
      <circle cx={x} cy={y} r={24} fill="transparent" />
      <PlaceGlyph
        kind={glyphOf(place.id)}
        x={x}
        y={y}
        active={active}
        kin={isKin}
        scale={lit ? 1.18 : 1.05}
      />
      {renderLabel()}
    </g>
  );
}

export default function MobileFolioAtlas({
  placeById,
  selected,
  kin,
  reduce,
  onPick,
  onClear,
}: {
  placeById: Map<number, Place>;
  selected: Place | null;
  kin: Set<number>;
  reduce: boolean;
  onPick: (id: number) => void;
  onClear: () => void;
}) {
  const [pageIdx, setPageIdx] = useState(1); // 默认落在「卷二 · 金陵钱塘」
  const [direction, setDirection] = useState<1 | -1>(1);
  const [prevSelectedId, setPrevSelectedId] = useState<number | null>(null);
  const swipeRef = useRef<{ x: number; y: number } | null>(null);

  // 从目录或同曲跳转选中某处时，同步翻到它所在的那一册（渲染期同步，避免 effect 级联渲染）
  const selId = selected?.id ?? null;
  if (selId !== prevSelectedId) {
    setPrevSelectedId(selId);
    if (selId !== null) {
      const target = folioIndexOfPlace(selId);
      if (target !== pageIdx) {
        setDirection(target > pageIdx ? 1 : -1);
        setPageIdx(target);
      }
    }
  }

  const folio: FolioPage = FOLIO_PAGES[pageIdx] ?? FOLIO_PAGES[0];

  const turnTo = (nextIdx: number) => {
    const clamped = Math.max(0, Math.min(FOLIO_PAGES.length - 1, nextIdx));
    if (clamped === pageIdx) return;
    setDirection(clamped > pageIdx ? 1 : -1);
    setPageIdx(clamped);
    if (selected) onClear();
  };

  const threads = useMemo(() => {
    if (!selected) return [];
    const pairs: { key: string; from: MobileStop; to: MobileStop }[] = [];
    for (const songId of songsOf(selected)) {
      const along = folio.stops.filter((s) =>
        placeById.get(s.id)?.entries.some((e) => e.songId === songId),
      );
      for (let i = 1; i < along.length; i++) {
        pairs.push({
          key: `${songId}-${along[i - 1].id}-${along[i].id}`,
          from: along[i - 1],
          to: along[i],
        });
      }
    }
    return pairs;
  }, [selected, folio, placeById]);

  const dimmed = selected !== null;
  const prefix = `folio-${folio.id}`;

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
      {/* 顶部六卷册页页签 */}
      <div className="z-10 shrink-0 border-b border-(--ink)/10 bg-(--paper)/88 px-3 py-2 backdrop-blur-sm">
        <div className="flex items-center justify-between gap-1 text-[11px] tracking-[0.2em] text-(--ink-muted)">
          {FOLIO_PAGES.map((f, i) => {
            const active = i === pageIdx;
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => turnTo(i)}
                className={`cursor-pointer px-1.5 py-0.5 transition-colors ${
                  active
                    ? "font-serif font-semibold text-(--seal)"
                    : "active:text-(--ink)"
                }`}
              >
                {f.shortTitle}
              </button>
            );
          })}
        </div>
      </div>

      {/* 主册页画幅（支持左右轻滑翻页） */}
      <div
        onTouchStart={(e) => {
          const touch = e.touches[0];
          if (touch) swipeRef.current = { x: touch.clientX, y: touch.clientY };
        }}
        onTouchEnd={(e) => {
          if (!swipeRef.current) return;
          const touch = e.changedTouches[0];
          const dx = touch.clientX - swipeRef.current.x;
          const dy = touch.clientY - swipeRef.current.y;
          swipeRef.current = null;
          if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.4) {
            if (dx < 0) turnTo(pageIdx + 1);
            else turnTo(pageIdx - 1);
          }
        }}
        onClick={() => {
          if (selected) onClear();
        }}
        className="relative flex min-h-0 flex-1 flex-col items-center justify-center overflow-y-auto px-3.5 py-3"
      >
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={folio.id}
            custom={direction}
            initial={
              reduce
                ? { opacity: 0 }
                : { opacity: 0, x: direction * 28 }
            }
            animate={{ opacity: 1, x: 0 }}
            exit={
              reduce
                ? { opacity: 0 }
                : { opacity: 0, x: direction * -28 }
            }
            transition={{ duration: reduce ? 0 : 0.34, ease: EASE }}
            className="flex w-full max-w-[420px] flex-col"
          >
            {/* 线装册页双框 */}
            <div className="border border-(--ink)/14 p-1.5">
              <div className="relative overflow-hidden border border-(--ink)/22 bg-(--paper)">
                {/* 册页左上角题名与卷次 */}
                <div className="pointer-events-none absolute top-3.5 left-4 z-10 flex items-start gap-2">
                  <div className="bg-(--paper)/70 pr-1.5 pb-1 backdrop-blur-[1px]">
                    <p className="text-[10px] tracking-[0.3em] text-(--seal)">
                      {folio.numeral} · {folio.stops.length} 处
                    </p>
                    <h2 className="mt-1 font-calligraphy text-3xl leading-none text-(--ink)">
                      {folio.title}
                    </h2>
                  </div>
                </div>

                {/* 册页右上角朱砂小印 */}
                <div className="pointer-events-none absolute top-3.5 right-3.5 z-10">
                  <SealStamp text={folio.shortTitle} className="scale-85" />
                </div>

                <svg
                  viewBox={`0 0 ${FOLIO_W} ${FOLIO_H}`}
                  role="group"
                  aria-label={`${folio.numeral} ${folio.title}`}
                  className="block h-auto max-h-[calc(100svh-16.5rem)] w-full select-none"
                >
                  <defs>
                    <filter
                      id={`${prefix}-grain`}
                      x="0%"
                      y="0%"
                      width="100%"
                      height="100%"
                    >
                      <feTurbulence
                        type="fractalNoise"
                        baseFrequency="0.72"
                        numOctaves="3"
                        stitchTiles="stitch"
                      />
                      <feColorMatrix type="saturate" values="0" />
                    </filter>
                    <linearGradient
                      id={`${prefix}-mtn-1`}
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="0%"
                        stopColor="var(--mtn-1)"
                        stopOpacity="0.86"
                      />
                      <stop
                        offset="64%"
                        stopColor="var(--mtn-1)"
                        stopOpacity="0.26"
                      />
                      <stop
                        offset="100%"
                        stopColor="var(--mtn-1)"
                        stopOpacity="0"
                      />
                    </linearGradient>
                    <linearGradient
                      id={`${prefix}-mtn-2`}
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="0%"
                        stopColor="var(--mtn-2)"
                        stopOpacity="0.88"
                      />
                      <stop
                        offset="66%"
                        stopColor="var(--mtn-2)"
                        stopOpacity="0.24"
                      />
                      <stop
                        offset="100%"
                        stopColor="var(--mtn-2)"
                        stopOpacity="0"
                      />
                    </linearGradient>
                    <linearGradient
                      id={`${prefix}-mtn-3`}
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="0%"
                        stopColor="var(--mtn-3)"
                        stopOpacity="0.82"
                      />
                      <stop
                        offset="68%"
                        stopColor="var(--mtn-3)"
                        stopOpacity="0.2"
                      />
                      <stop
                        offset="100%"
                        stopColor="var(--mtn-3)"
                        stopOpacity="0"
                      />
                    </linearGradient>
                    <radialGradient
                      id={`${prefix}-lake`}
                      cx="50%"
                      cy="50%"
                      r="54%"
                    >
                      <stop
                        offset="0%"
                        stopColor="var(--river)"
                        stopOpacity="0.34"
                      />
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
                  </defs>

                  {/* 远山 */}
                  <g
                    className="transition-opacity duration-500"
                    style={{ opacity: dimmed ? 0.42 : 1 }}
                  >
                    {folio.mountains.map((m) => (
                      <FolioMountain key={m.id} m={m} prefix={prefix} />
                    ))}
                  </g>

                  {/* 湖泊（洞庭）或江心洲（橘子洲） */}
                  {folio.waterShapes?.map((ws, i) =>
                    ws.kind === "lake" ? (
                      <path
                        key={i}
                        d={ws.d}
                        fill={`url(#${prefix}-lake)`}
                        stroke="var(--river)"
                        strokeWidth={0.85}
                        strokeOpacity={0.42}
                        style={{ opacity: dimmed ? 0.3 : 1 }}
                      />
                    ) : (
                      <path
                        key={i}
                        d={ws.d}
                        fill="var(--paper)"
                        stroke="var(--river)"
                        strokeWidth={0.95}
                        strokeOpacity={0.62}
                        style={{ opacity: dimmed ? 0.35 : 0.92 }}
                      />
                    ),
                  )}

                  {/* 河道 */}
                  {folio.rivers.map((r) => (
                    <FolioRiver key={r.id} river={r} dimmed={dimmed} />
                  ))}

                  {/* 本页内的同曲朱砂游丝 */}
                  <AnimatePresence>
                    {threads.map((th) => {
                      const dx = th.to.x - th.from.x;
                      const dy = th.to.y - th.from.y;
                      const dist = Math.hypot(dx, dy) || 1;
                      const bulge = Math.min(62, dist * 0.24);
                      const cx = (th.from.x + th.to.x) / 2 + (dy / dist) * bulge;
                      const cy = (th.from.y + th.to.y) / 2 - (dx / dist) * bulge;
                      return (
                        <motion.path
                          key={th.key}
                          d={`M ${th.from.x} ${th.from.y} Q ${cx} ${cy} ${th.to.x} ${th.to.y}`}
                          fill="none"
                          stroke="var(--seal)"
                          strokeWidth={1.35}
                          strokeDasharray="5 5"
                          strokeLinecap="round"
                          initial={{ pathLength: 0, opacity: 0 }}
                          animate={{ pathLength: 1, opacity: 0.88 }}
                          exit={{ opacity: 0 }}
                          transition={{
                            duration: reduce ? 0 : 0.65,
                            ease: EASE,
                          }}
                        />
                      );
                    })}
                  </AnimatePresence>

                  {/* 地点 */}
                  {folio.stops.map((stop) => {
                    const place = placeById.get(stop.id);
                    if (!place) return null;
                    const active = selected?.id === stop.id;
                    const isKin = kin.has(stop.id);
                    return (
                      <FolioMarker
                        key={stop.id}
                        stop={stop}
                        place={place}
                        active={active}
                        isKin={isKin}
                        isDim={dimmed && !active && !isKin}
                        onPick={() => onPick(stop.id)}
                      />
                    );
                  })}

                  <rect
                    width={FOLIO_W}
                    height={FOLIO_H}
                    filter={`url(#${prefix}-grain)`}
                    opacity={0.04}
                    className="pointer-events-none"
                  />
                </svg>
              </div>
            </div>

            {/* 册页底部的题跋与左右翻页提示 */}
            <div className="mt-3 flex items-center justify-between gap-2 px-1">
              <button
                type="button"
                disabled={pageIdx === 0}
                onClick={(e) => {
                  e.stopPropagation();
                  turnTo(pageIdx - 1);
                }}
                className="shrink-0 cursor-pointer py-1 text-xs tracking-[0.2em] text-(--ink-muted) transition-colors disabled:opacity-25 active:text-(--seal)"
              >
                ‹ 上卷
              </button>
              <p className="truncate font-kaiti text-xs text-(--ink-muted)">
                {folio.colophon}
              </p>
              <button
                type="button"
                disabled={pageIdx === FOLIO_PAGES.length - 1}
                onClick={(e) => {
                  e.stopPropagation();
                  turnTo(pageIdx + 1);
                }}
                className="shrink-0 cursor-pointer py-1 text-xs tracking-[0.2em] text-(--ink-muted) transition-colors disabled:opacity-25 active:text-(--seal)"
              >
                下卷 ›
              </button>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
