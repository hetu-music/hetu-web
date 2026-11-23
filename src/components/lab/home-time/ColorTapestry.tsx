"use client";

import type { Song } from "@/lib/types";
import { cn } from "@/lib/utils/utils";
import { getCoverUrl } from "@/lib/utils/utils-song";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Image from "next/image";
import React, {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { creditSummary, stripeColor } from "./timeline";

interface ColorTapestryProps {
  /** 已按由近及远排好序的全部在册歌曲 */
  songs: Song[];
  /** 当前筛选/搜索命中的歌曲 ID 集合；未筛选时为 null */
  matched: ReadonlySet<number> | null;
  /** 点选抽起的碟时打开该曲详情 */
  onOpenSong: (id: number) => void;
  /** 抽起碟片时，把封面主色轻染到页面顶部光晕 */
  onSpotlightColor?: (color: string | null) => void;
}

/** 首屏（服务端渲染、尚未量过尺寸时）先完整画出的碟数，最宽的屏也够铺满 */
const INITIAL_LIVE = 120;
/**
 * 视口左右各多画出这么宽的碟，快速拖拽时边缘也不露空；
 * 也要够提前触发封面的懒加载（浏览器原生阈值约 1250px 起），不然封面会比原来晚出现
 */
const BUFFER_PX = 1400;
/** 抽起的碟放大多少（与 Disc 的姿态一致） */
const ACTIVE_SCALE = 1.06;
/** 抽起的碟与后面让开的碟之间留的缝 */
const ACTIVE_GAP = 8;
/** 鼠标滚动/拖拽停下多久后，按光标位置重新抽碟 */
const SCROLL_IDLE_MS = 140;
/** 按下后移动超过这么多才算拖拽，否则算点选 */
const DRAG_SLOP = 4;
/** 松手后的惯性：每 16ms 速度衰减到原来的多少 */
const FRICTION = 0.94;
/** 松手前停顿超过这么久，就不带惯性 */
const FLING_WINDOW_MS = 80;

const EASE = "cubic-bezier(0.23, 1, 0.32, 1)";

// ── 触屏（没有悬停）：滑动时经过取碟位的碟自动抽起 ──
const HOVER_NONE = "(hover: none)";
function subscribeHoverNone(onChange: () => void) {
  const mq = window.matchMedia(HOVER_NONE);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}
const getHoverNone = () => window.matchMedia(HOVER_NONE).matches;
const getHoverNoneServer = () => false;

/**
 * 架上的几何，全部是碟排（strip）里的横坐标。
 * shift：抽起一张碟时，它后面的碟整体右移多少，让抽起的封面完整露出来。
 */
interface Geometry {
  offsets: number[];
  slotW: number;
  coverW: number;
  shift: number;
}
const EMPTY_GEOMETRY: Geometry = { offsets: [], slotW: 0, coverW: 0, shift: 0 };

/** 最后一个左缘不超过 x 的插槽；都在 x 右边时返回 -1 */
function slotAt(offsets: number[], x: number): number {
  let lo = 0;
  let hi = offsets.length - 1;
  if (hi < 0 || x < offsets[0]) return -1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (offsets[mid] <= x) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

/**
 * 光标指着哪张碟。按画出来的样子算：抽起的那张占一整张封面宽，后面的碟右移了 shift。
 * 年份隔片的空隙算前一张（它的封面本就斜着伸过去）。
 * 因为抽起的碟占得宽，往回走要多走一段才会换，边界上不会来回闪。
 */
function hitTest(g: Geometry, active: number | null, x: number): number | null {
  const { offsets, slotW, coverW, shift } = g;
  const n = offsets.length;
  if (n === 0 || x < offsets[0]) return null;
  if (active !== null && active < n) {
    const left = offsets[active];
    const right = left + slotW + shift;
    if (x >= left && x < right) return active;
    if (x >= right) x -= shift;
  }
  const i = slotAt(offsets, x);
  if (i === n - 1 && x > offsets[i] + coverW) return null;
  return i < 0 ? null : i;
}

/** 触屏：滚到取碟位（架子左缘）上的那张 */
function indexAtScroll(g: Geometry, scrollLeft: number): number | null {
  if (g.offsets.length === 0) return null;
  return Math.max(0, slotAt(g.offsets, scrollLeft + g.slotW / 2));
}

type Source = "pointer" | "keyboard" | "scroll";

/**
 * 「实体唱片架」：
 * 一排立在架上的实体唱片封套（按由近及远排列，年份之间插有极简隔片）。
 * - 常态：每张碟斜立叠排，露出真实封面的一截斜切面、封脊高光与投向后碟的柔和阴影；
 * - 鼠标：指着哪一张，那张碟便向上抽出并转正面向你，后面的碟让开位置，左右邻碟微微起伏让角；
 *   拖拽跟手，松手带惯性；滚动时不抽碟，停下再按光标位置抽；
 * - 触屏：架子左缘是取碟位，滑过的碟依次抽起，停下时吸附到一张；点抽起的进详情，点别的把它滑到取碟位；
 * - 键盘：左右键换碟，回车进详情；
 * - 筛选：架上只留命中的那几张碟。
 *
 * 命中不靠每张碟的 mouseenter（窄插槽和斜着伸出去的封面对不上），而是按光标横坐标在同一套几何里算。
 * 性能：每张碟是独立的 memo 组件，换碟时只有姿态改变的几张重渲；
 * 只有视口附近的碟画出封套，其余只留同尺寸的空插槽。
 */
function ColorTapestry({
  songs,
  matched,
  onOpenSong,
  onSpotlightColor,
}: ColorTapestryProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  const isTouch = useSyncExternalStore(
    subscribeHoverNone,
    getHoverNone,
    getHoverNoneServer,
  );

  // 有筛选时只留命中的碟在架上，真正像从大架上挑出一小叠来翻
  const visibleSongs = useMemo(
    () => (matched ? songs.filter((s) => matched.has(s.id)) : songs),
    [songs, matched],
  );

  // 每一年第一张碟前插一块年份隔片
  const yearStartMap = useMemo(() => {
    const map = new Map<number, number | null>();
    let prev: number | null | undefined = undefined;
    visibleSongs.forEach((s, i) => {
      const y = s.year ?? null;
      if (y !== prev) {
        map.set(i, y);
        prev = y;
      }
    });
    return map;
  }, [visibleSongs]);

  const [active, setActive] = useState<number | null>(null);
  const [live, setLive] = useState<readonly [number, number]>([
    0,
    INITIAL_LIVE - 1,
  ]);
  const [shift, setShift] = useState(0);

  // 交互过程中的可变状态：事件处理里读写，不参与渲染
  const geoRef = useRef<Geometry>(EMPTY_GEOMETRY);
  const activeRef = useRef<number | null>(null);
  const isTouchRef = useRef(isTouch);
  const ix = useRef({
    source: null as Source | null,
    pointerInside: false,
    lastClientX: 0,
    scrolling: false,
    idleTimer: 0,
    down: false,
    dragging: false,
    startX: 0,
    startScroll: 0,
    lastX: 0,
    lastT: 0,
    velocity: 0,
    inertia: 0,
    suppressClick: false,
  });

  const activate = useCallback(
    (idx: number | null, source: Source, force = false) => {
      if (!force && activeRef.current === idx) return;
      activeRef.current = idx;
      ix.current.source = idx === null ? null : source;
      setActive(idx);
      onSpotlightColor?.(
        idx !== null && visibleSongs[idx]
          ? stripeColor(visibleSongs[idx])
          : null,
      );
    },
    [visibleSongs, onSpotlightColor],
  );

  const stripX = useCallback(
    (clientX: number) =>
      clientX - (stripRef.current?.getBoundingClientRect().left ?? 0),
    [],
  );

  // ── 几何与「只画视口附近的碟」 ──
  const measure = useCallback(() => {
    const strip = stripRef.current;
    if (!strip) return;
    const slots = strip.querySelectorAll<HTMLElement>("[data-disc-idx]");
    const first = slots[0];
    const slotW = first?.offsetWidth ?? 0;
    // 封面是正方形，边长等于插槽高
    const coverW = first?.offsetHeight ?? 0;
    const nextShift = first
      ? Math.round(coverW * ACTIVE_SCALE) - slotW + ACTIVE_GAP
      : 0;
    geoRef.current = {
      offsets: Array.from(slots, (slot) => slot.offsetLeft),
      slotW,
      coverW,
      shift: nextShift,
    };
    setShift(nextShift);
  }, []);

  const updateLive = useCallback(() => {
    const el = scrollerRef.current;
    const { offsets } = geoRef.current;
    if (!el || offsets.length === 0) return;
    const left = el.scrollLeft - BUFFER_PX;
    const right = el.scrollLeft + el.clientWidth + BUFFER_PX;
    let lo = 0;
    while (lo < offsets.length - 1 && offsets[lo] < left) lo++;
    let hi = offsets.length - 1;
    while (hi > lo && offsets[hi] > right) hi--;
    setLive((prev) => (prev[0] === lo && prev[1] === hi ? prev : [lo, hi]));
  }, []);

  // 架上的碟换了（筛选）或换了输入方式：绘制前同步量一次，避免露出一帧空架；
  // 原来的下标已不指同一首，焦点重新定
  useLayoutEffect(() => {
    isTouchRef.current = isTouch;
    measure();
    updateLive();
    const el = scrollerRef.current;
    activate(
      isTouch && el ? indexAtScroll(geoRef.current, el.scrollLeft) : null,
      "scroll",
      true,
    );
  }, [visibleSongs, isTouch, measure, updateLive, activate]);

  const stopInertia = useCallback(() => {
    cancelAnimationFrame(ix.current.inertia);
    ix.current.inertia = 0;
  }, []);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const s = ix.current;
    let raf = 0;

    const onFrame = () => {
      raf = 0;
      updateLive();
      if (isTouchRef.current) {
        activate(indexAtScroll(geoRef.current, el.scrollLeft), "scroll");
        return;
      }
      // 鼠标：滚动中放下焦点（键盘选中的除外），停下后按光标位置重新抽
      if (s.source !== "keyboard") activate(null, "pointer");
      s.scrolling = true;
      window.clearTimeout(s.idleTimer);
      s.idleTimer = window.setTimeout(() => {
        s.scrolling = false;
        if (s.pointerInside && !s.down && s.source !== "keyboard") {
          activate(
            hitTest(geoRef.current, activeRef.current, stripX(s.lastClientX)),
            "pointer",
          );
        }
      }, SCROLL_IDLE_MS);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(onFrame);
    };

    // 跨过 sm 断点时插槽尺寸会变，重新量
    const ro = new ResizeObserver(() => {
      measure();
      updateLive();
    });
    el.addEventListener("scroll", onScroll, { passive: true });
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
      window.clearTimeout(s.idleTimer);
      stopInertia();
      ro.disconnect();
    };
  }, [measure, updateLive, activate, stripX, stopInertia]);

  // ── 鼠标：指向、拖拽、惯性 ──
  const startInertia = (v0: number) => {
    const el = scrollerRef.current;
    if (!el || Math.abs(v0) < 0.05) return;
    let v = v0;
    let last = performance.now();
    const step = (now: number) => {
      const dt = Math.min(now - last, 32);
      last = now;
      const before = el.scrollLeft;
      el.scrollLeft += v * dt;
      v *= Math.pow(FRICTION, dt / 16);
      // 到头了或慢下来了就停
      if (Math.abs(v) > 0.02 && el.scrollLeft !== before) {
        ix.current.inertia = requestAnimationFrame(step);
      } else {
        ix.current.inertia = 0;
      }
    };
    ix.current.inertia = requestAnimationFrame(step);
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = scrollerRef.current;
    if (!el || e.pointerType !== "mouse" || e.button !== 0) return;
    stopInertia();
    const s = ix.current;
    s.down = true;
    s.dragging = false;
    s.startX = s.lastX = e.clientX;
    s.startScroll = el.scrollLeft;
    s.lastT = e.timeStamp;
    s.velocity = 0;
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== "mouse") return;
    const el = scrollerRef.current;
    const s = ix.current;
    s.lastClientX = e.clientX;
    if (s.down && el) {
      const dx = e.clientX - s.startX;
      if (!s.dragging && Math.abs(dx) > DRAG_SLOP) {
        s.dragging = true;
        el.setPointerCapture(e.pointerId);
        activate(null, "pointer");
      }
      if (s.dragging) {
        // 跟手 1:1
        el.scrollLeft = s.startScroll - dx;
        const dt = e.timeStamp - s.lastT;
        if (dt > 0) {
          s.velocity = 0.8 * ((s.lastX - e.clientX) / dt) + 0.2 * s.velocity;
        }
        s.lastX = e.clientX;
        s.lastT = e.timeStamp;
      }
      return;
    }
    if (s.scrolling) return;
    activate(
      hitTest(geoRef.current, activeRef.current, stripX(e.clientX)),
      "pointer",
    );
  };

  const endDrag = (e: React.PointerEvent<HTMLDivElement>, fling: boolean) => {
    const s = ix.current;
    if (!s.down) return;
    s.down = false;
    if (!s.dragging) return;
    s.dragging = false;
    scrollerRef.current?.releasePointerCapture(e.pointerId);
    // 拖拽结束时紧跟着的那次 click 不算点选
    s.suppressClick = true;
    window.setTimeout(() => {
      s.suppressClick = false;
    }, 0);
    if (fling && e.timeStamp - s.lastT < FLING_WINDOW_MS) {
      startInertia(s.velocity);
    }
  };

  const handlePointerLeave = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== "mouse") return;
    ix.current.pointerInside = false;
    if (!ix.current.dragging && ix.current.source === "pointer") {
      activate(null, "pointer");
    }
  };

  // ── 点选：鼠标点哪张开哪张；触屏点抽起的进详情，点别的把它滑到取碟位 ──
  const scrollToIndex = (idx: number) => {
    scrollerRef.current?.scrollTo({
      left: geoRef.current.offsets[idx] ?? 0,
      behavior: "smooth",
    });
  };

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (ix.current.suppressClick) return;
    const idx = hitTest(geoRef.current, activeRef.current, stripX(e.clientX));
    if (idx === null || !visibleSongs[idx]) return;
    if (isTouchRef.current && idx !== activeRef.current) {
      scrollToIndex(idx);
      return;
    }
    onOpenSong(visibleSongs[idx].id);
  };

  // ── 键盘 ──
  const revealIndex = (idx: number) => {
    const el = scrollerRef.current;
    const g = geoRef.current;
    if (!el || g.offsets[idx] === undefined) return;
    const left = g.offsets[idx];
    const right = left + Math.round(g.coverW * ACTIVE_SCALE);
    // 右侧留出边缘渐隐的宽度
    const viewRight = el.scrollLeft + el.clientWidth - 64;
    if (left < el.scrollLeft) {
      el.scrollTo({ left, behavior: "smooth" });
    } else if (right > viewRight) {
      el.scrollTo({
        left: el.scrollLeft + (right - viewRight),
        behavior: "smooth",
      });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const n = visibleSongs.length;
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      e.preventDefault();
      const dir = e.key === "ArrowRight" ? 1 : -1;
      const cur = activeRef.current ?? (dir > 0 ? -1 : n);
      const next = Math.min(n - 1, Math.max(0, cur + dir));
      if (isTouchRef.current) {
        scrollToIndex(next);
        return;
      }
      activate(next, "keyboard");
      revealIndex(next);
    } else if (e.key === "Enter" && activeRef.current !== null) {
      const song = visibleSongs[activeRef.current];
      if (song) onOpenSong(song.id);
    }
  };

  const scrollRack = useCallback(
    (dir: -1 | 1) => {
      stopInertia();
      scrollerRef.current?.scrollBy({ left: dir * 480, behavior: "smooth" });
    },
    [stopInertia],
  );

  if (visibleSongs.length === 0) return null;

  const safeActive =
    active !== null && active < visibleSongs.length ? active : null;
  const activeSong = safeActive !== null ? visibleSongs[safeActive] : null;

  return (
    <section aria-label="唱片架" className="relative select-none">
      {/* 顶行：常态安静，抽起碟片时浮现曲名、日期与词曲；右侧可左右推架（触屏直接滑） */}
      <div className="mb-1 flex min-h-11 items-center justify-between gap-4">
        {activeSong ? (
          <button
            type="button"
            onClick={() => onOpenSong(activeSong.id)}
            className="group min-w-0 text-left"
          >
            <div className="flex items-baseline gap-2.5">
              <span className="truncate font-serif text-[15px] text-slate-900 transition-colors group-hover:text-(--tone) sm:text-base dark:text-slate-100">
                《{activeSong.title}》
              </span>
              <span className="shrink-0 font-mono text-[11px] tabular-nums text-(--tone)">
                {activeSong.date?.replaceAll("-", ".") ||
                  activeSong.year ||
                  "未详"}
              </span>
            </div>
            <p className="truncate font-kaiti text-xs text-slate-500 dark:text-slate-400">
              {creditSummary(activeSong) || "点此入卷"}
            </p>
          </button>
        ) : (
          <span className="text-[11px] tracking-[0.3em] text-(--tone)">
            架上唱片
          </span>
        )}

        <div className="flex shrink-0 items-center gap-1 [@media(hover:none)]:hidden">
          <button
            type="button"
            onClick={() => scrollRack(-1)}
            aria-label="向左推架"
            className="p-1.5 text-slate-400 transition-colors hover:text-(--tone) dark:text-slate-500"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            type="button"
            onClick={() => scrollRack(1)}
            aria-label="向右推架"
            className="p-1.5 text-slate-400 transition-colors hover:text-(--tone) dark:text-slate-500"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* ── 唱片架横向轨道 ── */}
      <div className="relative -mx-6">
        <div
          ref={scrollerRef}
          tabIndex={0}
          role="listbox"
          aria-label="唱片架：左右键换碟，回车打开"
          aria-activedescendant={
            activeSong ? `disc-${activeSong.id}` : undefined
          }
          onPointerEnter={(e) => {
            if (e.pointerType === "mouse") ix.current.pointerInside = true;
          }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={(e) => endDrag(e, true)}
          onPointerCancel={(e) => endDrag(e, false)}
          onPointerLeave={handlePointerLeave}
          onWheel={stopInertia}
          onClick={handleClick}
          onKeyDown={handleKeyDown}
          className={cn(
            // isolate：碟片的 z-index 不越出架子，不压到吸顶的检目线上
            "no-scrollbar relative isolate flex items-end overflow-x-auto px-6 pt-11 pb-6 outline-none",
            isTouch
              ? "snap-x snap-mandatory scroll-pl-6"
              : safeActive !== null
                ? "cursor-pointer active:cursor-grabbing"
                : "cursor-grab active:cursor-grabbing",
          )}
        >
          {/* 唱片排：每个插槽保持固定横向占位，换碟只动 transform，不重排 */}
          {/* 触屏末尾留出将近一屏的空架，最后几张碟也能滑到取碟位 */}
          <div
            ref={stripRef}
            className={cn(
              "relative flex items-end",
              isTouch ? "pr-[calc(100vw-3rem)]" : "pr-28 sm:pr-32",
            )}
          >
            {visibleSongs.map((song, idx) => (
              <Disc
                key={song.id}
                song={song}
                idx={idx}
                dist={
                  safeActive === null
                    ? 3
                    : Math.min(Math.abs(idx - safeActive), 3)
                }
                shift={safeActive !== null && idx > safeActive ? shift : 0}
                yearLabel={yearStartMap.get(idx)}
                live={idx >= live[0] && idx <= live[1]}
                snap={isTouch}
              />
            ))}
          </div>
        </div>

        {/* 两端渐隐（页面底色），代替整条架子上的 mask：滚动时不必每帧重算遮罩 */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-0 z-10 w-6 bg-linear-to-r from-[#FAFAFA] to-transparent dark:from-[#0B0F19]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 right-0 z-10 w-9 bg-linear-to-l from-[#FAFAFA] to-transparent dark:from-[#0B0F19]"
        />

        {/* 架面承托细线 */}
        <div
          aria-hidden
          className="pointer-events-none mx-6 -mt-3 h-px bg-linear-to-r from-transparent via-slate-300/85 to-transparent dark:via-slate-700/80"
        />
      </div>
    </section>
  );
}

export default memo(ColorTapestry);

/**
 * 一张碟。dist 是到焦点碟的距离，3 代表「3 及更远」（姿态都一样）；
 * shift 是焦点碟后面让出的位移。换碟时只有这两项真正改变的几张碟会重渲。
 * live 为 false 时只留同尺寸的空插槽。
 */
const Disc = memo(function Disc({
  song,
  idx,
  dist,
  shift,
  yearLabel,
  live,
  snap,
}: {
  song: Song;
  idx: number;
  dist: number;
  shift: number;
  yearLabel: number | null | undefined;
  live: boolean;
  snap: boolean;
}) {
  const isAct = dist === 0;
  const bg = stripeColor(song);

  // 抽碟姿态：焦点碟抽出并转正面向你，左右邻碟如书架受触般微微起伏让角
  const rotateY = isAct ? 0 : dist === 1 ? -34 : dist === 2 ? -48 : -58;
  const translateY = isAct ? -24 : dist === 1 ? -9 : dist === 2 ? -4 : 0;
  const scale = isAct ? ACTIVE_SCALE : 1;

  return (
    <div
      id={`disc-${song.id}`}
      role="option"
      aria-selected={isAct}
      aria-label={song.title}
      data-disc-idx={idx}
      className={cn(
        "relative h-25 w-5.5 shrink-0 sm:h-29.5 sm:w-6.5",
        yearLabel !== undefined && idx > 0 && "ml-5 sm:ml-6",
        snap && "snap-start",
      )}
      style={{
        zIndex: isAct ? 50 : dist === 1 ? 30 : dist === 2 ? 20 : 10,
        transform: shift ? `translateX(${shift}px)` : undefined,
        transition: `transform 380ms ${EASE}`,
      }}
    >
      {/* 年份隔片：插在每一年第一张碟前的极简年代标签，像唱片店木/纸隔板 */}
      {yearLabel !== undefined && (
        <span
          aria-hidden
          className="pointer-events-none absolute -top-7 left-0 flex items-center gap-1 font-mono text-[10px] tabular-nums tracking-wider text-slate-400/90 dark:text-slate-500"
        >
          <span className="inline-block h-2.5 w-px bg-slate-300 dark:bg-slate-700" />
          {yearLabel ?? "未详"}
        </span>
      )}

      {/* 唱片封套本体（绕左脊旋转，露出真实封面与立体厚度阴影） */}
      {live && (
        <div
          className="pointer-events-none absolute bottom-0 left-0 h-25 w-25 sm:h-29.5 sm:w-29.5"
          style={{
            transformOrigin: "left center",
            transform: `translateY(${translateY}px) rotateY(${rotateY}deg) scale(${scale})`,
            transition: `transform 380ms ${EASE}`,
          }}
        >
          {/* 抽起时碟后微探一弧黑胶边，强化“唱片”实感 */}
          <span
            aria-hidden
            className={cn(
              "absolute top-[-9%] inset-x-[9%] aspect-square rounded-full transition-all duration-400",
              isAct ? "opacity-90 -translate-y-1" : "opacity-0",
            )}
            style={{
              background:
                "repeating-radial-gradient(circle at center, #181c26 0px, #181c26 2px, #0d1017 3px, #151923 4.5px)",
            }}
          />

          {/* 封面封套主体 */}
          <div
            className={cn(
              "relative h-full w-full overflow-hidden rounded-[3px] ring-1 transition-shadow duration-300",
              isAct
                ? "shadow-[0_24px_42px_-12px_rgba(15,23,42,0.55)] ring-slate-900/15 dark:shadow-[0_26px_48px_-10px_rgba(0,0,0,0.92)] dark:ring-white/25"
                : "shadow-[-6px_6px_14px_-4px_rgba(15,23,42,0.28)] ring-slate-900/10 dark:shadow-[-8px_8px_18px_-4px_rgba(0,0,0,0.75)] dark:ring-white/12",
            )}
            style={{ backgroundColor: bg }}
          >
            <Image
              src={getCoverUrl(song)}
              alt=""
              width={160}
              height={160}
              sizes="118px"
              draggable={false}
              loading={idx < 32 ? "eager" : "lazy"}
              className={cn(
                "h-full w-full object-cover transition-[filter] duration-300",
                isAct
                  ? "brightness-100 saturate-100"
                  : "brightness-95 saturate-[0.88] dark:brightness-90",
              )}
            />

            {/* 封脊左缘极细纸边高光，模拟真实实体封套厚度 */}
            <span
              aria-hidden
              className="absolute inset-y-0 left-0 w-0.5 bg-white/45 dark:bg-white/25"
            />
            {/* 未抽起时封套表面的微弱斜向阴影，拉开前后层叠景深 */}
            <span
              aria-hidden
              className={cn(
                "absolute inset-0 bg-linear-to-r from-transparent via-black/6 to-black/30 transition-opacity duration-300",
                isAct ? "opacity-0" : "opacity-100",
              )}
            />
          </div>
        </div>
      )}
    </div>
  );
});
