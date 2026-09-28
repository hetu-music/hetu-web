import { NEUTRAL_TONE } from "@/lib/utils/utils-tone";
import React from "react";

/** 整页提示里的文字按钮比正文里的大一号 */
export const STATUS_ACTION_CLASS = "text-sm";

/**
 * 404、出错这类整页提示，排成卷首的样子：宽屏左栏一个页码式的大号数字，
 * 右栏题名、楷体说明与文字按钮。不用图标、不用卡片。
 * 不依赖 next-intl：根目录的 not-found 在语言路由之外，文案由调用方传入。
 */
export default function StatusPage({
  mark,
  title,
  description,
  children,
}: {
  /** 大号淡色数字，如 404；不传则只有右栏 */
  mark?: string;
  title: string;
  description: string;
  /** 文字按钮 */
  children?: React.ReactNode;
}) {
  return (
    <div
      className="min-h-screen flex items-center bg-[#FAFAFA] dark:bg-[#0B0F19] transition-colors duration-500 [--tone:var(--tone-light)] dark:[--tone:var(--tone-dark)]"
      style={
        {
          "--tone-light": NEUTRAL_TONE.light,
          "--tone-dark": NEUTRAL_TONE.dark,
        } as React.CSSProperties
      }
    >
      <main className="w-full max-w-6xl mx-auto px-6 py-24 grid gap-8 lg:grid-cols-[22rem_minmax(0,1fr)] lg:gap-x-16 lg:items-end animate-in fade-in slide-in-from-bottom-4 duration-700">
        {mark ? (
          <p
            aria-hidden
            className="font-serif text-[6rem] md:text-[9rem] font-semibold leading-none tracking-tight tabular-nums text-slate-200 dark:text-slate-800 select-none"
          >
            {mark}
          </p>
        ) : (
          <span aria-hidden className="hidden lg:block" />
        )}

        <div className="min-w-0 lg:pb-3">
          <span aria-hidden className="block w-8 h-px bg-(--tone) opacity-60" />
          <h1 className="mt-6 font-serif text-4xl md:text-5xl font-semibold leading-[1.1] tracking-tight text-slate-900 dark:text-slate-50 text-balance">
            {title}
          </h1>
          <p className="mt-6 max-w-[40em] font-kaiti text-[15px] leading-[2.05] text-slate-600 dark:text-slate-400">
            {description}
          </p>
          {children && (
            <div className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-3">
              {children}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
