"use client";

import { useMouseDragScroll } from "@/hooks/ui/useMouseDragScroll";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils/utils";
import { ArrowUpRight, ChevronLeft, ChevronRight } from "lucide-react";
import React, { useCallback } from "react";

export interface FeatureEntranceItem {
  id: string;
  href: string;
  title: string;
  tag: string;
  desc: string;
  accentLight: string;
  accentDark: string;
  washLight: string;
  washDark: string;
}

export const CORE_FEATURES: FeatureEntranceItem[] = [
  {
    id: "qjtx",
    href: "/story/qjtx",
    title: "倾尽天下",
    tag: "互动长卷",
    desc: "一曲长歌，随乐声缓步展开江山旧梦",
    accentLight: "#9E3636",
    accentDark: "#E46A6A",
    washLight: "rgba(158, 54, 54, 0.11)",
    washDark: "rgba(228, 106, 106, 0.18)",
  },
  {
    id: "imagery",
    href: "/imagery",
    title: "意象词云",
    tag: "词中万象",
    desc: "从长安白雪到孤城旧梦，漫游词中谱系",
    accentLight: "#286B62",
    accentDark: "#52BCAE",
    washLight: "rgba(40, 107, 98, 0.11)",
    washDark: "rgba(82, 188, 174, 0.18)",
  },
  {
    id: "quiz",
    href: "/quiz",
    title: "寻曲",
    tag: "十二问寻歌",
    desc: "十二个问题，一段旅程，寻一首懂你的歌",
    accentLight: "#9A6728",
    accentDark: "#DFA95B",
    washLight: "rgba(154, 103, 40, 0.12)",
    washDark: "rgba(223, 169, 91, 0.18)",
  },
];

function cssVars(item: FeatureEntranceItem): React.CSSProperties {
  return {
    "--ink": item.accentLight,
    "--ink-dark": item.accentDark,
    "--wash": item.washLight,
    "--wash-dark": item.washDark,
  } as React.CSSProperties;
}

/**
 * 方案 B：「横向展签长带」
 * 位于卷首与二十年光谱之间的定高横向展签流：
 * - 3 项时桌面端三等分舒展；后续拓展到 4 项及以上时自动切换为可拖拽、带左右微箭头的横向流，
 *   永远保持固定高度，不把下方光谱与编年目录越推越深；移动端天然支持指尖横滑。
 */
export function FeatureRibbonB({ items }: { items: FeatureEntranceItem[] }) {
  const { containerRef, hasDraggedRef, dragHandlers } =
    useMouseDragScroll<HTMLDivElement>();

  const scrollBy = useCallback(
    (dir: -1 | 1) => {
      containerRef.current?.scrollBy({ left: dir * 320, behavior: "smooth" });
    },
    [containerRef],
  );

  const isScrollableDesktop = items.length > 3;

  return (
    <nav aria-label="站点特辑" className="relative mb-8">
      {isScrollableDesktop && (
        <div className="mb-2 hidden justify-end gap-1 md:flex">
          <button
            type="button"
            onClick={() => scrollBy(-1)}
            aria-label="向左浏览"
            className="p-1 text-ink-meta transition-colors hover:text-(--tone)"
          >
            <ChevronLeft size={15} />
          </button>
          <button
            type="button"
            onClick={() => scrollBy(1)}
            aria-label="向右浏览"
            className="p-1 text-ink-meta transition-colors hover:text-(--tone)"
          >
            <ChevronRight size={15} />
          </button>
        </div>
      )}

      <div
        ref={containerRef}
        {...dragHandlers}
        className={cn(
          "no-scrollbar -mx-6 flex snap-x snap-mandatory gap-3.5 overflow-x-auto px-6 pb-1 active:cursor-grabbing",
          isScrollableDesktop
            ? "md:cursor-grab md:mask-[linear-gradient(to_right,black_calc(100%-3rem),transparent)]"
            : "md:mx-0 md:grid md:grid-cols-3 md:gap-4 md:overflow-visible md:px-0",
        )}
      >
        {items.map((item) => (
          <Link
            key={item.id}
            href={item.href}
            style={cssVars(item)}
            onClick={(e) => {
              if (hasDraggedRef.current) e.preventDefault();
            }}
            className={cn(
              "group relative flex h-[86px] shrink-0 snap-start flex-col justify-between overflow-hidden rounded-md border border-slate-200/80 bg-[#FAFAFA] px-4 py-3.5 transition-all duration-400 hover:-translate-y-0.5 hover:border-(--ink)/45 dark:border-slate-800/85 dark:bg-[#0D121F] dark:hover:border-(--ink-dark)/45",
              isScrollableDesktop
                ? "w-[74vw] max-w-[280px] md:w-[272px]"
                : "w-[74vw] max-w-[280px] md:w-auto md:max-w-none",
            )}
          >
            {/* 柔和角落矿物色晕 */}
            <span
              aria-hidden
              className="pointer-events-none absolute inset-0 opacity-75 transition-opacity duration-500 group-hover:opacity-100 dark:hidden"
              style={{
                background:
                  "radial-gradient(ellipse 85% 110% at 92% 15%, var(--wash), transparent 72%)",
              }}
            />
            <span
              aria-hidden
              className="pointer-events-none absolute inset-0 hidden opacity-75 transition-opacity duration-500 group-hover:opacity-100 dark:block"
              style={{
                background:
                  "radial-gradient(ellipse 85% 110% at 92% 15%, var(--wash-dark), transparent 72%)",
              }}
            />

            {/* 左侧极细竖色丝 */}
            <span
              aria-hidden
              className="pointer-events-none absolute inset-y-3 left-0 w-[2px] rounded-r-full bg-(--ink)/75 transition-opacity group-hover:opacity-100 dark:bg-(--ink-dark)/80"
            />

            <div className="relative flex items-center justify-between gap-2">
              <span className="text-[10px] tracking-[0.28em] text-(--ink) dark:text-(--ink-dark)">
                {item.tag}
              </span>
              <ArrowUpRight
                size={14}
                className="text-ink-faint transition-all duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-(--ink) dark:group-hover:text-(--ink-dark)"
              />
            </div>

            <div className="relative flex items-baseline gap-3">
              <span className="shrink-0 font-calligraphy text-[22px] leading-none tracking-[0.16em] text-ink transition-colors group-hover:text-(--ink) dark:group-hover:text-(--ink-dark)">
                {item.title}
              </span>
              <span className="min-w-0 truncate font-kaiti text-xs text-ink-muted">
                {item.desc}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </nav>
  );
}
