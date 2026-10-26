"use client";

/**
 * 意象原型共用的词云部件，照搬旧意象页（ImageryClient / ImageryDetailPanel）的写法：
 * 书法字按门类着色、呼吸浮动、逐行展开，选中时发光、其余淡出；悬停出胶囊提示。
 */

import { useIsDesktop } from "@/hooks/ui/useIsDesktop";
import {
  GRAY_PALETTE,
  PALETTE_FULL,
  type PaletteEntry,
} from "@/lib/imagery/palette";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
import { AnimatePresence, motion } from "framer-motion";
import React, {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

export function paletteAt(index: number): PaletteEntry {
  return index >= 0 ? PALETTE_FULL[index % PALETTE_FULL.length] : GRAY_PALETTE;
}

/** 与旧词云同一条曲线：按对数铺开字号 */
export function calcFontSize(
  count: number,
  maxCount: number,
  base = 0.85,
  range = 1.5,
) {
  if (maxCount <= 1) return base + range / 2;
  return base + (Math.log(count + 1) / Math.log(maxCount + 1)) * range;
}

export function seededShuffle<T>(list: T[], seed: number): T[] {
  const result = [...list];
  let s = seed || 1;
  for (let i = result.length - 1; i > 0; i -= 1) {
    s = (s * 1664525 + 1013904223) % 4294967296;
    const j = s % (i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// ─── 单个词 ──────────────────────────────────────────────────────────────────

export type CloudItem = {
  id: number;
  name: string;
  count: number;
  palette: number;
};

export const CloudWord = memo(function CloudWord({
  item,
  fontSize,
  index,
  rowIndex,
  selectedId,
  dimTo = 0.06,
  label,
}: {
  item: CloudItem;
  fontSize: number;
  /** 在整个列表里的位置，错开呼吸的节奏 */
  index: number;
  /** 在一行里的位置，错开展开的时间 */
  rowIndex: number;
  selectedId: number | null;
  /** 有选中项时其余词的透明度 */
  dimTo?: number;
  label: string;
}) {
  const palette = paletteAt(item.palette);
  const isSelected = selectedId === item.id;
  const hasSelection = selectedId !== null;
  const glow = isSelected
    ? `0 0 10px ${palette.accent}cc, 0 0 26px ${palette.accent}66, 0 0 55px ${palette.accent}22`
    : undefined;
  return (
    <div
      className="relative"
      style={{
        opacity: hasSelection ? (isSelected ? 1 : dimTo) : 1,
        transform: isSelected ? "scale(1.1)" : "scale(1)",
        zIndex: isSelected ? 30 : undefined,
        transition:
          "opacity 0.8s ease, transform 0.8s cubic-bezier(0.16,1,0.3,1)",
      }}
    >
      <div
        className="relative leading-none word-unfurl-anim"
        style={
          { "--unfurl-delay": `${rowIndex * 80}ms` } as React.CSSProperties
        }
      >
        <button
          type="button"
          data-item-id={item.id}
          aria-label={label}
          className={`font-calligraphy leading-none word-breathe-anim ${isSelected ? "word-breathe-force-run opacity-100" : "opacity-70 hover:opacity-100"} ${palette.text}`}
          style={
            {
              fontSize: `${fontSize}rem`,
              "--word-breathe-duration": `${5.5 + (index % 7) * 0.6}s`,
              "--word-breathe-delay": `${(index % 13) * 0.35}s`,
              textShadow: glow,
              transition: "text-shadow 0.4s ease, opacity 0.4s ease",
            } as React.CSSProperties
          }
        >
          {item.name}
        </button>
      </div>
    </div>
  );
});

// ─── 悬停提示 ────────────────────────────────────────────────────────────────

type Hover = { id: number; text: string; accent: string; x: number; y: number };

export function useCloudHover(
  lookup: (id: number) => { text: string; accent: string } | null,
  disabled: boolean,
) {
  const [hover, setHover] = useState<Hover | null>(null);
  const current = useRef<number | null>(null);
  const onMouseOver = useCallback(
    (e: React.MouseEvent) => {
      if (disabled) return;
      const btn = (e.target as HTMLElement).closest<HTMLElement>(
        "button[data-item-id]",
      );
      if (!btn) return;
      const id = Number(btn.dataset.itemId);
      if (current.current === id) return;
      current.current = id;
      const info = lookup(id);
      if (!info) return;
      const rect = btn.getBoundingClientRect();
      setHover({ id, ...info, x: rect.left + rect.width / 2, y: rect.top });
    },
    [lookup, disabled],
  );
  const onMouseLeave = useCallback(() => {
    current.current = null;
    setHover(null);
  }, []);
  return { hover, onMouseOver, onMouseLeave, clear: onMouseLeave };
}

export function CloudTooltip({ hover }: { hover: Hover | null }) {
  const isDesktop = useIsDesktop();
  if (!hover || !isDesktop) return null;
  return (
    <div
      key={hover.id}
      className="fixed z-60 pointer-events-none"
      style={{
        left: hover.x,
        top: hover.y - 8,
        transform: "translate(-50%, -100%)",
      }}
    >
      <div
        className="px-2.5 py-1 rounded-full text-xs tracking-wider font-serif font-light whitespace-nowrap shadow-sm backdrop-blur-sm tooltip-appear"
        style={{
          backgroundColor: `${hover.accent}22`,
          color: hover.accent,
          border: `1px solid ${hover.accent}44`,
        }}
      >
        {hover.text}
      </div>
    </div>
  );
}

// ─── 虚拟滚动的大词云（索引页） ──────────────────────────────────────────────

const GAP_X_PX = 40;
const GAP_Y_PX = 24;

type Sized = { item: CloudItem; fontSize: number };

function groupIntoRows(words: Sized[], width: number): Sized[][] {
  if (width <= 0 || words.length === 0) return [words];
  const rows: Sized[][] = [];
  let row: Sized[] = [];
  let rowW = 0;
  for (const w of words) {
    const px = Math.ceil(w.item.name.length * w.fontSize * 16);
    const needed = row.length === 0 ? px : px + GAP_X_PX;
    if (row.length > 0 && rowW + needed > width) {
      rows.push(row);
      row = [w];
      rowW = px;
    } else {
      row.push(w);
      rowW += needed;
    }
  }
  if (row.length > 0) rows.push(row);
  return rows;
}

export function VirtualCloud({
  items,
  selectedId,
  onSelect,
  tooltip,
  reveal,
  onReveal,
}: {
  items: CloudItem[];
  selectedId: number | null;
  /** side：面板该从哪边出来，避开被点的词 */
  onSelect: (id: number, side: "left" | "right") => void;
  tooltip: (item: CloudItem) => string;
  /** 把这个词滚到视口中间；key 变了才再滚一次 */
  reveal?: { id: number; key: number } | null;
  /** 滚过去之后告诉外面它在左半还是右半，面板好从另一边出来 */
  onReveal?: (side: "left" | "right") => void;
}) {
  const cloudRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(960);
  const [widthMeasured, setWidthMeasured] = useState(false);
  const [scrollMargin, setScrollMargin] = useState(0);

  const maxCount = useMemo(
    () => Math.max(1, ...items.map((i) => i.count)),
    [items],
  );
  const sized = useMemo(
    () =>
      items.map((item) => ({
        item,
        fontSize: calcFontSize(item.count, maxCount),
      })),
    [items, maxCount],
  );
  const indexOf = useMemo(
    () => new Map(items.map((item, i) => [item.id, i])),
    [items],
  );
  const byId = useMemo(
    () => new Map(items.map((item) => [item.id, item])),
    [items],
  );
  const rows = useMemo(() => groupIntoRows(sized, width), [sized, width]);

  useEffect(() => {
    const el = cloudRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) =>
      setWidth(entry.contentRect.width),
    );
    ro.observe(el);
    setWidth(el.getBoundingClientRect().width);
    setWidthMeasured(true);
    return () => ro.disconnect();
  }, []);

  useLayoutEffect(() => {
    const update = () => {
      if (cloudRef.current) {
        setScrollMargin(
          cloudRef.current.getBoundingClientRect().top + window.scrollY,
        );
      }
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [items.length]);

  const virtualizer = useWindowVirtualizer({
    count: rows.length,
    estimateSize: useCallback(
      (i: number) =>
        Math.ceil(Math.max(...(rows[i] ?? []).map((w) => w.fontSize), 1) * 16) +
        GAP_Y_PX,
      [rows],
    ),
    overscan: 8,
    scrollMargin,
  });

  // 要等宽度量好、分好行，滚动位置才准
  const revealed = useRef<number | null>(null);
  useEffect(() => {
    if (!reveal || !widthMeasured || scrollMargin === 0) return;
    if (revealed.current === reveal.key) return;
    revealed.current = reveal.key;
    const rowIndex = rows.findIndex((row) =>
      row.some((w) => w.item.id === reveal.id),
    );
    if (rowIndex < 0) return;
    const top = virtualizer.getOffsetForIndex(rowIndex, "center")?.[0];
    if (top !== undefined) {
      window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
    }
    // 词还没渲染出来（虚拟滚动），按分行时的估算宽度算它在行里的位置：行居中排
    const row = rows[rowIndex];
    const widthOf = (w: Sized) =>
      Math.ceil(w.item.name.length * w.fontSize * 16);
    const rowWidth =
      row.reduce((sum, w) => sum + widthOf(w), 0) + GAP_X_PX * (row.length - 1);
    let x = (width - rowWidth) / 2;
    for (const w of row) {
      if (w.item.id === reveal.id) {
        x += widthOf(w) / 2;
        break;
      }
      x += widthOf(w) + GAP_X_PX;
    }
    const left = cloudRef.current?.getBoundingClientRect().left ?? 0;
    onReveal?.(left + x > ((left + width) * 3) / 4 ? "left" : "right");
  }, [reveal, widthMeasured, scrollMargin, rows, virtualizer, width, onReveal]);

  const lookup = useCallback(
    (id: number) => {
      const item = byId.get(id);
      return item
        ? { text: tooltip(item), accent: paletteAt(item.palette).accent }
        : null;
    },
    [byId, tooltip],
  );
  const { hover, onMouseOver, onMouseLeave, clear } = useCloudHover(
    lookup,
    selectedId !== null,
  );

  return (
    <>
      <div
        ref={cloudRef}
        onClick={(e) => {
          const btn = (e.target as HTMLElement).closest<HTMLElement>(
            "button[data-item-id]",
          );
          if (!btn) return;
          if ("vibrate" in navigator) navigator.vibrate(8);
          clear();
          const rect = btn.getBoundingClientRect();
          const cloudRight =
            cloudRef.current?.getBoundingClientRect().right ??
            window.innerWidth;
          onSelect(
            Number(btn.dataset.itemId),
            rect.left + rect.width / 2 > (cloudRight * 3) / 4
              ? "left"
              : "right",
          );
        }}
        onMouseOver={onMouseOver}
        onMouseLeave={onMouseLeave}
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          position: "relative",
        }}
      >
        {virtualizer.getVirtualItems().map((v) => {
          const row = rows[v.index];
          if (!row) return null;
          return (
            <div
              key={v.key}
              data-index={v.index}
              ref={virtualizer.measureElement}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                transform: `translateY(${v.start - virtualizer.options.scrollMargin}px)`,
              }}
              className="flex justify-center items-center gap-x-10 pb-6"
            >
              {row.map((w, i) => (
                <CloudWord
                  key={w.item.id}
                  item={w.item}
                  fontSize={w.fontSize}
                  index={indexOf.get(w.item.id) ?? 0}
                  rowIndex={i}
                  selectedId={selectedId}
                  label={`${w.item.name}，${tooltip(w.item)}`}
                />
              ))}
            </div>
          );
        })}
      </div>
      <CloudTooltip hover={hover} />
    </>
  );
}

