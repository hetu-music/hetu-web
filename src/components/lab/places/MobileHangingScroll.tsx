"use client";

/**
 * 方案一移动端 · M1「溯洄立轴」（竖向水墨挂轴）
 *
 * 顺应手机 9:19 竖屏比例，按《溪山行旅图》式立轴重新构图（420 × 3520）：
 * - 零缩放，单手拇指顺水从东海一路向下溯洄至雪域拉萨；
 * - 45 处地名均为手机原生可读字号（15–16px），两侧写意远山与烟岚留白；
 * - 选中任意一处时，立轴自动滑至上半屏（约 26% 处）露出地标与朱砂长弧，不被抽屉遮挡。
 */

import type { Place } from "@/lib/places/types";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useRef } from "react";
import type { MountainSilhouette, OrganicRiver } from "./atlas-data";
import {
  HANGING_CHAPTERS,
  HANGING_H,
  HANGING_MOUNTAINS,
  HANGING_RIVERS,
  HANGING_STOPS,
  HANGING_W,
  type MobileStop,
} from "./mobile-data";
import {
  PlaceGlyph,
  brushRiverPath,
  glyphOf,
  inkMountainPath,
  splineCenterPath,
} from "./shared";

const EASE = [0.23, 1, 0.32, 1] as const;

function songsOf(place: Place): Set<number> {
  return new Set(place.entries.map((e) => e.songId));
}

function HangingMountain({ m }: { m: MountainSilhouette }) {
  const fillPath = useMemo(() => inkMountainPath(m.ridge, m.baseY), [m]);
  const ridgePath = useMemo(() => splineCenterPath(m.ridge, 10), [m]);
  return (
    <g opacity={m.opacity}>
      <path d={fillPath} fill={`url(#hang-mtn-${m.tone})`} />
      <path
        d={ridgePath}
        fill="none"
        stroke={`var(--mtn-${m.tone})`}
        strokeWidth={0.8}
        strokeLinecap="round"
        opacity={0.5}
      />
    </g>
  );
}

function HangingRiver({
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
        ? splineCenterPath(river.pts, 12, -river.rippleOffset * 0.8)
        : null,
    [river],
  );

  return (
    <g
      className="transition-opacity duration-500"
      style={{ opacity: dimmed ? 0.32 : 1 }}
    >
      {river.dashed ? (
        <path
          d={center}
          fill="none"
          stroke="var(--river)"
          strokeWidth={1.4}
          strokeDasharray="4 6"
          strokeLinecap="round"
          opacity={0.6}
        />
      ) : (
        <>
          <path
            d={body}
            fill="var(--river-wash)"
            opacity={0.22}
            transform="translate(1.2, 0)"
          />
          <path d={body} fill="var(--river)" opacity={0.86} />
          {ripple && (
            <path
              d={ripple}
              fill="none"
              stroke="var(--river-wash)"
              strokeWidth={0.7}
              strokeDasharray="16 14 6 12"
              strokeLinecap="round"
              opacity={0.35}
            />
          )}
          {ripple2 && (
            <path
              d={ripple2}
              fill="none"
              stroke="var(--river-wash)"
              strokeWidth={0.6}
              strokeDasharray="10 16 18 12"
              strokeLinecap="round"
              opacity={0.26}
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
              fontSize: label.large ? 22 : 12.5,
              opacity: 0.65,
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
            className="fill-(--river) font-serif tracking-[0.22em]"
            style={{ fontSize: 11.5, opacity: 0.68 }}
          >
            {river.name}
          </text>
        );
      })()}
    </g>
  );
}

