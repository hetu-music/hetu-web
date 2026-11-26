"use client";

/**
 * 方案一：古籍绢本舆图 · 总图与厢图（/lab/places/atlas）
 *
 * 宽屏：左栏读词、右侧双线乌丝栏画幅；
 * 窄屏：全出血可拖曳/双指缩放绢本画布 + 初见引首浮笺 + 底部「方域快切与水系目录」浮栏 +
 *       选点后自动平移至上半屏留图，下半屏升起 Base UI 宣纸词句抽屉。
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
  ATLAS_THEME_VARS,
  MobileCatalogDrawer,
  MobilePlaceDrawer,
  TouchViewport,
  type TouchViewportHandle,
} from "./MobileAtlasStage";
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

/** 窄屏底部方域快切预设（与三幅厢图互补，确保西北/东北不遗漏） */
type MobileRegionKey =
  | "all"
  | "jiangnan"
  | "changsha"
  | "yuanling"
  | "ganzhou"
  | "west";

const MOBILE_REGIONS: { key: MobileRegionKey; label: string }[] = [
  { key: "all", label: "全图" },
  { key: "jiangnan", label: "江南东海" },
  { key: "changsha", label: "长沙" },
  { key: "yuanling", label: "沅陵" },
  { key: "ganzhou", label: "赣州" },
  { key: "west", label: "关山雪域" },
];

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
        <text key={i} x={x} y={y + i * (size + 2)} textAnchor="middle">
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
      <path d="M -19 7 Q -10 1 -1 7 Q 8 1 17 7" opacity={0.75} />
      <path d="M -11 13 Q -2 8 7 13" opacity={0.5} />
    </g>
  );
}

/** 写意山水剪影（顶部细墨脊线 + 底部化入纸雾） */
function MountainWash({
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
          <path
            d={body}
            fill="var(--river-wash)"
            opacity={0.22}
            transform="translate(0, 1.4)"
          />
          <path d={body} fill="var(--river)" opacity={0.88} />
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
  fontSize = 16,
  hitRadius = 20,
  onEnter,
  onLeave,
  onPick,
}: {
  stop: AtlasStop;
  place: Place;
  state: "rest" | "dim" | "kin" | "current";
  fontSize?: number;
  hitRadius?: number;
  onEnter: () => void;
  onLeave: () => void;
  onPick: () => void;
}) {
  const { x, y, dir, vertical } = stop;
  const name = place.name;
  const chars = [...name];
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
      <circle cx={x} cy={y} r={hitRadius} fill="transparent" />
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
      <circle cx={x} cy={y} r={40} fill="transparent" />
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
        fill="var(--seal)"
        opacity={lit ? 1 : 0.78}
      />

      <text
        x={tx}
        y={y + 4}
        textAnchor={isLeft ? "end" : "start"}
        className="fill-(--ink) font-calligraphy transition-colors duration-300 group-hover:fill-(--seal)"
        style={{ fontSize: 30 }}
      >
        {name}
      </text>
      <text
        x={tx}
        y={y + 22}
        textAnchor={isLeft ? "end" : "start"}
        className="fill-(--seal) font-serif tracking-[0.22em] opacity-85 transition-opacity duration-300 group-hover:opacity-100"
        style={{ fontSize: 12 }}
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
      strokeWidth={1.45}
      strokeDasharray="5 5"
      strokeLinecap="round"
      initial={{ pathLength: 0, opacity: 0 }}
      animate={{ pathLength: 1, opacity: 0.88 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reduce ? 0 : 0.75, ease: EASE }}
    />
  );
}