// ─── 筛选按钮与分节标签 ──────────────────────────────────────────────────────

/** 一级筛选：选中时字距放开、底下一道门类色的线 */
export function CategoryButton({
  isActive,
  onClick,
  label,
  accentColor,
}: {
  isActive: boolean;
  onClick: () => void;
  label: React.ReactNode;
  accentColor: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative py-1.5 text-[14px] transition-all duration-700 font-serif whitespace-nowrap ${
        isActive
          ? "text-slate-900 dark:text-white tracking-[0.25em]"
          : "text-slate-400 dark:text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 tracking-[0.2em] hover:tracking-[0.25em]"
      }`}
    >
      {label}
      <span
        className={`absolute bottom-0 left-0 h-[1.5px] w-[calc(100%-0.25em)] transition-all duration-1000 ease-out origin-left ${
          isActive ? "scale-x-100 opacity-80" : "scale-x-0 opacity-0"
        }`}
        style={{
          backgroundColor: accentColor,
          boxShadow: isActive ? `0 1px 10px ${accentColor}22` : "none",
        }}
      />
    </button>
  );
}

/** 二级筛选：选中时两侧滑出「」 */
export function BracketButton({
  isActive,
  onClick,
  label,
  accentColor,
  size = "text-[12px]",
}: {
  isActive: boolean;
  onClick: () => void;
  label: React.ReactNode;
  accentColor: string;
  size?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative ${size} transition-all duration-700 font-serif tracking-widest whitespace-nowrap py-1 ${
        isActive
          ? "text-slate-700 dark:text-slate-300"
          : "text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-400 hover:tracking-[0.15em]"
      }`}
    >
      <span
        className={`inline-block transition-all duration-700 mr-1.5 ${isActive ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-2"}`}
        style={{ color: accentColor }}
      >
        「
      </span>
      {label}
      <span
        className={`inline-block transition-all duration-700 ml-1.5 ${isActive ? "opacity-100 translate-x-0" : "opacity-0 translate-x-2"}`}
        style={{ color: accentColor }}
      >
        」
      </span>
    </button>
  );
}

