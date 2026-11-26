"use client";

/**
 * 方案一移动端交互内核：
 * 1. TouchViewport：满屏手势画布（单指拖曳惯性 + 双指捏合以指间为中心缩放 + 双击缩放 + 相机平滑飞镜）；
 * 2. MobileCatalogDrawer：按《河图志》从入海口往上读的水系目录册页，披上绢本/磁青配色与古图符号；
 * 3. MobilePlaceDrawer：选点后的下半屏词句抽屉，与上半屏留图自动联动（复用 Base UI Drawer，贴合 iOS Safari）。
 */

import { TREE, type TreeNode } from "@/components/places/layout";
import { Drawer, DrawerContent } from "@/components/ui/drawer";
import type { Place } from "@/lib/places/types";
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { PlaceGlyph, PlaceReadingBody, glyphOf } from "./shared";

export interface CameraTarget {
  /** SVG 坐标系下的焦点 */
  x: number;
  y: number;
  /** 目标缩放倍率（不传则保持当前或取舒适倍率） */
  scale?: number;
  /** 焦点落在视口高度的比例（0.5 居中；选点时用 0.27 露在上半屏） */
  anchorY?: number;
  /** 跳过过渡动画 */
  instant?: boolean;
}

export interface TouchViewportHandle {
  flyTo: (target: CameraTarget) => void;
  fitAll: (instant?: boolean) => void;
  zoomBy: (factor: number) => void;
  getFitScale: () => number;
}

interface CamState {
  tx: number;
  ty: number;
  scale: number;
}

/** 方案一浅/深色宣纸与磁青主题变量，同时挂在页面根容器与 Base UI 抽屉上 */
export const ATLAS_THEME_VARS =
  "[--paper:#F4EFE4] [--paper-edge:#EAE1CF] [--ink:#25221D] [--ink-muted:#7A7265] " +
  "[--river:#2B4C65] [--river-wash:#6E91A8] [--seal:#B23A2A] " +
  "[--mtn-1:#9AA6A0] [--mtn-2:#6F8D88] [--mtn-3:#B5A083] [--tone:#2B4C65] " +
  "dark:[--paper:#0C131E] dark:[--paper-edge:#070C14] dark:[--ink:#EBE3D2] dark:[--ink-muted:#8C919B] " +
  "dark:[--river:#C6A668] dark:[--river-wash:#577591] dark:[--seal:#DF7B5E] " +
  "dark:[--mtn-1:#233548] dark:[--mtn-2:#254049] dark:[--mtn-3:#3E372B] dark:[--tone:#C6A668]";

export const TouchViewport = forwardRef<
  TouchViewportHandle,
  {
    contentWidth: number;
    contentHeight: number;
    /** 每次视图切换（总图 <-> 厢图）时的默认相机落点 */
    initialFocus: { x: number; y: number; scaleMultiplier: number };
    /** 切换此 key 会重置相机到 initialFocus */
    viewKey: string;
    reduce: boolean;
    onInteract?: () => void;
    onBackgroundTap?: () => void;
    children: React.ReactNode;
  }
