"use client";

import type { Song } from "@/lib/types";
import { cn } from "@/lib/utils/utils";
import { AnimatePresence, motion } from "framer-motion";
import { Fragment, useEffect } from "react";
import { HeaderDemoE as ScreenHeader } from "./HeaderDemoE";

export type HeaderVariant = "e";

export const HEADER_VARIANTS: readonly {
  id: HeaderVariant;
  code: string;
  label: string;
  note: string;
}[] = [
  {
    id: "e",
    code: "E",
    label: "二十扇屏",
    note: "二十扇屏 + 极轻切片横栏，不抢主视觉",
  },
];

export interface SharedHeaderProps {
  firstYear: number;
  lastYear: number;
  shownCount: number;
  totalCount: number;
  matched: ReadonlySet<number> | null;
  catalog: Song[];
  onOpenSong: (id: number) => void;
  onJumpYear: (year: number) => void;
}

/** 曲数动态跳变：筛选时数字换成命中数 */
export function SongCount({
  shownCount,
  totalCount,
  matched,
  className,
}: {
  shownCount: number;
  totalCount: number;
  matched: ReadonlySet<number> | null;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "font-serif text-sm tracking-[0.18em] text-ink-meta sm:text-base",
        className,
      )}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={shownCount}
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -5 }}
          transition={{ duration: 0.25 }}
          className={cn(
            "inline-block font-semibold tabular-nums",
            matched ? "text-(--tone)" : "text-ink-body",
          )}
        >
          {shownCount}
        </motion.span>
      </AnimatePresence>
      {matched ? ` / ${totalCount}` : ""} 曲
    </span>
  );
}

// ── 方向 E：二十扇屏 ──────────────────────────────────────────────────────────

export function HeaderDemoE({
  firstYear,
  lastYear,
  shownCount,
  totalCount,
  matched,
  catalog,
  onJumpYear,
}: SharedHeaderProps) {
  return (
    <ScreenHeader
      firstYear={firstYear}
      lastYear={lastYear}
      catalog={catalog}
      matched={matched}
      onJumpYear={onJumpYear}
      countSlot={
        <SongCount
          shownCount={shownCount}
          totalCount={totalCount}
          matched={matched}
        />
      }
    />
  );
}

// ── 原型切换浮条（左下角极简胶囊，不侵入任何一套头部版式） ──────────────────────

export function HeaderDemoSwitcher({
  value,
  onChange,
}: {
  value: HeaderVariant;
  onChange: (next: HeaderVariant) => void;
}) {
  // 数字键按顺序切方案（输入框聚焦时不拦截）
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      const next = HEADER_VARIANTS[Number(e.key) - 1];
      if (next) onChange(next.id);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onChange]);

  const current = HEADER_VARIANTS.find((v) => v.id === value);

  return (
    <div
      role="region"
      aria-label="头部原型切换"
      className="fixed bottom-5 left-4 z-50 flex flex-col items-start gap-1.5 sm:left-6"
    >
      {current && (
        <p className="hidden rounded-full border border-slate-200/75 bg-[#FAFAFA]/95 px-3 py-1 font-kaiti text-xs text-ink-muted shadow-sm sm:block dark:border-slate-800 dark:bg-[#0B0F19]/95">
          方案 {current.code}：{current.note}
        </p>
      )}
      <div className="flex items-center rounded-full border border-slate-200/80 bg-[#FAFAFA]/95 px-1.5 py-1 shadow-[0_8px_24px_-8px_rgba(15,23,42,0.18)] dark:border-slate-800 dark:bg-[#0B0F19]/95 dark:shadow-[0_10px_28px_-8px_rgba(0,0,0,0.65)]">
        <span className="hidden pl-2.5 pr-2 text-[10px] tracking-[0.24em] text-ink-meta sm:inline">
          卷首
        </span>
        {HEADER_VARIANTS.map((v, idx) => {
          const active = v.id === value;
          return (
            <Fragment key={v.id}>
              {idx > 0 && (
                <span aria-hidden className="mx-0.5 text-[10px] text-ink-faint">
                  ·
                </span>
              )}
              <button
                type="button"
                aria-pressed={active}
                onClick={() => onChange(v.id)}
                className={cn(
                  "rounded-full px-2.5 py-1 text-xs tracking-wider transition-colors",
                  active
                    ? "font-serif font-semibold text-(--tone)"
                    : "text-ink-muted hover:text-ink",
                )}
              >
                <span className="font-mono text-[11px]">{v.code}</span>
                <span className="ml-1 hidden sm:inline">{v.label}</span>
              </button>
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}
