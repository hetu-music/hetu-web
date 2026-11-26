"use client";

/**
 * 方案一：古籍绢本舆图 · 总图与厢图（/lab/places/atlas）
 *
 * 以清代手绘水系舆图与古籍刻本为灵感：
 * - 摒弃地铁折线，用样条变宽书法笔触画河，辅以写意远山与简笔海水纹；
 * - 总图疏朗留白，把长沙（11处）、沅陵（9处）、赣州（3处）收成三枚聚落印记，
 *   点击可展开局部「厢图」细赏两岸山水与站点；
 * - 浅色为暖宣旧绢 + 花青水脉 + 朱砂印泥，深色为磁青纸 + 哑光泥金（不做廉价霓虹泛光）。
 */

import TopBar from "@/components/shared/topbar/TopBar";
import { useMediaQuery } from "@/hooks/ui/useMediaQuery";
import type { Place } from "@/lib/places/types";
import { AnimatePresence, motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ATLAS_VIEW,
  CLUSTERS,
  COASTLINE_PTS,
  DONGTING_LAKE_PATH,
  OVERVIEW_MOUNTAINS,
  OVERVIEW_RIVERS,
  OVERVIEW_SEAS,
  OVERVIEW_STOPS,
  SEA_RIPPLES,
  clusterOfPlace,
  type AtlasCluster,
  type AtlasStop,
  type ClusterId,
  type MountainSilhouette,
  type OrganicRiver,
} from "./atlas-data";
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

function StackedText({
  text,
  x,
  y,
  size = 15,
  className = "",
  opacity = 1,
}: {
  text: string;
  x: number;
  y: number;
  size?: number;
  className?: string;
  opacity?: number;
}) {
  return (
    <g className={className} style={{ fontSize: size, opacity }}>
      {[...text].map((ch, i) => (
        <text
          key={i}
          x={x}
          y={y + i * (size + 2)}
          textAnchor="middle"
        >
          {ch}
        </text>
      ))}
    </g>
  );
}

/** 传统简笔海波纹（三连弧） */
function SeaWaveMotif({
  x,
  y,
  scale = 1,
}: {
  x: number;
  y: number;
  scale?: number;
}) {
  return (
    <g
      transform={`translate(${x}, ${y}) scale(${scale})`}
      fill="none"
      stroke="var(--river)"
      strokeWidth={0.9}
      strokeLinecap="round"
      opacity={0.22}
    >
      <path d="M -26 0 Q -17 -7 -8 0 Q 1 -7 10 0 Q 19 -7 28 0" />
      <path
        d="M -19 7 Q -10 1 -1 7 Q 8 1 17 7"
        opacity={0.75}
      />
      <path d="M -11 13 Q -2 8 7 13" opacity={0.5} />
    </g>
  );
}

