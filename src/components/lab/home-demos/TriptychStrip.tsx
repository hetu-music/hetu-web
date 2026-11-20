"use client";

import { Link } from "@/i18n/navigation";
import { ArrowUpRight } from "lucide-react";
import React from "react";
import { FLOATING_IMAGERY_WORDS, TRIPTYCH_ITEMS } from "./shared";

/**
 * 三大特色入口（倾尽天下 / 意象词云 / 寻曲）：
 * - 桌面端：紧凑的三联无框细线画廊，悬停时各自东方矿物色如水墨晕开，不把曲库推太深；
 * - 移动端：横向轻滑展条（约 120px 高，一屏露出一张半），不霸占纵向首屏空间。
 */
export default function TriptychStrip() {
  return (
    <section aria-label="特辑入口" className="pb-10 pt-2 md:pb-14">
      {/* 移动端：横向轻滑展条（snap-x，一屏露出一张半） */}
      <div className="no-scrollbar -mx-6 flex snap-x snap-mandatory gap-3.5 overflow-x-auto px-6 pb-1 md:hidden">
        {TRIPTYCH_ITEMS.map((item) => (
          <Link
            key={item.id}
            href={item.href}
            style={
              {
                "--ink": item.accentLight,
                "--ink-dark": item.accentDark,
                "--wash": item.washLight,
                "--wash-dark": item.washDark,
              } as React.CSSProperties
            }
            className="group relative flex min-h-[118px] w-[74vw] max-w-[268px] shrink-0 snap-start flex-col justify-between overflow-hidden rounded-lg border border-slate-200/80 bg-[#FAFAFA] p-4 dark:border-slate-800/80 dark:bg-[#0B0F19]"
          >
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 dark:hidden"
              style={{
                background:
                  "radial-gradient(ellipse 90% 80% at 92% 14%, var(--wash), transparent 72%)",
              }}
            />
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 hidden dark:block"
              style={{
                background:
                  "radial-gradient(ellipse 90% 80% at 92% 14%, var(--wash-dark), transparent 72%)",
              }}
            />

            <div className="relative flex items-center justify-between">
              <span className="text-[10px] tracking-[0.3em] text-(--ink) dark:text-(--ink-dark)">
                {item.numeral} · {item.tag}
              </span>
              <ArrowUpRight
                size={14}
                className="text-slate-400 dark:text-slate-500"
              />
            </div>

            <div className="relative mt-4">
              <h2 className="font-calligraphy text-2xl font-normal tracking-[0.2em] text-slate-900 dark:text-slate-50">
                {item.title}
              </h2>
              <p className="mt-1 line-clamp-1 font-kaiti text-xs text-slate-500 dark:text-slate-400">
                {item.subtitle}
              </p>
            </div>
          </Link>
        ))}
      </div>

      {/* 桌面端：紧凑无框三联细线画廊 */}
      <div className="hidden grid-cols-3 divide-x divide-slate-200/75 border-y border-slate-200/75 md:grid dark:divide-slate-800/75 dark:border-slate-800/75">
        {TRIPTYCH_ITEMS.map((item) => (
          <Link
            key={item.id}
            href={item.href}
            style={
              {
                "--ink": item.accentLight,
                "--ink-dark": item.accentDark,
                "--wash": item.washLight,
                "--wash-dark": item.washDark,
              } as React.CSSProperties
            }
            className="group relative flex min-h-[138px] flex-col justify-between overflow-hidden px-7 py-6 transition-colors duration-500"
          >
            {/* 悬停水墨色晕 */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-700 group-hover:opacity-100 dark:hidden"
              style={{
                background:
                  "radial-gradient(ellipse 85% 85% at 85% 20%, var(--wash), transparent 72%)",
              }}
            />
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 hidden opacity-0 transition-opacity duration-700 group-hover:opacity-100 dark:block"
              style={{
                background:
                  "radial-gradient(ellipse 85% 85% at 85% 20%, var(--wash-dark), transparent 72%)",
              }}
            />

            {/* 克制底纹 */}
            {item.id === "qjtx" && (
              <span
                aria-hidden
                className="pointer-events-none absolute -bottom-5 right-3 select-none font-calligraphy text-[6.5rem] leading-none text-[#9E3636]/[0.06] transition-transform duration-700 group-hover:-translate-y-1 dark:text-[#E46A6A]/[0.08]"
              >
                倾
              </span>
            )}
            {item.id === "imagery" && (
              <div
                aria-hidden
                className="pointer-events-none absolute right-5 top-7 flex max-w-32 flex-wrap justify-end gap-x-2.5 gap-y-1 select-none opacity-45 transition-opacity duration-500 group-hover:opacity-80"
              >
                {FLOATING_IMAGERY_WORDS.map((w, i) => (
                  <span
                    key={w}
                    className="font-calligraphy text-[#286B62]/30 dark:text-[#52BCAE]/35"
                    style={{ fontSize: i % 2 === 0 ? "1rem" : "0.82rem" }}
                  >
                    {w}
                  </span>
                ))}
              </div>
            )}
            {item.id === "quiz" && (
              <svg
                aria-hidden
                viewBox="0 0 120 120"
                className="pointer-events-none absolute -bottom-7 -right-7 h-28 w-28 text-[#9A6728]/16 transition-transform duration-1000 group-hover:rotate-45 dark:text-[#DFA95B]/20"
              >
                <circle
                  cx="60"
                  cy="60"
                  r="46"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="0.8"
                  strokeDasharray="2 4"
                />
                <circle
                  cx="60"
                  cy="60"
                  r="28"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="0.8"
                />
              </svg>
            )}

            <div className="relative flex items-center justify-between">
              <span className="text-[11px] tracking-[0.3em] text-(--ink) dark:text-(--ink-dark)">
                {item.numeral} · {item.tag}
              </span>
              <ArrowUpRight
                size={15}
                className="text-slate-300 transition-all duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-(--ink) dark:text-slate-700 dark:group-hover:text-(--ink-dark)"
              />
            </div>

            <div className="relative mt-5">
              <h2 className="font-calligraphy text-[26px] font-normal tracking-[0.2em] text-slate-900 transition-colors duration-300 group-hover:text-(--ink) dark:text-slate-50 dark:group-hover:text-(--ink-dark)">
                {item.title}
              </h2>
              <p className="mt-1.5 line-clamp-1 font-kaiti text-[13px] text-slate-500 dark:text-slate-400">
                {item.subtitle}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