/** 公用的 SVG 宣纸噪点与远山渐变 defs（按 prefix 隔离，避免桌面与窄屏 SVG id 撞车） */
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
      <linearGradient id={`${prefix}-mtn-1`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="var(--mtn-1)" stopOpacity="0.85" />
        <stop offset="65%" stopColor="var(--mtn-1)" stopOpacity="0.28" />
        <stop offset="100%" stopColor="var(--mtn-1)" stopOpacity="0" />
      </linearGradient>
      <linearGradient id={`${prefix}-mtn-2`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="var(--mtn-2)" stopOpacity="0.88" />
        <stop offset="68%" stopColor="var(--mtn-2)" stopOpacity="0.26" />
        <stop offset="100%" stopColor="var(--mtn-2)" stopOpacity="0" />
      </linearGradient>
      <linearGradient id={`${prefix}-mtn-3`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="var(--mtn-3)" stopOpacity="0.8" />
        <stop offset="70%" stopColor="var(--mtn-3)" stopOpacity="0.22" />
        <stop offset="100%" stopColor="var(--mtn-3)" stopOpacity="0" />
      </linearGradient>
      <radialGradient id={`${prefix}-lake`} cx="50%" cy="48%" r="54%">
        <stop offset="0%" stopColor="var(--river)" stopOpacity="0.34" />
        <stop offset="75%" stopColor="var(--river-wash)" stopOpacity="0.2" />
        <stop offset="100%" stopColor="var(--river-wash)" stopOpacity="0.04" />
      </radialGradient>
    </defs>
  );
}

/** 复用的总图 SVG 画幅 */
function OverviewMapSvg({
  prefix,
  className,
  coastPath,
  dimmed,
  reduce,
  threads,
  placeById,
  selected,
  kin,
  fontSize,
  hitRadius,
  onHover,
  onPick,
  onOpenCluster,
}: {
  prefix: string;
  className: string;
  coastPath: string;
  dimmed: boolean;
  reduce: boolean;
  threads: {
    key: string;
    from: { x: number; y: number };
    to: { x: number; y: number };
  }[];
  placeById: Map<number, Place>;
  selected: Place | null;
  kin: Set<number>;
  fontSize: number;
  hitRadius: number;
  onHover?: (id: number | null) => void;
  onPick: (id: number) => void;
  onOpenCluster: (id: ClusterId) => void;
}) {
  return (
    <svg
      viewBox={`0 0 ${ATLAS_VIEW.width} ${ATLAS_VIEW.height}`}
      role="group"
      aria-label="河图志 · 古籍绢本总图"
      className={className}
    >
      <AtlasSvgDefs prefix={prefix} />

      <g
        className="transition-opacity duration-500"
        style={{ opacity: dimmed ? 0.4 : 1 }}
      >
        {OVERVIEW_MOUNTAINS.map((m) => (
          <MountainWash key={m.id} m={m} prefix={prefix} />
        ))}
      </g>

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

      <g
        className="transition-opacity duration-500"
        style={{ opacity: dimmed ? 0.3 : 1 }}
      >
        <path
          d={DONGTING_LAKE_PATH}
          fill={`url(#${prefix}-lake)`}
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

      {OVERVIEW_RIVERS.map((r) => (
        <BrushRiver key={r.id} river={r} dimmed={dimmed} reduce={reduce} />
      ))}

      <AnimatePresence>
        {threads.map((th) => (
          <SilkThread
            key={th.key}
            from={th.from}
            to={th.to}
            reduce={reduce}
          />
        ))}
      </AnimatePresence>

      {CLUSTERS.map((cluster) => {
        const hasKin = cluster.placeIds.some((id) => kin.has(id));
        return (
          <ClusterSeal
            key={cluster.id}
            cluster={cluster}
            lit={hasKin}
            dimmed={dimmed}
            onOpen={() => onOpenCluster(cluster.id)}
          />
        );
      })}

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
            fontSize={fontSize}
            hitRadius={hitRadius}
            onEnter={() => onHover?.(stop.id)}
            onLeave={() => onHover?.(null)}
            onPick={() => onPick(stop.id)}
          />
        );
      })}

      <rect
        width={ATLAS_VIEW.width}
        height={ATLAS_VIEW.height}
        filter={`url(#${prefix}-grain)`}
        opacity={0.04}
        className="pointer-events-none"
      />
    </svg>
  );
}