>(function TouchViewport(
  {
    contentWidth,
    contentHeight,
    initialFocus,
    viewKey,
    reduce,
    onInteract,
    onBackgroundTap,
    children,
  },
  ref,
) {
  const boxRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const camRef = useRef<CamState>({ tx: 0, ty: 0, scale: 0.5 });
  const sizeRef = useRef<{ vw: number; vh: number }>({ vw: 390, vh: 680 });
  const rafRef = useRef<number>(0);

  // 多指手势追踪
  const pointersRef = useRef(new Map<number, { x: number; y: number }>());
  const gestureRef = useRef<{
    mode: "none" | "pan" | "pinch";
    startX: number;
    startY: number;
    startTx: number;
    startTy: number;
    moved: boolean;
    lastX: number;
    lastY: number;
    lastTime: number;
    vx: number;
    vy: number;
    pinchDist: number;
    pinchScale: number;
    pinchSvgX: number;
    pinchSvgY: number;
    lastTapTime: number;
    lastTapX: number;
    lastTapY: number;
  }>({
    mode: "none",
    startX: 0,
    startY: 0,
    startTx: 0,
    startTy: 0,
    moved: false,
    lastX: 0,
    lastY: 0,
    lastTime: 0,
    vx: 0,
    vy: 0,
    pinchDist: 1,
    pinchScale: 1,
    pinchSvgX: 0,
    pinchSvgY: 0,
    lastTapTime: 0,
    lastTapX: 0,
    lastTapY: 0,
  });

  const cancelAnim = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    }
  }, []);

  const boundsOf = useCallback(() => {
    const { vw, vh } = sizeRef.current;
    const fit = Math.min(vw / contentWidth, vh / contentHeight);
    const minScale = fit * 0.94;
    const maxScale = Math.max(fit * 4.5, 1.55);
    return { fit, minScale, maxScale, vw, vh };
  }, [contentWidth, contentHeight]);

  /** 温和约束平移边界：画幅比视口小时居中；比视口大时四周留少许宣纸留白，不拖出屏幕外 */
  const clampCam = useCallback(
    (cam: CamState): CamState => {
      const { minScale, maxScale, vw, vh } = boundsOf();
      const scale = Math.max(minScale, Math.min(maxScale, cam.scale));
      const sw = contentWidth * scale;
      const sh = contentHeight * scale;
      const padX = Math.min(84, vw * 0.22);
      const padY = Math.min(130, vh * 0.26);

      let tx = cam.tx;
      let ty = cam.ty;
      if (sw <= vw) {
        tx = (vw - sw) / 2;
      } else {
        tx = Math.min(padX, Math.max(vw - sw - padX, tx));
      }
      if (sh <= vh) {
        // 顶部和底部浮栏之外稍居中，仍允许轻微上下微调让选点露在上半屏
        const center = (vh - sh) / 2;
        ty = Math.min(center + vh * 0.14, Math.max(center - vh * 0.22, ty));
      } else {
        ty = Math.min(padY, Math.max(vh - sh - padY * 1.4, ty));
      }
      return { tx, ty, scale };
    },
    [boundsOf, contentWidth, contentHeight],
  );

  const applyCam = useCallback(
    (next: CamState) => {
      const clamped = clampCam(next);
      camRef.current = clamped;
      if (stageRef.current) {
        stageRef.current.style.transform = `translate3d(${clamped.tx.toFixed(1)}px, ${clamped.ty.toFixed(1)}px, 0) scale(${clamped.scale.toFixed(4)})`;
      }
    },
    [clampCam],
  );

  const animateTo = useCallback(
    (goal: CamState, instant = false) => {
      cancelAnim();
      const target = clampCam(goal);
      if (instant || reduce) {
        applyCam(target);
        return;
      }
      const start = { ...camRef.current };
      const t0 = performance.now();
      const dur = 500;
      const step = (now: number) => {
        const p = Math.min(1, (now - t0) / dur);
        const e = 1 - Math.pow(1 - p, 3);
        applyCam({
          tx: start.tx + (target.tx - start.tx) * e,
          ty: start.ty + (target.ty - start.ty) * e,
          scale: start.scale + (target.scale - start.scale) * e,
        });
        if (p < 1) {
          rafRef.current = requestAnimationFrame(step);
        } else {
          rafRef.current = 0;
        }
      };
      rafRef.current = requestAnimationFrame(step);
    },
    [applyCam, cancelAnim, clampCam, reduce],
  );

  const flyTo = useCallback(
    ({ x, y, scale, anchorY = 0.46, instant = false }: CameraTarget) => {
      const { vw, vh, fit } = boundsOf();
      const s = scale ?? Math.max(camRef.current.scale, fit * 2.1);
      animateTo(
        {
          scale: s,
          tx: vw * 0.5 - x * s,
          ty: vh * anchorY - y * s,
        },
        instant,
      );
    },
    [animateTo, boundsOf],
  );

  const fitAll = useCallback(
    (instant = false) => {
      const { vw, vh, fit } = boundsOf();
      const s = fit * 0.96;
      animateTo(
        {
          scale: s,
          tx: (vw - contentWidth * s) / 2,
          ty: (vh - contentHeight * s) / 2 - 12,
        },
        instant,
      );
    },
    [animateTo, boundsOf, contentWidth, contentHeight],
  );

  const zoomBy = useCallback(
    (factor: number) => {
      const { vw, vh } = sizeRef.current;
      const cur = camRef.current;
      const cx = vw * 0.5;
      const cy = vh * 0.46;
      const svgX = (cx - cur.tx) / cur.scale;
      const svgY = (cy - cur.ty) / cur.scale;
      const nextScale = cur.scale * factor;
      animateTo({
        scale: nextScale,
        tx: cx - svgX * nextScale,
        ty: cy - svgY * nextScale,
      });
    },
    [animateTo],
  );

  useImperativeHandle(
    ref,
    () => ({
      flyTo,
      fitAll,
      zoomBy,
      getFitScale: () => boundsOf().fit,
    }),
    [flyTo, fitAll, zoomBy, boundsOf],
  );

  // 容器尺寸观测 + 每次切换总图/厢图落在舒适的可读视角
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const placeInitial = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (w === 0 || h === 0) return;
      sizeRef.current = { vw: w, vh: h };
      const fit = Math.min(w / contentWidth, h / contentHeight);
      const s = fit * initialFocus.scaleMultiplier;
      applyCam({
        scale: s,
        tx: w * 0.5 - initialFocus.x * s,
        ty: h * 0.46 - initialFocus.y * s,
      });
    };
    placeInitial();
    const ro = new ResizeObserver(() => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (w === 0 || h === 0) return;
      const prev = sizeRef.current;
      sizeRef.current = { vw: w, vh: h };
      // 首次从 0 变成可见（窄屏挂载）时重新定位，避免落在左上角
      if (prev.vw === 0 || Math.abs(prev.vw - w) > 80) {
        placeInitial();
      } else {
        applyCam(camRef.current);
      }
    });
    ro.observe(el);
    return () => {
      ro.disconnect();
      cancelAnim();
    };
  }, [
    viewKey,
    contentWidth,
    contentHeight,
    initialFocus.x,
    initialFocus.y,
    initialFocus.scaleMultiplier,
    applyCam,
    cancelAnim,
  ]);

  // 桌面窄窗测试时也能滚轮缩放
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      cancelAnim();
      onInteract?.();
      const rect = el.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const cur = camRef.current;
      const factor = Math.exp(-e.deltaY * 0.0018);
      const nextScale = cur.scale * factor;
      const svgX = (mx - cur.tx) / cur.scale;
      const svgY = (my - cur.ty) / cur.scale;
      applyCam({
        scale: nextScale,
        tx: mx - svgX * nextScale,
        ty: my - svgY * nextScale,
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [applyCam, cancelAnim, onInteract]);

  /** 松手后的轻盈惯性滑行 */
  const startInertia = useCallback(
    (vx: number, vy: number) => {
      if (reduce || Math.hypot(vx, vy) < 0.35) return;
      cancelAnim();
      let curVx = vx * 14;
      let curVy = vy * 14;
      const step = () => {
        curVx *= 0.91;
        curVy *= 0.91;
        if (Math.hypot(curVx, curVy) < 0.25) {
          rafRef.current = 0;
          return;
        }
        const c = camRef.current;
        applyCam({ tx: c.tx + curVx, ty: c.ty + curVy, scale: c.scale });
        rafRef.current = requestAnimationFrame(step);
      };
      rafRef.current = requestAnimationFrame(step);
    },
    [applyCam, cancelAnim, reduce],
  );

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = boxRef.current;
    if (!el) return;
    cancelAnim();
    const rect = el.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    pointersRef.current.set(e.pointerId, { x: px, y: py });
    const g = gestureRef.current;

    if (pointersRef.current.size === 1) {
      g.mode = "pan";
      g.startX = px;
      g.startY = py;
      g.startTx = camRef.current.tx;
      g.startTy = camRef.current.ty;
      g.lastX = px;
      g.lastY = py;
      g.lastTime = performance.now();
      g.vx = 0;
      g.vy = 0;
      g.moved = false;
    } else if (pointersRef.current.size === 2) {
      const [p1, p2] = [...pointersRef.current.values()];
      const mx = (p1.x + p2.x) / 2;
      const my = (p1.y + p2.y) / 2;
      const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y) || 1;
      const cur = camRef.current;
      g.mode = "pinch";
      g.moved = true;
      g.pinchDist = dist;
      g.pinchScale = cur.scale;
      g.pinchSvgX = (mx - cur.tx) / cur.scale;
      g.pinchSvgY = (my - cur.ty) / cur.scale;
      onInteract?.();
    }
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!pointersRef.current.has(e.pointerId)) return;
    const el = boxRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    pointersRef.current.set(e.pointerId, { x: px, y: py });
    const g = gestureRef.current;

    if (g.mode === "pan" && pointersRef.current.size === 1) {
      const dx = px - g.startX;
      const dy = py - g.startY;
      if (!g.moved && Math.hypot(dx, dy) > 7) {
        g.moved = true;
        onInteract?.();
        try {
          el.setPointerCapture(e.pointerId);
        } catch {
          // 忽略偶发的 pointer capture 异常
        }
      }
      if (g.moved) {
        const now = performance.now();
        const dt = Math.max(8, now - g.lastTime);
        g.vx = (px - g.lastX) / dt;
        g.vy = (py - g.lastY) / dt;
        g.lastX = px;
        g.lastY = py;
        g.lastTime = now;
        applyCam({
          tx: g.startTx + dx,
          ty: g.startTy + dy,
          scale: camRef.current.scale,
        });
      }
    } else if (g.mode === "pinch" && pointersRef.current.size >= 2) {
      const [p1, p2] = [...pointersRef.current.values()];
      const mx = (p1.x + p2.x) / 2;
      const my = (p1.y + p2.y) / 2;
      const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y) || 1;
      const nextScale = g.pinchScale * (dist / g.pinchDist);
      applyCam({
        scale: nextScale,
        tx: mx - g.pinchSvgX * nextScale,
        ty: my - g.pinchSvgY * nextScale,
      });
    }
  };

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = boxRef.current;
    const g = gestureRef.current;
    const wasMoved = g.moved;
    const wasPan = g.mode === "pan";
    const vx = g.vx;
    const vy = g.vy;
    pointersRef.current.delete(e.pointerId);

    if (el?.hasPointerCapture(e.pointerId)) {
      try {
        el.releasePointerCapture(e.pointerId);
      } catch {
        // noop
      }
    }

    if (pointersRef.current.size === 1) {
      // 双指松开一只手：无缝切回单指拖曳
      const [rem] = [...pointersRef.current.values()];
      g.mode = "pan";
      g.startX = rem.x;
      g.startY = rem.y;
      g.startTx = camRef.current.tx;
      g.startTy = camRef.current.ty;
      g.moved = true;
      g.vx = 0;
      g.vy = 0;
      return;
    }

    if (pointersRef.current.size === 0) {
      g.mode = "none";
      if (wasPan && wasMoved) {
        startInertia(vx, vy);
      } else if (wasPan && !wasMoved && el) {
        // 判断双击空地缩放，或单击空地收起选中
        const target = e.target as HTMLElement | null;
        const onInteractive = Boolean(target?.closest("[role='button']"));
        if (!onInteractive) {
          const rect = el.getBoundingClientRect();
          const px = e.clientX - rect.left;
          const py = e.clientY - rect.top;
          const now = performance.now();
          if (
            now - g.lastTapTime < 280 &&
            Math.hypot(px - g.lastTapX, py - g.lastTapY) < 26
          ) {
            g.lastTapTime = 0;
            onInteract?.();
            const cur = camRef.current;
            const { fit } = boundsOf();
            if (cur.scale > fit * 2.5) {
              fitAll();
            } else {
              const svgX = (px - cur.tx) / cur.scale;
              const svgY = (py - cur.ty) / cur.scale;
              const nextScale = cur.scale * 1.65;
              animateTo({
                scale: nextScale,
                tx: px - svgX * nextScale,
                ty: py - svgY * nextScale,
              });
            }
          } else {
            g.lastTapTime = now;
            g.lastTapX = px;
            g.lastTapY = py;
            onBackgroundTap?.();
          }
        }
      }
    }
  };

  return (
    <div
      ref={boxRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      className="relative h-full w-full touch-none overflow-hidden select-none"
    >
      <div
        ref={stageRef}
        style={{
          width: contentWidth,
          height: contentHeight,
          transformOrigin: "0 0",
          willChange: "transform",
        }}
      >
        {children}
      </div>
    </div>
  );
});

