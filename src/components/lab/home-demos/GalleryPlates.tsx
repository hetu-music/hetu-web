"use client";

import { Link } from "@/i18n/navigation";
import { ArrowUpRight, RefreshCw } from "lucide-react";
import React from "react";
import {
  type FeaturePlateItem,
  type FeaturedEntry,
  FLOATING_IMAGERY_WORDS,
} from "./shared";

/**
 * 画册里的「留白诗格」：与唱片封面同尺幅（aspect-square）和同款底栏文字节奏，
 * 像精装艺术画册中的一页宣纸题签，给满墙彩色封面留出呼吸气口。
 */
export function PoetryPlate({
  entry,
  onOpenSong,
  onCycle,
  canCycle,
}: {
  entry: FeaturedEntry;
  onOpenSong: (songId: number) => void;
  onCycle: () => void;
  canCycle: boolean;
}) {
  const columns = entry.excerpt?.split(/\s+/).filter(Boolean).slice(0, 3) ?? [];

  return (
    <article className="group flex flex-col">
      <div
        onClick={() => onOpenSong(entry.song.id)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onOpenSong(entry.song.id);
          }
        }}
        className="relative flex aspect-square w-full cursor-pointer flex-col items-center justify-center overflow-hidden rounded-md border border-slate-200/85 bg-[#FAFAFA] p-4 transition-all duration-500 hover:-translate-y-1 hover:border-(--tone)/45 hover:shadow-[0_22px_44px_-22px_rgba(15,23,42,0.22)] dark:border-slate-800/85 dark:bg-[#0E1320] dark:hover:border-(--tone)/45 dark:hover:shadow-[0_22px_44px_-20px_rgba(0,0,0,0.75)]"
      >
        {/* 角落一缕微不可察的墨色晕染 */}
        <div
          aria-hidden
          className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full opacity-20 blur-2xl transition-opacity duration-700 group-hover:opacity-35"
          style={{ background: "var(--tone)" }}
        />

        {/* 左上眉标 */}
        <span className="absolute left-3.5 top-3 text-[10px] tracking-[0.3em] text-(--tone)/80 sm:left-4 sm:top-3.5">
          摘句
        </span>

        {/* 右上轻换一句 */}
        {canCycle && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onCycle();
            }}
            aria-label="换一句摘句"
            title="换一句"
            className="absolute right-2.5 top-2.5 rounded-full p-1.5 text-ink-meta transition-colors hover:text-(--tone)"
          >
            <RefreshCw size={12} />
          </button>
        )}

        {/* 中央竖排刻本词句 + 细竖线 */}
        {columns.length > 0 ? (
          <div className="relative flex flex-row-reverse items-start justify-center gap-2.5 sm:gap-3.5">
            <span
              aria-hidden
              className="mt-0.5 h-10 w-px bg-(--tone)/55 sm:h-14"
            />
            {columns.map((col, i) => (
              <span
                key={i}
                className="font-calligraphy text-[17px] leading-none tracking-[0.26em] text-ink-body [writing-mode:vertical-rl] sm:text-[21px] sm:tracking-[0.3em]"
                style={{ marginTop: `${i * 0.85}rem` }}
              >
                {col}
              </span>
            ))}
          </div>
        ) : (
          <p className="px-2 text-center font-kaiti text-sm leading-relaxed text-ink-prose">
            你一定想知道，戏里讲了什么故事……
          </p>
        )}
      </div>

      {/* 与唱片封面严格对齐的底栏两行文字 */}
      <div className="mt-2.5 space-y-0.5 sm:mt-3.5 sm:space-y-1">
        <div className="flex items-baseline justify-between gap-2">
          <button
            type="button"
            onClick={() => onOpenSong(entry.song.id)}
            className="line-clamp-1 text-left font-serif text-[15px] leading-snug text-ink transition-colors group-hover:text-(--tone) sm:text-[18px]"
          >
            《{entry.song.title}》
          </button>
          <span className="shrink-0 font-mono text-[10px] tabular-nums text-ink-meta sm:text-[11px]">
            {entry.song.year || "卷首"}
          </span>
        </div>
        <p className="truncate font-kaiti text-xs text-ink-muted sm:text-[13px]">
          卷中拾句 · 点击入卷
        </p>
      </div>
    </article>
  );
}

/**
 * 画册里的「特辑彩插页」：把 倾尽天下 / 意象词云 / 寻曲 作为同尺幅的艺术展板
 * 编排进第 1 页画册矩阵中，消除顶部横幅割裂感，呈现美术馆画册的阅读惊喜。
 */