/** 复用的厢图 SVG 画幅 */
function InsetMapSvg({
  prefix,
  cluster,
  className,
  dimmed,
  reduce,
  threads,
  placeById,
  selected,
  kin,
  fontSize,
  hitRadius,
  onHover,
  onPick,
}: {
  prefix: string;
  cluster: AtlasCluster;
  className: string;
  dimmed: boolean;
  reduce: boolean;
  threads: { key: string; from: AtlasStop; to: AtlasStop }[];
  placeById: Map<number, Place>;
  selected: Place | null;
  kin: Set<number>;
  fontSize: number;
  hitRadius: number;
  onHover?: (id: number | null) => void;
  onPick: (id: number) => void;
}) {
  return (
    <svg
      viewBox={`0 0 ${cluster.view.width} ${cluster.view.height}`}
      role="group"
      aria-label={`${cluster.name}厢图`}
      className={className}
    >
      <AtlasSvgDefs prefix={prefix} />

      <g
        className="transition-opacity duration-500"
        style={{ opacity: dimmed ? 0.42 : 1 }}
      >
        {cluster.mountains.map((m) => (
          <MountainWash key={m.id} m={m} prefix={prefix} />
        ))}
      </g>

      {cluster.rivers.map((r) => (
        <BrushRiver key={r.id} river={r} dimmed={dimmed} reduce={reduce} />
      ))}

      {cluster.islets?.map((d, i) => (
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

      <AnimatePresence>
        {threads.map((th) => (
          <SilkThread
            key={th.key}
            from={th.from}
            to={th.to}
            reduce={reduce}
          />
        ))}
      </AnimatePresence>

      {cluster.stops.map((stop) => {
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
            fontSize={fontSize}
            hitRadius={hitRadius}
            onEnter={() => onHover?.(stop.id)}
            onLeave={() => onHover?.(null)}
            onPick={() => onPick(stop.id)}
          />
        );
      })}

      <rect
        width={cluster.view.width}
        height={cluster.view.height}
        filter={`url(#${prefix}-grain)`}
        opacity={0.04}
        className="pointer-events-none"
      />
    </svg>
  );
}

/** 查任意地点在其所属视图（总图或对应厢图）中的 SVG 坐标 */
function stopCoordInView(
  id: number,
  cluster: AtlasCluster | null,
): { x: number; y: number } | null {
  if (cluster) {
    const s = cluster.stops.find((st) => st.id === id);
    return s ? { x: s.x, y: s.y } : null;
  }
  const s = OVERVIEW_STOPS.find((st) => st.id === id);
  return s ? { x: s.x, y: s.y } : null;
}

export default function AtlasClient({ places }: { places: Place[] }) {
  const t = useTranslations("places");
  const reduce = useMediaQuery("(prefers-reduced-motion: reduce)");
  const isNarrow = useMediaQuery("(max-width: 1023px)");

  const [activeClusterId, setActiveClusterId] = useState<ClusterId | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [hoverId, setHoverId] = useState<number | null>(null);

  // 移动端专属状态：初见引首浮笺、目录抽屉、当前激活方域快切
  const [showMobileIntro, setShowMobileIntro] = useState(true);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [mobileRegion, setMobileRegion] = useState<MobileRegionKey>("jiangnan");
  const mobileCamRef = useRef<TouchViewportHandle>(null);

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

  /** 窄屏选中某处后：自动把该地标平移到上半屏（anchorY = 0.27），避免被下半屏词句抽屉盖住 */
  useEffect(() => {
    if (!isNarrow || selectedId === null) return;
    const coord = stopCoordInView(selectedId, activeCluster);
    if (!coord) return;
    // 等总图/厢图切换挂载后下一帧平滑飞镜
    const raf = requestAnimationFrame(() => {
      const cam = mobileCamRef.current;
      if (!cam) return;
      const fit = cam.getFitScale();
      const targetScale = activeCluster
        ? Math.max(fit * 1.45, 0.68)
        : Math.max(fit * 2.55, 0.62);
      cam.flyTo({
        x: coord.x,
        y: coord.y,
        scale: targetScale,
        anchorY: 0.27,
      });
    });
    return () => cancelAnimationFrame(raf);
  }, [isNarrow, selectedId, activeCluster]);

  const goPlace = useCallback((id: number) => {
    const cluster = clusterOfPlace(id);
    setShowMobileIntro(false);
    setActiveClusterId(cluster ? cluster.id : null);
    if (cluster) setMobileRegion(cluster.id);
    setSelectedId(id);
    setHoverId(null);
  }, []);

  const togglePlace = useCallback((id: number) => {
    setShowMobileIntro(false);
    setSelectedId((cur) => (cur === id ? null : id));
  }, []);

  const openCluster = useCallback((id: ClusterId) => {
    setShowMobileIntro(false);
    setActiveClusterId(id);
    setMobileRegion(id);
    setSelectedId(null);
    setHoverId(null);
  }, []);

  /** 窄屏底部方域快切点击 */
  const pickMobileRegion = useCallback(
    (key: MobileRegionKey) => {
      setShowMobileIntro(false);
      setSelectedId(null);
      setMobileRegion(key);

      if (key === "changsha" || key === "yuanling" || key === "ganzhou") {
        setActiveClusterId(key);
        return;
      }

      const wasInCluster = activeClusterId !== null;
      if (wasInCluster) setActiveClusterId(null);

      // 下一帧操作总图相机
      requestAnimationFrame(() => {
        const cam = mobileCamRef.current;
        if (!cam) return;
        const fit = cam.getFitScale();
        if (key === "all") {
          cam.fitAll();
        } else if (key === "jiangnan") {
          cam.flyTo({ x: 1125, y: 445, scale: Math.max(fit * 2.35, 0.58) });
        } else if (key === "west") {
          cam.flyTo({ x: 390, y: 455, scale: Math.max(fit * 2.1, 0.52) });
        }
      });
    },
    [activeClusterId],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (selectedId !== null) setSelectedId(null);
      else if (activeClusterId !== null) setActiveClusterId(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedId, activeClusterId]);

  const overviewThreads = useMemo(() => {
    if (!selected || activeCluster) return [];
    const coordOf = (id: number): { x: number; y: number } | null => {
      const s = OVERVIEW_STOPS.find((st) => st.id === id);
      if (s) return { x: s.x, y: s.y };
      const c = clusterOfPlace(id);
      return c ? { x: c.x, y: c.y } : null;
    };
    const seen = new Set<string>();
    const pairs: {
      key: string;
      from: { x: number; y: number };
      to: { x: number; y: number };
    }[] = [];
    for (const songId of songsOf(selected)) {
      const ids = places
        .filter((p) => p.entries.some((e) => e.songId === songId))
        .map((p) => p.id);
      const pts = ids
        .map((id) => ({ id, pt: coordOf(id) }))
        .filter(
          (item): item is { id: number; pt: { x: number; y: number } } =>
            item.pt !== null,
        );
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

  const insetThreads = useMemo(() => {
    if (!selected || !activeCluster) return [];
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
    return pairs;
  }, [selected, activeCluster, placeById]);

  const coastPath = useMemo(() => splineCenterPath(COASTLINE_PTS, 14), []);
  const dimmed = selected !== null;
  const count = t("count", { places: places.length, songs: songCount });

  // 窄屏视图初始落点：总图聚焦江南潇湘核心，厢图居中铺满
  const mobileInitialFocus = useMemo(() => {
    if (!activeCluster) {
      return { x: 960, y: 530, scaleMultiplier: 2.3 };
    }
    return {
      x: activeCluster.view.width * 0.5,
      y: activeCluster.view.height * 0.48,
      scaleMultiplier: 1.38,
    };
  }, [activeCluster]);

  const mobileContentW = activeCluster
    ? activeCluster.view.width
    : ATLAS_VIEW.width;
  const mobileContentH = activeCluster
    ? activeCluster.view.height
    : ATLAS_VIEW.height;

  return (
    <div
      className={`min-h-svh bg-(--paper) text-(--ink) transition-colors duration-300 ${ATLAS_THEME_VARS}`}
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

      {/* ══════════════════════════════════════════════════════════════════════
          一、宽屏布局（lg 及以上）：左栏读词 + 右侧双线乌丝栏画幅
          ══════════════════════════════════════════════════════════════════════ */}
      <div className="relative z-10 hidden min-h-svh pt-20 lg:grid lg:grid-cols-[minmax(19.5rem,24vw)_minmax(0,1fr)]">
        <aside className="sticky top-20 flex h-[calc(100svh-5rem)] flex-col justify-between px-10 py-10 xl:px-14">
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
                onClick={() => openCluster(c.id)}
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

        <main
          className="relative flex min-w-0 flex-col items-center justify-center p-8"
          onClick={() => setSelectedId(null)}
        >
          <div className="relative w-full max-w-[1440px] border border-(--ink)/14 p-2">
            <div className="relative overflow-hidden border border-(--ink)/22 bg-(--paper)">
              <AnimatePresence mode="wait">
                {!activeCluster ? (
                  <motion.div
                    key="desktop-overview"
                    initial={{ opacity: 0, scale: 0.985 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 1.02 }}
                    transition={{ duration: reduce ? 0 : 0.45, ease: EASE }}
                    className="w-full"
                  >
                    <OverviewMapSvg
                      prefix="desk-ov"
                      className="block h-auto max-h-[calc(100svh-8.5rem)] w-full select-none"
                      coastPath={coastPath}
                      dimmed={dimmed}
                      reduce={reduce}
                      threads={overviewThreads}
                      placeById={placeById}
                      selected={selected}
                      kin={kin}
                      fontSize={16}
                      hitRadius={20}
                      onHover={setHoverId}
                      onPick={togglePlace}
                      onOpenCluster={openCluster}
                    />
                  </motion.div>
                ) : (
                  <motion.div
                    key={`desktop-inset-${activeCluster.id}`}
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    transition={{ duration: reduce ? 0 : 0.45, ease: EASE }}
                    className="relative w-full"
                  >
                    <div className="pointer-events-none absolute top-6 right-7 z-10 flex items-start gap-3">
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
                      <div className="text-right">
                        <p className="font-calligraphy text-3xl leading-none text-(--ink)/85">
                          {activeCluster.name}厢图
                        </p>
                        <p className="mt-1 text-[11px] tracking-[0.26em] text-(--ink-muted)">
                          {activeCluster.subtitle}
                        </p>
                      </div>
                    </div>

                    <InsetMapSvg
                      prefix={`desk-in-${activeCluster.id}`}
                      cluster={activeCluster}
                      className="block h-auto max-h-[calc(100svh-8.5rem)] w-full select-none"
                      dimmed={dimmed}
                      reduce={reduce}
                      threads={insetThreads}
                      placeById={placeById}
                      selected={selected}
                      kin={kin}
                      fontSize={16}
                      hitRadius={20}
                      onHover={setHoverId}
                      onPick={togglePlace}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-center gap-x-6 gap-y-1 text-[11px] tracking-[0.22em] text-(--ink-muted)/75">
            <span>山岳</span>
            <span>·</span>
            <span>楼台亭阁</span>
            <span>·</span>
            <span>江河渡口</span>
            <span>·</span>
            <span>城邑旧址</span>
            <span>·</span>
            <span>点聚落双环展厢图 · 点地标读词句</span>
          </div>
        </main>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          二、移动端全出血手势画布（< lg）：拖曳 / 双指缩放 / 方域快切 / 水系目录
          ══════════════════════════════════════════════════════════════════════ */}
      <div className="fixed inset-x-0 top-20 bottom-0 z-10 flex flex-col overflow-hidden lg:hidden">
        {/* 满屏可拖曳与双指缩放的绢本画布 */}
        <div className="relative min-h-0 flex-1">
          {/* 画幅内极细乌丝装帧线（不占位、保古籍感） */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-2 z-10 border border-(--ink)/12"
          />

          <TouchViewport
            ref={mobileCamRef}
            contentWidth={mobileContentW}
            contentHeight={mobileContentH}
            initialFocus={mobileInitialFocus}
            viewKey={activeCluster ? `in-${activeCluster.id}` : "overview"}
            reduce={reduce}
            onInteract={() => setShowMobileIntro(false)}
            onBackgroundTap={() => {
              setShowMobileIntro(false);
              if (selectedId !== null) setSelectedId(null);
            }}
          >
            {!activeCluster ? (
              <OverviewMapSvg
                prefix="mob-ov"
                className="block h-full w-full select-none"
                coastPath={coastPath}
                dimmed={dimmed}
                reduce={reduce}
                threads={overviewThreads}
                placeById={placeById}
                selected={selected}
                kin={kin}
                fontSize={18}
                hitRadius={26}
                onPick={togglePlace}
                onOpenCluster={openCluster}
              />
            ) : (
              <InsetMapSvg
                prefix={`mob-in-${activeCluster.id}`}
                cluster={activeCluster}
                className="block h-full w-full select-none"
                dimmed={dimmed}
                reduce={reduce}
                threads={insetThreads}
                placeById={placeById}
                selected={selected}
                kin={kin}
                fontSize={18}
                hitRadius={26}
                onPick={togglePlace}
              />
            )}
          </TouchViewport>

          {/* 厢图顶部浮动标题与返回总图 */}
          <AnimatePresence>
            {activeCluster && (
              <motion.div
                key={`mob-head-${activeCluster.id}`}
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.25, ease: EASE }}
                className="pointer-events-none absolute top-4 right-4 left-4 z-20 flex items-start justify-between"
              >
                <button
                  type="button"
                  onClick={() => pickMobileRegion("all")}
                  className="pointer-events-auto cursor-pointer border border-(--ink)/20 bg-(--paper)/88 px-3 py-1.5 text-xs tracking-[0.22em] text-(--ink) backdrop-blur-xs transition-colors active:border-(--seal) active:text-(--seal)"
                >
                  ← 总图
                </button>
                <div className="bg-(--paper)/75 px-2.5 py-1 text-right backdrop-blur-xs">
                  <p className="font-calligraphy text-2xl leading-none text-(--ink)">
                    {activeCluster.name}厢图
                  </p>
                  <p className="mt-0.5 text-[10px] tracking-[0.22em] text-(--ink-muted)">
                    {activeCluster.subtitle}
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* 右侧极轻单手缩放与归位小字按钮 */}
          <div className="absolute right-4 bottom-4 z-20 flex flex-col items-center divide-y divide-(--ink)/12 border border-(--ink)/16 bg-(--paper)/86 text-xs text-(--ink) backdrop-blur-xs">
            <button
              type="button"
              aria-label="放大舆图"
              onClick={() => {
                setShowMobileIntro(false);
                mobileCamRef.current?.zoomBy(1.38);
              }}
              className="flex h-9 w-9 cursor-pointer items-center justify-center font-serif text-base active:text-(--seal)"
            >
              +
            </button>
            <button
              type="button"
              aria-label="缩小舆图"
              onClick={() => {
                setShowMobileIntro(false);
                mobileCamRef.current?.zoomBy(0.72);
              }}
              className="flex h-9 w-9 cursor-pointer items-center justify-center font-serif text-base active:text-(--seal)"
            >
              −
            </button>
            <button
              type="button"
              aria-label="览全幅"
              onClick={() => {
                setShowMobileIntro(false);
                mobileCamRef.current?.fitAll();
              }}
              className="flex h-9 w-9 cursor-pointer items-center justify-center font-serif text-[11px] tracking-wider active:text-(--seal)"
            >
              全
            </button>
          </div>

          {/* 初见「引首浮笺」：手指一拖或一点画布即优雅淡出，把屏幕还给山水 */}
          <AnimatePresence>
            {showMobileIntro && !activeCluster && !selected && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                transition={{ duration: 0.4, ease: EASE }}
                onClick={() => setShowMobileIntro(false)}
                className="absolute bottom-4 left-4 z-20 max-w-[15.5rem] border border-(--ink)/15 bg-(--paper)/88 px-4 py-3.5 backdrop-blur-sm"
              >
                <div className="flex items-end gap-2.5">
                  <h1 className="font-calligraphy text-5xl leading-none text-(--ink) [writing-mode:vertical-rl]">
                    {t("title")}
                  </h1>
                  <div className="pb-0.5">
                    <SealStamp text="溯洄" className="mb-2 scale-90" />
                    <p className="font-kaiti text-xs leading-relaxed text-(--ink-muted)">
                      {t("tagline")}
                    </p>
                    <p className="mt-1.5 text-[10px] tracking-[0.22em] text-(--ink-muted)/80">
                      {count}
                    </p>
                  </div>
                </div>
                <p className="mt-2.5 border-t border-(--ink)/10 pt-2 text-[10px] tracking-[0.24em] text-(--seal)/85">
                  单指拖曳 · 双指缩放 · 点地标读词
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* 底部「方域快切 + 水系目录」浮栏（适配 iPhone 底部安全区） */}
        <nav
          aria-label="方域与水系目录"
          className="relative z-20 shrink-0 border-t border-(--ink)/14 bg-(--paper)/94 px-3 pt-2 pb-[calc(0.6rem+env(safe-area-inset-bottom))] backdrop-blur-md"
        >
          <div className="flex items-center gap-2">
            <div className="mask-linear-fade-edges flex min-w-0 flex-1 items-center gap-4 overflow-x-auto px-2 py-1 no-scrollbar">
              {MOBILE_REGIONS.map((r) => {
                const active = activeClusterId
                  ? activeClusterId === r.key
                  : mobileRegion === r.key;
                return (
                  <button
                    key={r.key}
                    type="button"
                    onClick={() => pickMobileRegion(r.key)}
                    className={`shrink-0 cursor-pointer text-xs tracking-[0.22em] transition-colors ${
                      active
                        ? "font-serif font-semibold text-(--seal)"
                        : "text-(--ink-muted) active:text-(--ink)"
                    }`}
                  >
                    {r.label}
                  </button>
                );
              })}
            </div>

            <span
              aria-hidden
              className="h-3.5 w-px shrink-0 bg-(--ink)/18"
            />

            <button
              type="button"
              onClick={() => {
                setShowMobileIntro(false);
                setCatalogOpen(true);
              }}
              className="shrink-0 cursor-pointer px-2 py-1 font-serif text-xs tracking-[0.24em] text-(--ink) transition-colors active:text-(--seal)"
            >
              目录
            </button>
          </div>
        </nav>
      </div>

      {/* 移动端：水系目录册页抽屉 */}
      {isNarrow && (
        <MobileCatalogDrawer
          open={catalogOpen}
          onOpenChange={setCatalogOpen}
          places={places}
          selectedId={selectedId}
          countText={count}
          creditText={t("credit")}
          elsewhereLabel={t("elsewhere")}
          onSelectPlace={goPlace}
        />
      )}

      {/* 移动端：选点后的下半屏词句抽屉（透明遮罩，上半屏山水与朱砂游丝完整可见） */}
      {isNarrow && (
        <MobilePlaceDrawer
          place={selected}
          siblings={selected ? siblingsOf(selected) : []}
          onClose={() => setSelectedId(null)}
          onGo={goPlace}
        />
      )}
    </div>
  );
}