// ─── 窄屏水系目录册页（从入海口往上读，点一项即飞过去） ─────────────────────────

function treeIds(nodes: TreeNode[], out = new Set<number>()): Set<number> {
  for (const node of nodes) {
    if (typeof node === "number") out.add(node);
    else treeIds(node.nodes, out);
  }
  return out;
}

function shortRegion(place: Place): string {
  const parts = place.region.split(" · ");
  const rest = parts.slice(1).filter((p) => p !== place.name);
  return rest.length > 0 ? rest.join(" · ") : parts[0];
}

function CatalogBranch({
  nodes,
  placeById,
  selectedId,
  onSelect,
}: {
  nodes: TreeNode[];
  placeById: Map<number, Place>;
  selectedId: number | null;
  onSelect: (id: number) => void;
}) {
  return (
    <ul className="border-l border-(--river)/35">
      {nodes.map((node) => {
        if (typeof node !== "number") {
          return (
            <li key={node.river} className="relative py-2 pl-5">
              <span
                aria-hidden
                className="absolute top-[1.05rem] left-0 h-px w-4 bg-(--river)/35"
              />
              <p className="mb-1.5 font-serif text-xs tracking-[0.28em] text-(--river)">
                {node.river}
              </p>
              <CatalogBranch
                nodes={node.nodes}
                placeById={placeById}
                selectedId={selectedId}
                onSelect={onSelect}
              />
            </li>
          );
        }
        const place = placeById.get(node);
        if (!place) return null;
        const active = selectedId === node;
        return (
          <li key={node} className="relative">
            <span
              aria-hidden
              className={`absolute top-1/2 left-0 h-px w-2.5 -translate-y-1/2 ${
                active ? "bg-(--seal)" : "bg-(--river)/50"
              }`}
            />
            <button
              type="button"
              onClick={() => onSelect(node)}
              className="flex min-h-11 w-full cursor-pointer items-center justify-between gap-3 py-1.5 pl-4 text-left transition-colors hover:text-(--seal)"
            >
              <span className="flex min-w-0 items-center gap-2.5">
                <svg
                  viewBox="-10 -10 20 20"
                  className="h-4 w-4 shrink-0 overflow-visible"
                  aria-hidden
                >
                  <PlaceGlyph
                    kind={glyphOf(place.id)}
                    x={0}
                    y={0}
                    active={active}
                    kin={false}
                    scale={0.95}
                  />
                </svg>
                <span
                  className={`truncate font-serif text-[15px] ${
                    active ? "font-semibold text-(--seal)" : "text-(--ink)"
                  }`}
                >
                  {place.name}
                </span>
              </span>
              <span className="shrink-0 text-[11px] tracking-[0.18em] text-(--ink-muted)">
                {shortRegion(place)}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export function MobileCatalogDrawer({
  open,
  onOpenChange,
  places,
  selectedId,
  countText,
  creditText,
  elsewhereLabel,
  onSelectPlace,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  places: Place[];
  selectedId: number | null;
  countText: string;
  creditText: string;
  elsewhereLabel: string;
  onSelectPlace: (id: number) => void;
}) {
  const [query, setQuery] = useState("");
  const placeById = useMemo(
    () => new Map(places.map((p) => [p.id, p])),
    [places],
  );
  const tree = useMemo(() => {
    const listed = treeIds(TREE.flatMap((s) => s.nodes));
    const rest = places.filter((p) => !listed.has(p.id)).map((p) => p.id);
    return rest.length > 0
      ? [...TREE, { river: elsewhereLabel, nodes: rest }]
      : TREE;
  }, [places, elsewhereLabel]);

  const trimmed = query.trim();
  const filtered = useMemo(() => {
    if (!trimmed) return null;
    return places.filter(
      (p) =>
        p.name.includes(trimmed) ||
        (p.fullName?.includes(trimmed) ?? false) ||
        p.region.includes(trimmed) ||
        p.entries.some((e) => e.title.includes(trimmed)),
    );
  }, [places, trimmed]);

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent
        title="河图志 · 水系目录"
        description="从入海口逆流而上，点一处飞赴地图"
        className={`h-[78dvh] bg-(--paper)! text-(--ink) ${ATLAS_THEME_VARS}`}
      >
        <div className="mb-5 flex items-baseline justify-between gap-4 border-b border-(--ink)/12 pb-3">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="寻地名、省域或歌名…"
            className="w-full bg-transparent font-kaiti text-sm text-(--ink) placeholder:text-(--ink-muted)/70 focus:outline-none"
          />
          {trimmed && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="shrink-0 text-xs tracking-[0.2em] text-(--ink-muted)"
            >
              清空
            </button>
          )}
        </div>

        {filtered ? (
          filtered.length > 0 ? (
            <ul className="divide-y divide-(--ink)/8">
              {filtered.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onOpenChange(false);
                      onSelectPlace(p.id);
                    }}
                    className="flex min-h-12 w-full cursor-pointer items-baseline justify-between gap-3 py-2 text-left"
                  >
                    <span className="font-serif text-base text-(--ink)">
                      {p.fullName ?? p.name}
                    </span>
                    <span className="shrink-0 text-[11px] tracking-[0.18em] text-(--ink-muted)">
                      {p.entries[0] ? `《${p.entries[0].title}》` : p.region}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-12 text-center font-kaiti text-sm text-(--ink-muted)">
              水系间未见此地。
            </p>
          )
        ) : (
          <div className="space-y-8 pb-4">
            {tree.map((section) => (
              <section key={section.river}>
                <h3 className="mb-3 font-calligraphy text-2xl text-(--river)">
                  {section.river}
                </h3>
                <CatalogBranch
                  nodes={section.nodes}
                  placeById={placeById}
                  selectedId={selectedId}
                  onSelect={(id) => {
                    onOpenChange(false);
                    onSelectPlace(id);
                  }}
                />
              </section>
            ))}
            <p className="border-t border-(--ink)/10 pt-5 text-xs tracking-[0.24em] text-(--ink-muted)">
              {countText} · {creditText}
            </p>
          </div>
        )}
      </DrawerContent>
    </Drawer>
  );
}

// ─── 窄屏选点后的下半屏词句抽屉（透明遮罩，上半屏山水依然清晰可观） ─────────────

export function MobilePlaceDrawer({
  place,
  siblings,
  onClose,
  onGo,
}: {
  place: Place | null;
  siblings: Place[];
  onClose: () => void;
  onGo: (id: number) => void;
}) {
  return (
    <Drawer
      open={place !== null}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DrawerContent
        transparentBackdrop
        description={place ? `${place.name}的歌词与出处` : "地点详情"}
        className={`max-h-[54dvh] border-t border-(--ink)/15 bg-(--paper)! text-(--ink) ${ATLAS_THEME_VARS}`}
      >
        {place && (
          <div className="pt-3">
            <div className="mb-2 flex items-baseline justify-between gap-4">
              <p className="text-xs tracking-[0.26em] text-(--ink-muted)">
                {place.region}
              </p>
              <button
                type="button"
                onClick={onClose}
                className="cursor-pointer text-xs tracking-[0.24em] text-(--ink-muted) hover:text-(--seal)"
              >
                收起
              </button>
            </div>
            <h2 className="mb-5 font-serif text-2xl font-semibold tracking-tight text-(--ink)">
              {place.fullName ?? place.name}
            </h2>
            <PlaceReadingBody
              place={place}
              siblings={siblings}
              onGo={onGo}
              compact
            />
          </div>
        )}
      </DrawerContent>
    </Drawer>
  );
}
