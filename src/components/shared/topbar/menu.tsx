"use client";

import { cn } from "@/lib/utils/utils";
import React from "react";

/**
 * 顶栏浮层里的选项：宽屏下拉与窄屏底部面板共用。
 * 浮层本身见 components/ui 的 popover、drawer、responsive-panel。
 */

export interface MenuItem {
  id: string;
  label: string;
}

/** 竖排的选项列表（目录、板块、主题、文字）：当前项只变色，左侧一道强调色短线 */
export function MenuList({
  items,
  active,
  onSelect,
  size,
}: {
  items: readonly MenuItem[];
  active: string | undefined;
  onSelect: (id: string, e: React.MouseEvent<HTMLButtonElement>) => void;
  size: "sm" | "lg";
}) {
  return (
    <ol>
      {items.map((item) => {
        const current = item.id === active;
        return (
          <li key={item.id}>
            <button
              type="button"
              onClick={(e) => onSelect(item.id, e)}
              aria-current={current ? "true" : undefined}
              className={cn(
                "relative w-full pl-4 text-left font-serif tracking-wider whitespace-nowrap transition-colors",
                size === "sm" ? "py-2 text-sm" : "py-3 text-base",
                current
                  ? "text-slate-900 dark:text-slate-100"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100",
              )}
            >
              <span
                aria-hidden
                className={cn(
                  "absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-3.5 rounded-full bg-(--tone) transition-opacity",
                  current ? "opacity-100" : "opacity-0",
                )}
              />
              {item.label}
            </button>
          </li>
        );
      })}
    </ol>
  );
}

/** 一行里用「·」隔开的文字选项，底部面板里的主题与文字用 */
export function InlineOptions({
  items,
  active,
  onSelect,
  disabled,
}: {
  items: readonly MenuItem[];
  active: string | undefined;
  onSelect: (id: string, e: React.MouseEvent<HTMLButtonElement>) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
      {items.map((item, i) => {
        const current = item.id === active;
        return (
          <React.Fragment key={item.id}>
            {i > 0 && (
              <span aria-hidden className="text-slate-300 dark:text-slate-600">
                ·
              </span>
            )}
            <button
              type="button"
              onClick={(e) => onSelect(item.id, e)}
              aria-pressed={current}
              disabled={disabled}
              className={cn(
                "py-2 text-sm tracking-widest transition-colors disabled:opacity-40 disabled:cursor-wait",
                current
                  ? "text-(--tone)"
                  : "text-slate-400 hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-200",
              )}
            >
              {item.label}
            </button>
          </React.Fragment>
        );
      })}
    </div>
  );
}
