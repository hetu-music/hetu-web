"use client";

import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils/utils";
import { getCoverUrl } from "@/lib/utils/utils-song";
import { AnimatePresence, motion } from "framer-motion";
import Image from "next/image";
import {
  Fragment,
  type Ref,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import {
  EASE,
  ENTRANCE_DEFS,
  type FeatureData,
  FeatureEpigraph,
  type FeatureKey,
  HOVER_INTENT_MS,
  type ScreenPanel,
  type YearRailHandle,
  panelLit,
} from "./header-shared";
import { creditSummary, stripeColor } from "./timeline";

/**
 * 方案二 · 素卷琴弦（卷首）：居中素白留白，常态零图片。
 * 只排大题、一句活题字与三枚刻本轻入口，以虚托实，让下方琴弦与首章自然承接。
 */
export function StringHero({
  firstYear,
  lastYear,
  features,
}: {
  firstYear: number;
  lastYear: number;
  features: FeatureData;
}) {
  const [feature, setFeature] = useState<FeatureKey | null>(null);

  return (
    <header className="pt-6 pb-8 text-center md:pt-12 md:pb-12">
      <p className="font-mono text-[11px] tabular-nums tracking-[0.36em] text-ink-meta">
        {firstYear} — {lastYear}
      </p>

      <h1 className="mt-4 pl-[0.28em] font-serif text-5xl font-semibold leading-none tracking-[0.28em] text-ink md:text-6xl">
        二十年
      </h1>

      <FeatureEpigraph
        feature={feature}
        features={features}
        centered
        className="mt-5 text-[15px] md:text-[17px]"
      />

      <nav
        aria-label="特展"
        className="mt-7 flex flex-wrap items-center justify-center gap-x-7 gap-y-2 md:gap-x-9"
      >
        {ENTRANCE_DEFS.map((item, idx) => {
          const active = feature === item.key;
          return (
            <Fragment key={item.key}>
              {idx > 0 && (
                <span
                  aria-hidden
                  className="h-3 w-px bg-slate-200 dark:bg-slate-800"
                />
              )}
              <Link
                href={item.href}
                onPointerEnter={(e) => {
                  if (e.pointerType === "mouse") setFeature(item.key);
                }}
                onPointerLeave={() => setFeature(null)}
                onFocus={() => setFeature(item.key)}
                onBlur={() => setFeature(null)}
                className={cn(
                  "font-calligraphy text-[19px] leading-none tracking-[0.22em] outline-none transition-colors duration-300 md:text-[21px]",
                  active
                    ? "text-(--tone)"
                    : "text-ink-prose hover:text-(--tone) focus-visible:text-(--tone)",
                )}
              >
                {item.name}
              </Link>
            </Fragment>
          );
        })}
      </nav>
    </header>
  );
}

/**
 * 二十年色丝琴弦：卷首与吸顶始终是同一根极净细弦，不切换两套形态。
 * - 常态：21 段 3px 矿物色丝（取自每年代表封面主色），搜索筛选时未命中年份褪淡；
 * - 触弦显画：鼠标轻滑某年时，在弦上方（吸顶时翻转到弦下方）轻浮一枚小画笺，移开即隐。
 */
export function ChronicleString({
  ref,
  panels,
  matched,
  folded,
  onJump,
}: {
  ref: Ref<YearRailHandle>;
  panels: ScreenPanel[];
  matched: ReadonlySet<number> | null;
  folded: boolean;
  onJump: (year: number | null) => void;
}) {
  const [activeKey, setActiveKey] = useState(panels[0]?.key ?? "");
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  useImperativeHandle(ref, () => ({ setActive: setActiveKey }), []);

  const intent = useRef(0);
  useEffect(() => () => window.clearTimeout(intent.current), []);

  const hoveredPanel = hoveredIdx !== null ? panels[hoveredIdx] : null;
  const activeIdx = panels.findIndex((p) => p.key === activeKey);
  const count = panels.length;

  const showTick = (idx: number, year: number | null) => {
    if (hoveredIdx === idx) return true;
    if (folded && activeIdx === idx) return true;
    // 防止悬停或当前年份紧邻固定刻度时文字碰撞
    if (
      (hoveredIdx !== null && Math.abs(idx - hoveredIdx) === 1) ||
      (folded && activeIdx >= 0 && Math.abs(idx - activeIdx) === 1)
    ) {
      return false;
    }
    if (idx === 0 || idx === count - 1) return true;
    if (typeof year === "number" && year % 5 === 0) {
      return idx >= 2 && idx <= count - 3;
    }
    return false;
  };

  const previewLeft =
    hoveredIdx !== null && count > 0
      ? `clamp(8.5rem, ${((hoveredIdx + 0.5) / count) * 100}%, calc(100% - 8.5rem))`
      : "50%";

  return (
    <div
      className="relative pt-2 pb-1.5 select-none"
      onPointerLeave={() => {
        window.clearTimeout(intent.current);
        setHoveredIdx(null);
      }}
    >
      {/* 触弦显画：悬停某一段色丝时轻浮一帧小画笺；吸顶时自动落到弦下以免被顶栏裁切 */}
      <AnimatePresence>
        {hoveredPanel && (
          <motion.div
            key={hoveredPanel.key}
            aria-hidden
            initial={{ opacity: 0, y: folded ? -6 : 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: folded ? -4 : 4 }}
            transition={{ duration: 0.24, ease: EASE }}
            className={cn(
              "pointer-events-none absolute z-50 hidden w-68 -translate-x-1/2 items-center gap-3.5 rounded-md border border-slate-200/80 bg-[#FAFAFA]/98 p-2.5 shadow-[0_18px_42px_-16px_rgba(15,23,42,0.22)] lg:flex dark:border-slate-800 dark:bg-[#0B0F19]/98 dark:shadow-[0_20px_48px_-16px_rgba(0,0,0,0.75)]",
              folded ? "top-full mt-2" : "bottom-full mb-1",
            )}
            style={{ left: previewLeft }}
          >
            <div className="relative h-15 w-15 shrink-0 overflow-hidden rounded-[3px] bg-slate-100 ring-1 ring-slate-900/[0.07] dark:bg-slate-900 dark:ring-white/10">
              {hoveredPanel.song && hoveredPanel.art ? (
                <Image
                  src={getCoverUrl(hoveredPanel.song)}
                  alt=""
                  width={120}
                  height={120}
                  sizes="60px"
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="flex h-full w-full items-center justify-center font-serif text-xs tracking-widest text-ink-meta">
                  {hoveredPanel.year ?? "未详"}
                </span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-mono text-[10px] tabular-nums tracking-[0.2em] text-(--tone)">
                {hoveredPanel.year ?? "年份未详"}
                {hoveredPanel.ids.size > 0 && (
                  <span className="text-ink-meta">
                    {" "}
                    · {hoveredPanel.ids.size} 曲
                  </span>
                )}
              </p>
              <p className="mt-1 truncate font-serif text-sm text-ink">
                {hoveredPanel.song ? `《${hoveredPanel.song.title}》` : "无题"}
              </p>
              {hoveredPanel.song && creditSummary(hoveredPanel.song) && (
                <p className="mt-0.5 truncate font-kaiti text-xs text-ink-muted">
                  {creditSummary(hoveredPanel.song)}
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 二十一段色丝细弦 */}
      <div
        role="navigation"
        aria-label="二十年色丝琴弦"
        className="flex items-center gap-[3px]"
      >
        {panels.map((p, idx) => {
          const isActive = folded && p.key === activeKey;
          const isHovered = hoveredIdx === idx;
          const lit = panelLit(p, matched);
          const color = p.song ? stripeColor(p.song) : undefined;

          return (
            <button
              key={p.key}
              type="button"
              aria-label={p.year === null ? "年份未详" : `${p.year} 年`}
              aria-current={isActive ? "true" : undefined}
              onPointerEnter={(e) => {
                if (e.pointerType !== "mouse") return;
                window.clearTimeout(intent.current);
                intent.current = window.setTimeout(
                  () => setHoveredIdx(idx),
                  HOVER_INTENT_MS,
                );
              }}
              onFocus={() => setHoveredIdx(idx)}
              onBlur={() => setHoveredIdx(null)}
              onClick={() => onJump(p.year)}
              className="group relative flex flex-1 items-center py-2.5 outline-none"
            >
              {/* 当前阅读年份在弦上浮一枚微点 */}
              <span
                aria-hidden
                className={cn(
                  "pointer-events-none absolute top-0.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-(--tone) transition-opacity duration-300",
                  isActive || isHovered ? "opacity-100" : "opacity-0",
                )}
              />
              <span
                aria-hidden
                className={cn(
                  "block w-full rounded-full transition-all duration-400 ease-page",
                  isHovered || isActive
                    ? "h-[5px] opacity-100"
                    : "h-[3px] opacity-75 group-hover:opacity-100",
                  !lit && "opacity-15 grayscale",
                  !color && "bg-slate-300 dark:bg-slate-700",
                )}
                style={color ? { backgroundColor: color } : undefined}
              />
            </button>
          );
        })}
      </div>

      {/* 弦下疏朗刻度 */}
      <div className="flex w-full">
        {panels.map((p, idx) => {
          const visible = showTick(idx, p.year);
          const highlight = hoveredIdx === idx || (folded && activeIdx === idx);
          return (
            <div key={p.key} className="relative h-3.5 flex-1">
              {visible && (
                <span
                  className={cn(
                    "block whitespace-nowrap font-mono text-[10px] leading-none tabular-nums tracking-wider transition-colors duration-300",
                    idx === 0
                      ? "text-left"
                      : idx === count - 1
                        ? "text-right"
                        : "text-center",
                    highlight ? "text-(--tone)" : "text-ink-meta/80",
                  )}
                >
                  {p.year ?? "未详"}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