/** 写意山水剪影（顶部细墨脊线 + 底部化入纸雾） */
function MountainWash({ m }: { m: MountainSilhouette }) {
  const fillPath = useMemo(() => inkMountainPath(m.ridge, m.baseY), [m]);
  const ridgePath = useMemo(() => splineCenterPath(m.ridge, 10), [m]);
  return (
    <g opacity={m.opacity}>
      <path d={fillPath} fill={`url(#atlas-mtn-${m.tone})`} />
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

/** 变宽书法水脉（河身填充 + 伴行淡波纹） */
function BrushRiver({
  river,
  dimmed,
  reduce,
}: {
  river: OrganicRiver;
  dimmed: boolean;
  reduce: boolean;
}) {
  const body = useMemo(
    () =>
      brushRiverPath(river.pts, river.mouthWidth, river.sourceWidth ?? 0.6, {
        bothTaper: river.bothTaper,
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
        ? splineCenterPath(river.pts, 12, -river.rippleOffset * 0.85)
        : null,
    [river],
  );

  return (
    <motion.g
      initial={reduce ? false : { opacity: 0 }}
      animate={{ opacity: dimmed ? 0.28 : 1 }}
      transition={{
        duration: reduce ? 0 : 0.9,
        delay: reduce ? 0 : river.delay * 0.45,
        ease: EASE,
      }}
    >
      {river.dashed ? (
        <path
          d={center}
          fill="none"
          stroke="var(--river)"
          strokeWidth={1.6}
          strokeDasharray="4 6"
          strokeLinecap="round"
          opacity={0.65}
        />
      ) : (
        <>
          {/* 极淡的水晕底影 */}
          <path
            d={body}
            fill="var(--river-wash)"
            opacity={0.22}
            transform="translate(0, 1.4)"
          />
          {/* 书法变宽主河身 */}
          <path d={body} fill="var(--river)" opacity={0.88} />
          {/* 伴行水波细丝 */}
          {ripple && (
            <path
              d={ripple}
              fill="none"
              stroke="var(--river-wash)"
              strokeWidth={0.75}
              strokeDasharray="18 14 6 12"
              strokeLinecap="round"
              opacity={0.36}
            />
          )}
          {ripple2 && (
            <path
              d={ripple2}
              fill="none"
              stroke="var(--river-wash)"
              strokeWidth={0.65}
              strokeDasharray="10 18 22 14"
              strokeLinecap="round"
              opacity={0.28}
            />
          )}
        </>
      )}

      {river.label &&
        (river.label.vertical ? (
          <StackedText
            text={river.name}
            x={river.label.x}
            y={river.label.y}
            size={river.label.large ? 22 : 13}
            className={
              river.label.large
                ? "fill-(--river) font-calligraphy"
                : "fill-(--river) font-serif tracking-[0.2em]"
            }
            opacity={0.72}
          />
        ) : (
          <text
            x={river.label.x}
            y={river.label.y}
            className={
              river.label.large
                ? "fill-(--river) font-calligraphy"
                : "fill-(--river) font-serif tracking-[0.25em]"
            }
            style={{ fontSize: river.label.large ? 26 : 13, opacity: 0.72 }}
          >
            {river.name}
          </text>
        ))}
    </motion.g>
  );
}

/** 单个地点标与文字 */
function AtlasMarker({
  stop,
  place,
  state,
  fontSize = 15,
  onEnter,
  onLeave,
  onPick,
}: {
  stop: AtlasStop;
  place: Place;
  state: "rest" | "dim" | "kin" | "current";
  fontSize?: number;
  onEnter: () => void;
  onLeave: () => void;
  onPick: () => void;
}) {
  const { x, y, dir, vertical } = stop;
  const name = place.name;
  const chars = [...name];
  const gap = 12;
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
          ? y - gap - 3 - (chars.length - 1) * step
          : y + gap + fontSize - 2;
      return (
        <g className={textClass} style={{ fontSize }}>
          {chars.map((ch, i) => (
            <text
              key={i}
              x={x}
              y={startY + i * step}
              textAnchor="middle"
            >
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
        y={y + fontSize * 0.34}
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
      {/* 慷慨的点击热区 */}
      <circle cx={x} cy={y} r={20} fill="transparent" />
      <PlaceGlyph
        kind={glyphOf(place.id)}
        x={x}
        y={y}
        active={active}
        kin={kin}
        scale={lit ? 1.15 : 1}
      />
      {renderLabel()}
    </g>
  );
}

/** 总图上的聚落印记（长沙 / 沅陵 / 赣州）：点开进入厢图 */
function ClusterSeal({
  cluster,
  lit,
  dimmed,
  onOpen,
}: {
  cluster: AtlasCluster;
  lit: boolean;
  dimmed: boolean;
  onOpen: () => void;
}) {
  const { x, y, labelDir, name, countLabel } = cluster;
  const isLeft = labelDir === "l";
  const tx = isLeft ? x - 26 : x + 26;

  return (
    <g
      role="button"
      tabIndex={0}
      aria-label={`展开${name}厢图（${countLabel}）`}
      className="group cursor-pointer outline-none transition-opacity duration-500"
      style={{ opacity: dimmed && !lit ? 0.3 : 1 }}
      onClick={(e) => {
        e.stopPropagation();
        onOpen();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
    >
      <circle cx={x} cy={y} r={34} fill="transparent" />
      {/* 外圈虚线水纹环 */}
      <circle
        cx={x}
        cy={y}
        r={18}
        fill="var(--paper)"
        fillOpacity={0.65}
        stroke={lit ? "var(--seal)" : "var(--river)"}
        strokeWidth={1}
        strokeDasharray="3 3"
        className="transition-all duration-300 group-hover:stroke-(--seal)"
      />
      {/* 内环朱砂/黛青双圆 */}
      <circle
        cx={x}
        cy={y}
        r={11}
        fill="none"
        stroke={lit ? "var(--seal)" : "var(--ink)"}
        strokeWidth={1.15}
        opacity={0.75}
        className="transition-colors duration-300 group-hover:stroke-(--seal)"
      />
      <circle
        cx={x}
        cy={y}
        r={3.5}
        fill={lit ? "var(--seal)" : "var(--seal)"}
        opacity={lit ? 1 : 0.78}
      />

      {/* 刻本聚落大名 + 处数小注 */}
      <text
        x={tx}
        y={y + 4}
        textAnchor={isLeft ? "end" : "start"}
        className="fill-(--ink) font-calligraphy transition-colors duration-300 group-hover:fill-(--seal)"
        style={{ fontSize: 29 }}
      >
        {name}
      </text>
      <text
        x={tx}
        y={y + 21}
        textAnchor={isLeft ? "end" : "start"}
        className="fill-(--seal) font-serif tracking-[0.22em] opacity-80 transition-opacity duration-300 group-hover:opacity-100"
        style={{ fontSize: 11.5 }}
      >
        {countLabel} · 展厢图
      </text>
    </g>
  );
}

/** 同曲朱砂游丝弧线 */
function SilkThread({
  from,
  to,
  reduce,
}: {
  from: { x: number; y: number };
  to: { x: number; y: number };
  reduce: boolean;
}) {
  const [a, b] = from.x <= to.x ? [from, to] : [to, from];
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dist = Math.hypot(dx, dy) || 1;
  const bulge = Math.min(95, dist * 0.22);
  const cx = (a.x + b.x) / 2 + (dy / dist) * bulge;
  const cy = (a.y + b.y) / 2 - (dx / dist) * bulge;

  return (
    <motion.path
      d={`M ${a.x} ${a.y} Q ${cx} ${cy} ${b.x} ${b.y}`}
      fill="none"
      stroke="var(--seal)"
      strokeWidth={1.35}
      strokeDasharray="5 5"
      strokeLinecap="round"
      initial={{ pathLength: 0, opacity: 0 }}
      animate={{ pathLength: 1, opacity: 0.85 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reduce ? 0 : 0.75, ease: EASE }}
    />
  );
}

/** 公用的 SVG 宣纸噪点与远山渐变 defs */
function AtlasSvgDefs({ prefix }: { prefix: string }) {
  return (
    <defs>
      <filter id={`${prefix}-grain`} x="0%" y="0%" width="100%" height="100%">
        <feTurbulence
          type="fractalNoise"
          baseFrequency="0.72"
          numOctaves="3"
          stitchTiles="stitch"
        />
        <feColorMatrix type="saturate" values="0" />
      </filter>
      <linearGradient id="atlas-mtn-1" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="var(--mtn-1)" stopOpacity="0.85" />
        <stop offset="65%" stopColor="var(--mtn-1)" stopOpacity="0.28" />
        <stop offset="100%" stopColor="var(--mtn-1)" stopOpacity="0" />
      </linearGradient>
      <linearGradient id="atlas-mtn-2" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="var(--mtn-2)" stopOpacity="0.88" />
        <stop offset="68%" stopColor="var(--mtn-2)" stopOpacity="0.26" />
        <stop offset="100%" stopColor="var(--mtn-2)" stopOpacity="0" />
      </linearGradient>
      <linearGradient id="atlas-mtn-3" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="var(--mtn-3)" stopOpacity="0.8" />
        <stop offset="70%" stopColor="var(--mtn-3)" stopOpacity="0.22" />
        <stop offset="100%" stopColor="var(--mtn-3)" stopOpacity="0" />
      </linearGradient>
      <radialGradient id="atlas-lake" cx="50%" cy="48%" r="54%">
        <stop offset="0%" stopColor="var(--river)" stopOpacity="0.34" />
        <stop offset="75%" stopColor="var(--river-wash)" stopOpacity="0.2" />
        <stop offset="100%" stopColor="var(--river-wash)" stopOpacity="0.04" />
      </radialGradient>
    </defs>
  );
}

export default function AtlasClient({ places }: { places: Place[] }) {
  const t = useTranslations("places");
  const reduce = useMediaQuery("(prefers-reduced-motion: reduce)");
  const [activeClusterId, setActiveClusterId] = useState<ClusterId | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [hoverId, setHoverId] = useState<number | null>(null);

  const placeById = useMemo(
    () => new Map(places.map((p) => [p.id, p])),
    [places],
  );

  const songCount = useMemo(
    () => new Set(places.flatMap((p) => [...songsOf(p)])).size,
    [places],
  );

  const activeCluster = useMemo(
    () => CLUSTERS.find((c) => c.id === activeClusterId) ?? null,
    [activeClusterId],
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
  const shown = hoverId ? (placeById.get(hoverId) ?? null) : selected;

  const kin = useMemo(
    () => new Set(selected ? siblingsOf(selected).map((p) => p.id) : []),
    [selected, siblingsOf],
  );

  /** 跳转到某处：如果它在某个厢图里，自动切入对应厢图；否则回总图 */
  const goPlace = useCallback((id: number) => {
    const cluster = clusterOfPlace(id);
    setActiveClusterId(cluster ? cluster.id : null);
    setSelectedId(id);
    setHoverId(null);
  }, []);

  const togglePlace = useCallback((id: number) => {
    setSelectedId((cur) => (cur === id ? null : id));
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (selectedId !== null) setSelectedId(null);
      else if (activeClusterId !== null) setActiveClusterId(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedId, activeClusterId]);

  /** 总图上的同曲朱砂连线（连向聚落内部的点，收束到聚落印记） */
  const overviewThreads = useMemo(() => {
    if (!selected || activeCluster) return [];
    const coordOf = (id: number): { x: number; y: number } | null => {
      const s = OVERVIEW_STOPS.find((st) => st.id === id);
      if (s) return { x: s.x, y: s.y };
      const c = clusterOfPlace(id);
      return c ? { x: c.x, y: c.y } : null;
    };
    const seen = new Set<string>();
    const pairs: { key: string; from: { x: number; y: number }; to: { x: number; y: number } }[] = [];
    for (const songId of songsOf(selected)) {
      const ids = places
        .filter((p) => p.entries.some((e) => e.songId === songId))
        .map((p) => p.id);
      const pts = ids
        .map((id) => ({ id, pt: coordOf(id) }))
        .filter((item): item is { id: number; pt: { x: number; y: number } } => item.pt !== null);
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1].pt;
        const b = pts[i].pt;
        if (a.x === b.x && a.y === b.y) continue;
        const key = `${songId}-${a.x},${a.y}-${b.x},${b.y}`;
        if (seen.has(key)) continue;
        seen.add(key);
        pairs.push({ key, from: a, to: b });
      }
    }
    return pairs;
  }, [selected, activeCluster, places]);

  /** 厢图内的同曲朱砂连线 */
  const insetThreads = useMemo(() => {
    if (!selected || !activeCluster) return [];
    const stopById = new Map(activeCluster.stops.map((s) => [s.id, s]));
    const pairs: { key: string; from: AtlasStop; to: AtlasStop }[] = [];
    for (const songId of songsOf(selected)) {
      const along = activeCluster.stops.filter((s) =>
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
    // 防止单点
    void stopById;
    return pairs;
  }, [selected, activeCluster, placeById]);

  const coastPath = useMemo(() => splineCenterPath(COASTLINE_PTS, 14), []);
  const dimmed = selected !== null;
  const count = t("count", { places: places.length, songs: songCount });

  return (
    <div
      className="min-h-svh bg-(--paper) text-(--ink) transition-colors duration-300
        [--paper:#F4EFE4] [--paper-edge:#EAE1CF] [--ink:#25221D] [--ink-muted:#7A7265]
        [--river:#2B4C65] [--river-wash:#6E91A8] [--seal:#B23A2A]
        [--mtn-1:#9AA6A0] [--mtn-2:#6F8D88] [--mtn-3:#B5A083]
        [--tone:#2B4C65]
        dark:[--paper:#0C131E] dark:[--paper-edge:#070C14] dark:[--ink:#EBE3D2] dark:[--ink-muted:#8C919B]
        dark:[--river:#C6A668] dark:[--river-wash:#577591] dark:[--seal:#DF7B5E]
        dark:[--mtn-1:#233548] dark:[--mtn-2:#254049] dark:[--mtn-3:#3E372B]
        dark:[--tone:#C6A668]"
    >
      <TopBar exit={{ kind: "logo" }} nav={<LabModeNav active="atlas" />} />

      {/* 极淡的宣纸暗角氛围 */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          background:
            "radial-gradient(ellipse at 54% 48%, transparent 45%, var(--paper-edge) 100%)",
          opacity: 0.75,
        }}
      />

      <div className="relative z-10 grid min-h-svh pt-20 lg:grid-cols-[minmax(19.5rem,24vw)_minmax(0,1fr)]">
        {/* 左侧书卷栏（宽屏常驻） */}
        <aside className="hidden lg:sticky lg:top-20 lg:flex lg:h-[calc(100svh-5rem)] lg:flex-col lg:justify-between lg:px-10 lg:py-10 xl:px-14">
          {/* 顶部：总图 / 厢图路径 */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs tracking-[0.26em] text-(--ink-muted)">
            <button
              type="button"
              onClick={() => {
                setActiveClusterId(null);
                setSelectedId(null);
              }}
              className={`cursor-pointer transition-colors ${
                !activeCluster
                  ? "font-serif font-semibold text-(--seal)"
                  : "hover:text-(--ink)"
              }`}
            >
              总图
            </button>
            {CLUSTERS.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  setActiveClusterId(c.id);
                  setSelectedId(null);
                }}
                className={`cursor-pointer transition-colors ${
                  activeClusterId === c.id
                    ? "font-serif font-semibold text-(--seal)"
                    : "hover:text-(--ink)"
                }`}
              >
                {c.name}
              </button>
            ))}
          </div>

          {/* 底部：卷首或选中地点的诗文 */}
          <div className="mt-auto pt-8">
            <AnimatePresence mode="wait" initial={false}>
              {shown ? (
                <motion.div
                  key={shown.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.3, ease: EASE }}
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="text-xs tracking-[0.28em] text-(--ink-muted)">
                      {shown.region}
                    </p>
                    {selected && (
                      <button
                        type="button"
                        onClick={() => setSelectedId(null)}
                        className="cursor-pointer text-[11px] tracking-[0.26em] text-(--ink-muted) transition-colors hover:text-(--seal)"
                      >
                        收起
                      </button>
                    )}
                  </div>
                  <h2 className="mt-2.5 mb-7 font-serif text-4xl font-semibold tracking-tight text-(--ink)">
                    {shown.fullName ?? shown.name}
                  </h2>
                  <PlaceReadingBody
                    place={shown}
                    siblings={siblingsOf(shown)}
                    onGo={goPlace}
                  />
                </motion.div>
              ) : (
                <motion.div
                  key={activeCluster ? `cluster-${activeCluster.id}` : "intro"}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.32, ease: EASE }}
                >
                  {activeCluster ? (
                    <>
                      <p className="text-xs tracking-[0.3em] text-(--seal)">
                        {activeCluster.subtitle}
                      </p>
                      <h1 className="mt-3 font-calligraphy text-7xl leading-none text-(--ink)">
                        {activeCluster.name}
                      </h1>
                      <p className="mt-6 font-kaiti text-base leading-loose text-(--ink-muted)">
                        此厢图收{activeCluster.name}水岸{activeCluster.countLabel}
                        。点一处地标读词句，或退回总图纵览全川。
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveClusterId(null);
                          setSelectedId(null);
                        }}
                        className="mt-6 cursor-pointer border-b border-(--seal)/50 pb-1 text-xs tracking-[0.3em] text-(--seal) transition-opacity hover:opacity-75"
                      >
                        ← 返回全国总图
                      </button>
                    </>
                  ) : (
                    <>
                      <div className="flex items-end gap-4">
                        <h1 className="font-calligraphy text-8xl leading-none text-(--ink) [writing-mode:vertical-rl]">
                          {t("title")}
                        </h1>
                        <SealStamp text="溯洄" className="mb-2" />
                      </div>
                      <p className="mt-8 font-kaiti text-lg leading-loose text-(--ink-muted)">
                        {t("tagline")}
                      </p>
                      <p className="mt-5 text-xs tracking-[0.26em] text-(--ink-muted)">
                        {count}
                      </p>
                      <p className="mt-1.5 text-xs tracking-[0.26em] text-(--ink-muted)/80">
                        {t("credit")}
                      </p>
                      <p className="mt-6 font-kaiti text-xs leading-relaxed text-(--ink-muted)/75">
                        总图疏朗留白；点「长沙」「沅陵」「赣州」印记可展开局部厢图。
                      </p>
                    </>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </aside>

        {/* 右侧绢本舆图画幅 */}
        <main
          className="relative flex min-w-0 flex-col items-center justify-center p-3 sm:p-6 lg:p-8"
          onClick={() => setSelectedId(null)}
        >
          {/* 窄屏顶部的总图 / 厢图切换 */}
          <div className="mb-3 flex w-full items-center justify-between px-1 lg:hidden">
            <div className="flex items-center gap-3 text-xs tracking-[0.24em] text-(--ink-muted)">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveClusterId(null);
                  setSelectedId(null);
                }}
                className={
                  !activeCluster ? "font-serif font-semibold text-(--seal)" : ""
                }
              >
                总图
              </button>
              {CLUSTERS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveClusterId(c.id);
                    setSelectedId(null);
                  }}
                  className={
                    activeClusterId === c.id
                      ? "font-serif font-semibold text-(--seal)"
                      : ""
                  }
                >
                  {c.name}
                </button>
              ))}
            </div>
            <SealStamp text="溯洄" className="scale-90" />
          </div>

          {/* 古籍乌丝栏双线图框 */}
          <div className="relative w-full max-w-[1440px] border border-(--ink)/14 p-1.5 sm:p-2">
            <div className="relative overflow-hidden border border-(--ink)/22 bg-(--paper)">
              <AnimatePresence mode="wait">
                {!activeCluster ? (
                  <motion.div
                    key="overview"
                    initial={{ opacity: 0, scale: 0.985 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 1.02 }}
                    transition={{ duration: reduce ? 0 : 0.45, ease: EASE }}
                    className="w-full"
                  >
                    <svg
                      viewBox={`0 0 ${ATLAS_VIEW.width} ${ATLAS_VIEW.height}`}
                      role="group"
                      aria-label="河图志 · 古籍绢本总图"
                      className="block h-auto max-h-[calc(100svh-8.5rem)] w-full select-none"
                    >
                      <AtlasSvgDefs prefix="overview" />

                      {/* 写意远山层峦 */}
                      <g
                        className="transition-opacity duration-500"
                        style={{ opacity: dimmed ? 0.4 : 1 }}
                      >
                        {OVERVIEW_MOUNTAINS.map((m) => (
                          <MountainWash key={m.id} m={m} />
                        ))}
                      </g>

                      {/* 蜿蜒海岸线与东海简笔水波 */}
                      <g
                        className="transition-opacity duration-500"
                        style={{ opacity: dimmed ? 0.3 : 1 }}
                      >
                        <path
                          d={coastPath}
                          fill="none"
                          stroke="var(--river)"
                          strokeWidth={1.15}
                          strokeDasharray="6 6"
                          opacity={0.42}
                        />
                        {SEA_RIPPLES.map((w, i) => (
                          <SeaWaveMotif key={i} {...w} />
                        ))}
                        {OVERVIEW_SEAS.map((s) => (
                          <StackedText
                            key={s.name}
                            text={s.name}
                            x={s.x}
                            y={s.y}
                            size={14}
                            className="fill-(--river) font-serif tracking-[0.25em]"
                            opacity={0.55}
                          />
                        ))}
                      </g>

                      {/* 洞庭湖水域（有机云水形态） */}
                      <g
                        className="transition-opacity duration-500"
                        style={{ opacity: dimmed ? 0.3 : 1 }}
                      >
                        <path
                          d={DONGTING_LAKE_PATH}
                          fill="url(#atlas-lake)"
                          stroke="var(--river)"
                          strokeWidth={0.9}
                          strokeOpacity={0.45}
                        />
                        <path
                          d={DONGTING_LAKE_PATH}
                          fill="none"
                          stroke="var(--river)"
                          strokeWidth={0.6}
                          strokeOpacity={0.28}
                          transform="translate(695 572) scale(0.76) translate(-695 -572)"
                        />
                      </g>

                      {/* 书法变宽水系 */}
                      {OVERVIEW_RIVERS.map((r) => (
                        <BrushRiver
                          key={r.id}
                          river={r}
                          dimmed={dimmed}
                          reduce={reduce}
                        />
                      ))}

                      {/* 同曲朱砂游丝弧线 */}
                      <AnimatePresence>
                        {overviewThreads.map((th) => (
                          <SilkThread
                            key={th.key}
                            from={th.from}
                            to={th.to}
                            reduce={reduce}
                          />
                        ))}
                      </AnimatePresence>

                      {/* 三处聚落印记（长沙 / 沅陵 / 赣州） */}
                      {CLUSTERS.map((cluster) => {
                        const hasKin = cluster.placeIds.some((id) =>
                          kin.has(id),
                        );
                        return (
                          <ClusterSeal
                            key={cluster.id}
                            cluster={cluster}
                            lit={hasKin}
                            dimmed={dimmed}
                            onOpen={() => {
                              setActiveClusterId(cluster.id);
                              setSelectedId(null);
                              setHoverId(null);
                            }}
                          />
                        );
                      })}

                      {/* 总图 22 处独立地点 */}
                      {OVERVIEW_STOPS.map((stop) => {
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
                          <AtlasMarker
                            key={stop.id}
                            stop={stop}
                            place={place}
                            state={state}
                            fontSize={16}
                            onEnter={() => setHoverId(stop.id)}
                            onLeave={() =>
                              setHoverId((cur) =>
                                cur === stop.id ? null : cur,
                              )
                            }
                            onPick={() => togglePlace(stop.id)}
                          />
                        );
                      })}

                      {/* 宣纸纤维微粒叠加 */}
                      <rect
                        width={ATLAS_VIEW.width}
                        height={ATLAS_VIEW.height}
                        filter="url(#overview-grain)"
                        opacity={0.04}
                        className="pointer-events-none"
                      />
                    </svg>
                  </motion.div>
                ) : (
                  <motion.div
                    key={`inset-${activeCluster.id}`}
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    transition={{ duration: reduce ? 0 : 0.45, ease: EASE }}
                    className="relative w-full"
                  >
                    {/* 厢图右上角题签与返回按钮 */}
                    <div className="pointer-events-none absolute top-4 right-5 z-10 flex items-start gap-3 sm:top-6 sm:right-7">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveClusterId(null);
                          setSelectedId(null);
                        }}
                        className="pointer-events-auto cursor-pointer border border-(--ink)/20 bg-(--paper)/85 px-3 py-1.5 text-xs tracking-[0.25em] text-(--ink) backdrop-blur-xs transition-colors hover:border-(--seal) hover:text-(--seal)"
                      >
                        ← 返回总图
                      </button>
                      <div className="hidden text-right sm:block">
                        <p className="font-calligraphy text-3xl leading-none text-(--ink)/85">
                          {activeCluster.name}厢图
                        </p>
                        <p className="mt-1 text-[11px] tracking-[0.26em] text-(--ink-muted)">
                          {activeCluster.subtitle}
                        </p>
                      </div>
                    </div>

                    <svg
                      viewBox={`0 0 ${activeCluster.view.width} ${activeCluster.view.height}`}
                      role="group"
                      aria-label={`${activeCluster.name}厢图`}
                      className="block h-auto max-h-[calc(100svh-8.5rem)] w-full select-none"
                    >
                      <AtlasSvgDefs prefix={`inset-${activeCluster.id}`} />

                      {/* 厢图山水背景 */}
                      <g
                        className="transition-opacity duration-500"
                        style={{ opacity: dimmed ? 0.42 : 1 }}
                      >
                        {activeCluster.mountains.map((m) => (
                          <MountainWash key={m.id} m={m} />
                        ))}
                      </g>

                      {/* 厢图局部河道 */}
                      {activeCluster.rivers.map((r) => (
                        <BrushRiver
                          key={r.id}
                          river={r}
                          dimmed={dimmed}
                          reduce={reduce}
                        />
                      ))}

                      {/* 江心沙洲（如橘子洲） */}
                      {activeCluster.islets?.map((d, i) => (
                        <path
                          key={i}
                          d={d}
                          fill="var(--paper)"
                          stroke="var(--river)"
                          strokeWidth={1}
                          strokeOpacity={0.6}
                          opacity={dimmed ? 0.35 : 0.92}
                        />
                      ))}

                      {/* 同曲朱砂游丝 */}
                      <AnimatePresence>
                        {insetThreads.map((th) => (
                          <SilkThread
                            key={th.key}
                            from={th.from}
                            to={th.to}
                            reduce={reduce}
                          />
                        ))}
                      </AnimatePresence>

                      {/* 厢图内地点 */}
                      {activeCluster.stops.map((stop) => {
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
                          <AtlasMarker
                            key={stop.id}
                            stop={stop}
                            place={place}
                            state={state}
                            fontSize={16}
                            onEnter={() => setHoverId(stop.id)}
                            onLeave={() =>
                              setHoverId((cur) =>
                                cur === stop.id ? null : cur,
                              )
                            }
                            onPick={() => togglePlace(stop.id)}
                          />
                        );
                      })}

                      <rect
                        width={activeCluster.view.width}
                        height={activeCluster.view.height}
                        filter={`url(#inset-${activeCluster.id}-grain)`}
                        opacity={0.04}
                        className="pointer-events-none"
                      />
                    </svg>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* 图注图例（极淡小字，不喧宾夺主） */}
          <div className="mt-3 flex flex-wrap items-center justify-center gap-x-6 gap-y-1 text-[11px] tracking-[0.22em] text-(--ink-muted)/75">
            <span>山岳</span>
            <span>·</span>
            <span>楼台亭阁</span>
            <span>·</span>
            <span>江河渡口</span>
            <span>·</span>
            <span>城邑旧址</span>
            <span className="hidden sm:inline">·</span>
            <span className="hidden sm:inline">
              点聚落双环展厢图 · 点地标读词句
            </span>
          </div>
        </main>
      </div>

      {/* 窄屏底部诗文面板 */}
      <AnimatePresence>
        {selected && (
          <motion.aside
            key={`mobile-${selected.id}`}
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            transition={{ duration: 0.35, ease: EASE }}
            className="fixed inset-x-0 bottom-0 z-30 max-h-[58svh] overflow-y-auto rounded-t-2xl border-t border-(--ink)/15 bg-(--paper)/96 px-6 pt-5 pb-9 backdrop-blur-md lg:hidden"
          >
            <div className="mb-3 flex items-baseline justify-between gap-4">
              <p className="text-xs tracking-[0.26em] text-(--ink-muted)">
                {selected.region}
              </p>
              <button
                type="button"
                onClick={() => setSelectedId(null)}
                className="text-xs tracking-[0.25em] text-(--ink-muted)"
              >
                收起
              </button>
            </div>
            <h2 className="mb-5 font-serif text-2xl font-semibold text-(--ink)">
              {selected.fullName ?? selected.name}
            </h2>
            <PlaceReadingBody
              place={selected}
              siblings={siblingsOf(selected)}
              onGo={goPlace}
              compact
            />
          </motion.aside>
        )}
      </AnimatePresence>
    </div>
  );
}