/** 居中的分节小字，两侧细线；文字换了会模糊淡入 */
export function SectionLabel({
  label,
  accent,
  compact = false,
}: {
  label: string;
  accent: string;
  /** 面板里用小一号 */
  compact?: boolean;
}) {
  return (
    <div className={`flex items-center gap-3 ${compact ? "my-5" : "my-8"}`}>
      <div className="flex-1 h-px bg-slate-200/70 dark:bg-slate-800" />
      <div className="relative h-4 flex items-center justify-center min-w-[30%]">
        <AnimatePresence mode="wait">
          <motion.span
            key={label}
            initial={{ opacity: 0, y: 6, filter: "blur(4px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -6, filter: "blur(4px)" }}
            transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
            className={`absolute ${compact ? "text-[10px]" : "text-[11px]"} tracking-[0.3em] pl-[0.3em] font-medium whitespace-nowrap`}
            style={{ color: accent }}
          >
            {label}
          </motion.span>
        </AnimatePresence>
      </div>
      <div className="flex-1 h-px bg-slate-200/70 dark:bg-slate-800" />
    </div>
  );
}

// ─── 卷首：背景字幕与逐字标题 ────────────────────────────────────────────────

const MARQUEE_ROWS = [
  {
    d: "42s",
    m: "10s",
    dir: "imagery-marquee-ltr",
    size: "text-2xl md:text-4xl",
  },
  {
    d: "60s",
    m: "15s",
    dir: "imagery-marquee-rtl",
    size: "text-xl md:text-3xl",
  },
  {
    d: "78s",
    m: "20s",
    dir: "imagery-marquee-ltr",
    size: "text-lg md:text-2xl",
  },
] as const;

export function HeroMarquee({
  rows,
  running,
  tint,
}: {
  rows: string[][];
  running: boolean;
  /** 字幕颜色；不给时随明暗主题取黑白 */
  tint?: string;
}) {
  const isDesktop = useIsDesktop();
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-x-0 top-1/2 z-0 flex -translate-y-1/2 select-none flex-col justify-center gap-5 overflow-hidden opacity-[0.045] dark:opacity-[0.055]"
      style={tint ? { opacity: 0.09 } : undefined}
    >
      {MARQUEE_ROWS.map(({ d, m, dir, size }, ri) => {
        const words = rows[ri % rows.length] ?? [];
        return (
          <div
            key={ri}
            className="flex whitespace-nowrap font-calligraphy will-change-transform"
            style={{
              animationName: dir,
              animationDuration: isDesktop ? d : m,
              animationTimingFunction: "linear",
              animationIterationCount: "infinite",
              animationPlayState: running ? "running" : "paused",
            }}
          >
            {[...words, ...words].map((w, i) => (
              <span
                key={i}
                className={`${size} mx-5 ${tint ? "" : "text-slate-900 dark:text-white"}`}
                style={tint ? { color: tint } : undefined}
              >
                {w}
              </span>
            ))}
          </div>
        );
      })}
    </div>
  );
}

export function HeroTitle({
  text,
  mounted,
  className,
  style,
}: {
  text: string;
  mounted: boolean;
  className: string;
  style?: React.CSSProperties;
}) {
  return (
    <h1 className={className} style={style}>
      {text.split("").map((char, i) => (
        <span
          key={i}
          className={`hero-title-char inline-block ${mounted ? "" : "opacity-0"}`}
          style={{ animationDelay: `${i * 300}ms` }}
        >
          {char}
        </span>
      ))}
    </h1>
  );
}
