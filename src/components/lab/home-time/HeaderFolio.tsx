"use client";

import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils/utils";
import { Fragment, type Ref, useImperativeHandle, useState } from "react";
import {
  ENTRANCE_DEFS,
  type FeatureData,
  FeatureEpigraph,
  type FeatureKey,
  type ScreenPanel,
  type YearRailHandle,
  hanzi,
  panelLit,
} from "./header-shared";
import { stripeColor } from "./timeline";

/**
 * 方案一 · 总目开篇：卷首零图留白，与歌曲详情页 SongHero 一脉相承。
 * 左侧疏朗题名与活题字，右侧一根细竖线垂下错落三列刻本入口；
 * 让下方 2026 章的大画幅直接成为首屏唯一的视觉重心。
 */
export function FolioHero({
  firstYear,
  lastYear,
  totalCount,
  features,
}: {
  firstYear: number;
  lastYear: number;
  totalCount: number;
  features: FeatureData;
}) {
  const [feature, setFeature] = useState<FeatureKey | null>(null);

  return (
    <header className="pt-4 pb-10 md:pt-8 md:pb-16">
      <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0 max-w-2xl">
          <p className="flex items-baseline gap-2.5 text-xs tracking-[0.3em] text-ink-meta">
            <span className="font-mono text-[11px] tabular-nums tracking-[0.24em]">
              {firstYear} — {lastYear}
            </span>
            <span aria-hidden className="text-ink-faint">
              ·
            </span>
            <span className="font-serif tracking-[0.22em]">
              {hanzi(totalCount)}曲
            </span>
          </p>

          <h1 className="mt-4 font-serif text-5xl font-semibold leading-[1.08] tracking-tight text-ink md:text-6xl xl:text-[4.25rem]">
            二十年
          </h1>

          <FeatureEpigraph
            feature={feature}
            features={features}
            className="mt-6 text-base md:mt-7 md:text-[17px]"
          />

          {/* 移动端横向刻本入口 */}
          <nav
            aria-label="特展"
            className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-2 md:hidden"
          >
            {ENTRANCE_DEFS.map((item, idx) => (
              <Fragment key={item.key}>
                {idx > 0 && (
                  <span aria-hidden className="text-ink-faint">
                    ·
                  </span>
                )}
                <Link
                  href={item.href}
                  className="font-calligraphy text-lg tracking-[0.25em] text-ink-prose transition-colors hover:text-(--tone)"
                >
                  {item.name}
                </Link>
              </Fragment>
            ))}
          </nav>
        </div>

        {/* 桌面端右侧：借鉴 SongHero 竖排摘句，一根细竖线旁错落垂下三列刻本入口 */}
        <nav
          aria-label="特展"
          className="hidden shrink-0 flex-row-reverse items-start gap-7 pt-1 md:flex"
        >
          <span
            aria-hidden
            className="mt-1 h-20 w-px shrink-0 bg-(--tone)/50"
          />
          {ENTRANCE_DEFS.map((item, idx) => {
            const active = feature === item.key;
            return (
              <Link
                key={item.key}
                href={item.href}
                onPointerEnter={(e) => {
                  if (e.pointerType === "mouse") setFeature(item.key);
                }}
                onPointerLeave={() => setFeature(null)}
                onFocus={() => setFeature(item.key)}
                onBlur={() => setFeature(null)}
                className={cn(
                  "font-calligraphy text-[1.45rem] leading-none tracking-[0.38em] outline-none transition-colors duration-300 [writing-mode:vertical-rl] xl:text-[1.6rem]",
                  active
                    ? "text-(--tone)"
                    : "text-ink-prose/85 hover:text-(--tone) focus-visible:text-(--tone)",
                )}
                style={{ marginTop: `${idx * 1.65}rem` }}
              >
                {item.name}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}

/**
 * 书口色签：贴在视口右缘的一列极细二十年色丝，仿古书翻开时露出的书口签条。
 * 常态极轻不扰阅读，当前所在年份伸长并显出纪年；指针靠近时浮现整五年刻度；
 * 检索筛选时未命中的年份自动褪淡。
 */
export function ForeEdgeRail({
  ref,
  panels,
  matched,
  onJump,
}: {
  ref: Ref<YearRailHandle>;
  panels: ScreenPanel[];
  matched: ReadonlySet<number> | null;
  onJump: (year: number | null) => void;
}) {
  const [activeKey, setActiveKey] = useState(panels[0]?.key ?? "");
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  useImperativeHandle(ref, () => ({ setActive: setActiveKey }), []);

  return (
    <nav
      aria-label="编年书口"
      className="group/rail fixed top-1/2 right-3 z-40 hidden -translate-y-1/2 flex-col items-end py-2 lg:flex xl:right-6"
      onPointerLeave={() => setHoveredKey(null)}
    >
      {panels.map((p, idx) => {
        const isActive = p.key === activeKey;
        const isHovered = p.key === hoveredKey;
        const lit = panelLit(p, matched);
        const isLandmark =
          idx === 0 ||
          idx === panels.length - 1 ||
          (typeof p.year === "number" && p.year % 5 === 0);
        const color = p.song ? stripeColor(p.song) : undefined;

        return (
          <button
            key={p.key}
            type="button"
            aria-label={p.year === null ? "年份未详" : `${p.year} 年`}
            aria-current={isActive ? "true" : undefined}
            onPointerEnter={() => setHoveredKey(p.key)}
            onFocus={() => setHoveredKey(p.key)}
            onBlur={() => setHoveredKey(null)}
            onClick={() => onJump(p.year)}
            className="group flex items-center gap-2 py-[4px] pr-1 pl-4 outline-none"
            style={{ opacity: lit ? 1 : 0.16 }}
          >
            <span
              className={cn(
                "font-mono text-[10px] leading-none tabular-nums tracking-wider transition-all duration-300",
                isActive || isHovered
                  ? "opacity-100 text-(--tone)"
                  : isLandmark
                    ? "text-ink-meta opacity-0 group-hover/rail:opacity-75"
                    : "pointer-events-none opacity-0",
              )}
            >
              {p.year ?? "未详"}
            </span>
            <span
              aria-hidden
              className={cn(
                "block h-[2px] rounded-full transition-all duration-400 ease-page",
                isActive || isHovered
                  ? "w-6 opacity-100"
                  : "w-2.5 opacity-55 group-hover:w-5 group-hover:opacity-100",
                !color && "bg-slate-400 dark:bg-slate-500",
              )}
              style={color ? { backgroundColor: color } : undefined}
            />
          </button>
        );
      })}
    </nav>
  );
}