export default function MobileHangingScroll({
  places,
  placeById,
  selected,
  kin,
  reduce,
  title,
  tagline,
  countText,
  creditText,
  onPick,
  onClear,
}: {
  places: Place[];
  placeById: Map<number, Place>;
  selected: Place | null;
  kin: Set<number>;
  reduce: boolean;
  title: string;
  tagline: string;
  countText: string;
  creditText: string;
  onPick: (id: number) => void;
  onClear: () => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const stopById = useMemo(
    () => new Map(HANGING_STOPS.map((s) => [s.id, s])),
    [],
  );

  // 选中地点变化时，将其平滑滚至上半屏约 26% 处，完整露在词句抽屉之上
  useEffect(() => {
    if (!selected) return;
    const stop = stopById.get(selected.id);
    const scroller = scrollRef.current;
    const svg = svgRef.current;
    if (!stop || !scroller || !svg) return;
    const scale = svg.clientWidth / HANGING_W;
    const targetTop = Math.max(
      0,
      stop.y * scale - scroller.clientHeight * 0.26,
    );
    scroller.scrollTo({
      top: targetTop,
      behavior: reduce ? "auto" : "smooth",
    });
  }, [selected, stopById, reduce]);

  const jumpToY = (svgY: number) => {
    const scroller = scrollRef.current;
    const svg = svgRef.current;
    if (!scroller || !svg) return;
    const scale = svg.clientWidth / HANGING_W;
    scroller.scrollTo({
      top: Math.max(0, svgY * scale - 44),
      behavior: reduce ? "auto" : "smooth",
    });
  };

  const threads = useMemo(() => {
    if (!selected) return [];
    const pairs: { key: string; from: MobileStop; to: MobileStop }[] = [];
    for (const songId of songsOf(selected)) {
      const along = HANGING_STOPS.filter((s) =>
        placeById.get(s.id)?.entries.some((e) => e.songId === songId),
      ).sort((a, b) => a.y - b.y);
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

  const dimmed = selected !== null;
  void places;

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
      {/* 顶部极轻的五境章回速跳条 */}
      <div className="z-10 shrink-0 border-b border-(--ink)/10 bg-(--paper)/88 px-3 py-2 backdrop-blur-sm">
        <div className="flex items-center justify-between gap-2 text-[11px] tracking-[0.22em] text-(--ink-muted)">
          {HANGING_CHAPTERS.map((ch) => (
            <button
              key={ch.id}
              type="button"
              onClick={() => jumpToY(ch.y)}
              className="cursor-pointer truncate py-0.5 transition-colors active:text-(--seal)"
            >
              {ch.name.slice(0, 2)}
            </button>
          ))}
        </div>
      </div>

      {/* 竖向立轴本体：原生丝滑纵滑，零缩放 */}
      <div
        ref={scrollRef}
        onClick={() => {
          if (selected) onClear();
        }}
        className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain px-2.5 pt-3 pb-24"
      >
        <div className="mx-auto max-w-[440px] border border-(--ink)/15 p-1">
          <div className="relative overflow-hidden border border-(--ink)/22 bg-(--paper)">
            <svg
              ref={svgRef}
              viewBox={`0 0 ${HANGING_W} ${HANGING_H}`}
              role="group"
              aria-label="河图志 · 溯洄立轴"
              className="block h-auto w-full select-none"
            >
              <defs>
                <filter
                  id="hang-grain"
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
                <linearGradient id="hang-mtn-1" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--mtn-1)" stopOpacity="0.86" />
                  <stop
                    offset="64%"
                    stopColor="var(--mtn-1)"
                    stopOpacity="0.26"
                  />
                  <stop offset="100%" stopColor="var(--mtn-1)" stopOpacity="0" />
                </linearGradient>
                <linearGradient id="hang-mtn-2" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--mtn-2)" stopOpacity="0.88" />
                  <stop
                    offset="66%"
                    stopColor="var(--mtn-2)"
                    stopOpacity="0.24"
                  />
                  <stop offset="100%" stopColor="var(--mtn-2)" stopOpacity="0" />
                </linearGradient>
                <linearGradient id="hang-mtn-3" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--mtn-3)" stopOpacity="0.82" />
                  <stop
                    offset="68%"
                    stopColor="var(--mtn-3)"
                    stopOpacity="0.2"
                  />
                  <stop offset="100%" stopColor="var(--mtn-3)" stopOpacity="0" />
                </linearGradient>
                <radialGradient id="hang-lake" cx="50%" cy="50%" r="54%">
                  <stop offset="0%" stopColor="var(--river)" stopOpacity="0.34" />
                  <stop
                    offset="72%"
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

              {/* ── 卷首天头（装裱题签） ── */}
              <g
                className="transition-opacity duration-500"
                style={{ opacity: dimmed ? 0.35 : 1 }}
              >
                {/* 巨幅竖排刻本标题 */}
                <g
                  className="fill-(--ink) font-calligraphy"
                  style={{ fontSize: 48 }}
                >
                  {[...title].map((ch, i) => (
                    <text
                      key={i}
                      x={210}
                      y={62 + i * 50}
                      textAnchor="middle"
                    >
                      {ch}
                    </text>
                  ))}
                </g>

                {/* 朱砂印「溯洄」 */}
                <g transform="translate(248, 128)">
                  <rect
                    width={20}
                    height={38}
                    rx={2}
                    fill="var(--seal)"
                    fillOpacity={0.12}
                    stroke="var(--seal)"
                    strokeWidth={0.95}
                  />
                  <text
                    x={10}
                    y={15}
                    textAnchor="middle"
                    className="fill-(--seal) font-calligraphy"
                    style={{ fontSize: 12 }}
                  >
                    溯
                  </text>
                  <text
                    x={10}
                    y={30}
                    textAnchor="middle"
                    className="fill-(--seal) font-calligraphy"
                    style={{ fontSize: 12 }}
                  >
                    洄
                  </text>
                </g>

                <text
                  x={210}
                  y={192}
                  textAnchor="middle"
                  className="fill-(--ink-muted) font-kaiti"
                  style={{ fontSize: 13.5 }}
                >
                  {tagline}
                </text>
                <text
                  x={210}
                  y={212}
                  textAnchor="middle"
                  className="fill-(--ink-muted) font-sans tracking-[0.26em]"
                  style={{ fontSize: 10.5, opacity: 0.78 }}
                >
                  {countText}
                </text>

                {/* 东海入海口三连波纹 */}
                <g
                  transform="translate(215, 232)"
                  fill="none"
                  stroke="var(--river)"
                  strokeWidth={0.85}
                  strokeLinecap="round"
                  opacity={0.35}
                >
                  <path d="M -38 0 Q -26 -6 -14 0 Q -2 -6 10 0 Q 22 -6 34 0" />
                  <path d="M -24 6 Q -12 1 0 6 Q 12 1 24 6" opacity={0.7} />
                </g>
              </g>

              {/* ── 写意层峦远山 ── */}
              <g
                className="transition-opacity duration-500"
                style={{ opacity: dimmed ? 0.42 : 1 }}
              >
                {HANGING_MOUNTAINS.map((m) => (
                  <HangingMountain key={m.id} m={m} />
                ))}
              </g>

              {/* ── 五境边缘水墨章回印题 ── */}
              <g
                className="pointer-events-none transition-opacity duration-500"
                style={{ opacity: dimmed ? 0.14 : 0.48 }}
              >
                {HANGING_CHAPTERS.map((ch) => {
                  const tx = ch.side === "r" ? 392 : 28;
                  return (
                    <g key={ch.id}>
                      <g
                        className="fill-(--ink) font-calligraphy"
                        style={{ fontSize: 22 }}
                      >
                        {[...ch.name].map((c, i) => (
                          <text
                            key={i}
                            x={tx}
                            y={ch.y + i * 24}
                            textAnchor="middle"
                          >
                            {c}
                          </text>
                        ))}
                      </g>
                      <line
                        x1={tx}
                        y1={ch.y + 98}
                        x2={tx}
                        y2={ch.y + 128}
                        stroke="var(--seal)"
                        strokeWidth={0.8}
                        opacity={0.5}
                      />
                    </g>
                  );
                })}
              </g>

              {/* ── 洞庭湖水域晕染 ── */}
              <ellipse
                cx={210}
                cy={1322}
                rx={44}
                ry={26}
                fill="url(#hang-lake)"
                stroke="var(--river)"
                strokeWidth={0.7}
                strokeOpacity={0.36}
                style={{ opacity: dimmed ? 0.3 : 1 }}
              />

              {/* ── 贯穿全轴的书法水脉 ── */}
              {HANGING_RIVERS.map((r) => (
                <HangingRiver key={r.id} river={r} dimmed={dimmed} />
              ))}

              {/* ── 同曲朱砂垂丝长弧 ── */}
              <AnimatePresence>
                {threads.map((th) => {
                  const dy = th.to.y - th.from.y;
                  const bulge = Math.min(110, 34 + dy * 0.16);
                  // 往中线外侧柔和拱开，不压地名
                  const side = th.from.x + th.to.x > HANGING_W ? -1 : 1;
                  const cx = (th.from.x + th.to.x) / 2 + side * bulge;
                  const cy = (th.from.y + th.to.y) / 2;
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
                      transition={{ duration: reduce ? 0 : 0.75, ease: EASE }}
                    />
                  );
                })}
              </AnimatePresence>

              {/* ── 全部 45 处原生可读地标 ── */}
              {HANGING_STOPS.map((stop) => {
                const place = placeById.get(stop.id);
                if (!place) return null;
                const active = selected?.id === stop.id;
                const isKin = kin.has(stop.id);
                const lit = active || isKin;
                const isDim = dimmed && !lit;
                const isRight = stop.dir === "r";
                const tx = isRight ? stop.x + 14 : stop.x - 14;

                return (
                  <g
                    key={stop.id}
                    role="button"
                    tabIndex={0}
                    aria-label={place.fullName ?? place.name}
                    aria-pressed={active}
                    className="cursor-pointer outline-none transition-opacity duration-500"
                    style={{ opacity: isDim ? 0.25 : 1 }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onPick(stop.id);
                    }}
                  >
                    {/* 宽裕的拇指热区 */}
                    <rect
                      x={isRight ? stop.x - 16 : stop.x - 115}
                      y={stop.y - 20}
                      width={132}
                      height={40}
                      fill="transparent"
                    />
                    <PlaceGlyph
                      kind={glyphOf(place.id)}
                      x={stop.x}
                      y={stop.y}
                      active={active}
                      kin={isKin}
                      scale={lit ? 1.18 : 1.05}
                    />
                    <text
                      x={tx}
                      y={stop.y + 5.5}
                      textAnchor={isRight ? "start" : "end"}
                      className={
                        active
                          ? "fill-(--seal) font-serif font-bold"
                          : isKin
                            ? "fill-(--seal) font-serif"
                            : "fill-(--ink) font-serif"
                      }
                      style={{ fontSize: 15.5 }}
                    >
                      {place.name}
                    </text>
                  </g>
                );
              })}

              {/* ── 卷尾落款 ── */}
              <g
                className="transition-opacity duration-500"
                style={{ opacity: dimmed ? 0.3 : 0.72 }}
              >
                <line
                  x1={160}
                  y1={3438}
                  x2={260}
                  y2={3438}
                  stroke="var(--ink)"
                  strokeWidth={0.6}
                  opacity={0.22}
                />
                <text
                  x={210}
                  y={3468}
                  textAnchor="middle"
                  className="fill-(--ink-muted) font-kaiti"
                  style={{ fontSize: 12.5 }}
                >
                  {creditText}
                </text>
                <text
                  x={210}
                  y={3490}
                  textAnchor="middle"
                  className="fill-(--ink-muted) font-sans tracking-[0.26em]"
                  style={{ fontSize: 10.5, opacity: 0.75 }}
                >
                  {countText}
                </text>
              </g>

              {/* 宣纸纤维噪点 */}
              <rect
                width={HANGING_W}
                height={HANGING_H}
                filter="url(#hang-grain)"
                opacity={0.04}
                className="pointer-events-none"
              />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}