export function FeaturePlate({ item }: { item: FeaturePlateItem }) {
  return (
    <article className="group flex flex-col">
      <Link
        href={item.href}
        style={
          {
            "--ink": item.accentLight,
            "--ink-dark": item.accentDark,
            "--wash": item.washLight,
            "--wash-dark": item.washDark,
          } as React.CSSProperties
        }
        className="relative flex aspect-square w-full flex-col justify-between overflow-hidden rounded-md border border-slate-200/85 bg-[#FAFAFA] p-4 transition-all duration-500 hover:-translate-y-1 hover:border-(--ink)/45 hover:shadow-[0_24px_48px_-20px_rgba(15,23,42,0.24)] sm:p-5 dark:border-slate-800/85 dark:bg-[#0E1320] dark:hover:border-(--ink-dark)/45 dark:hover:shadow-[0_24px_48px_-20px_rgba(0,0,0,0.8)]"
      >
        {/* 专属东方矿物色柔和晕染 */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-75 transition-opacity duration-700 group-hover:opacity-100 dark:hidden"
          style={{
            background:
              "radial-gradient(ellipse 92% 85% at 88% 14%, var(--wash), transparent 72%)",
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 hidden opacity-75 transition-opacity duration-700 group-hover:opacity-100 dark:block"
          style={{
            background:
              "radial-gradient(ellipse 92% 85% at 88% 14%, var(--wash-dark), transparent 72%)",
          }}
        />

        {/* 三枚插页各自独有的美术馆视觉暗纹 */}
        {item.id === "qjtx" && (
          <span
            aria-hidden
            className="pointer-events-none absolute -bottom-5 -right-1 select-none font-calligraphy text-[7.5rem] leading-none text-[#9E3636]/[0.08] transition-transform duration-1000 group-hover:scale-105 sm:text-[9.5rem] dark:text-[#E46A6A]/[0.11]"
          >
            倾
          </span>
        )}

        {item.id === "imagery" && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-4 top-11 flex flex-wrap justify-end gap-x-2.5 gap-y-1.5 select-none opacity-55 transition-opacity duration-700 group-hover:opacity-90 sm:inset-x-5 sm:top-12"
          >
            {FLOATING_IMAGERY_WORDS.slice(0, 6).map((word, i) => (
              <span
                key={word}
                className="font-calligraphy text-[#286B62]/35 dark:text-[#52BCAE]/40"
                style={{
                  fontSize: i % 2 === 0 ? "1.15rem" : "0.9rem",
                }}
              >
                {word}
              </span>
            ))}
          </div>
        )}

        {item.id === "quiz" && (
          <svg
            aria-hidden
            viewBox="0 0 140 140"
            className="pointer-events-none absolute -bottom-7 -right-7 h-32 w-32 text-[#9A6728]/20 transition-transform duration-1000 group-hover:rotate-45 sm:h-40 sm:w-40 dark:text-[#DFA95B]/24"
          >
            <circle
              cx="70"
              cy="70"
              r="54"
              fill="none"
              stroke="currentColor"
              strokeWidth="0.8"
              strokeDasharray="2 4"
            />
            <circle
              cx="70"
              cy="70"
              r="34"
              fill="none"
              stroke="currentColor"
              strokeWidth="0.8"
            />
            <path
              d="M70 10 L70 130 M10 70 L130 70"
              stroke="currentColor"
              strokeWidth="0.6"
            />
          </svg>
        )}

        {/* 顶部序号与箭头 */}
        <div className="relative flex items-center justify-between">
          <span className="text-[10px] tracking-[0.3em] text-(--ink) sm:text-[11px] dark:text-(--ink-dark)">
            特辑 · {item.numeral}
          </span>
          <ArrowUpRight
            size={15}
            className="text-ink-faint transition-all duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-(--ink) dark:group-hover:text-(--ink-dark)"
          />
        </div>

        {/* 底部大字刻本名 + 一道极细强调色丝线 */}
        <div className="relative">
          <span
            aria-hidden
            className="mb-2.5 block h-px w-6 bg-(--ink)/60 transition-all duration-500 group-hover:w-11 dark:bg-(--ink-dark)/60"
          />
          <p className="font-calligraphy text-2xl tracking-[0.2em] text-ink transition-colors duration-300 group-hover:text-(--ink) sm:text-3xl dark:group-hover:text-(--ink-dark)">
            {item.title}
          </p>
        </div>
      </Link>

      {/* 与唱片封面严格对齐的底栏两行文字 */}
      <div className="mt-2.5 space-y-0.5 sm:mt-3.5 sm:space-y-1">
        <div className="flex items-baseline justify-between gap-2">
          <Link
            href={item.href}
            className="line-clamp-1 font-serif text-[15px] leading-snug text-ink transition-colors group-hover:text-(--tone) sm:text-[18px]"
          >
            {item.title}
          </Link>
          <span className="shrink-0 text-[10px] tracking-[0.2em] text-ink-meta sm:text-[11px]">
            {item.tag}
          </span>
        </div>
        <p className="truncate font-kaiti text-xs text-ink-muted sm:text-[13px]">
          {item.subtitle}
        </p>
      </div>
    </article>
  );
}
