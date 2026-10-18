"use client";

import { Loader2, Search, X } from "lucide-react";
import type React from "react";
import { InlineOptions } from "@/components/shared/topbar/menu";
import { useTwoStepConfirm } from "@/hooks/ui/useTwoStepConfirm";
import { cn } from "@/lib/utils/utils";
import { DANGER_TEXT_CLASS, TEXT_BUTTON_CLASS } from "./styles";

/** 吸顶工具栏：左边筛选，右边搜索。样式同 DESIGN.md 第四节的吸顶二级栏 */
export function AdminToolbar({
  children,
  search,
  className,
}: {
  children?: React.ReactNode;
  search?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "sticky top-(--nav-h) z-40 -mx-4 mb-6 border-b border-slate-200/70 bg-[#FAFAFA]/95 px-4 py-2 backdrop-blur-sm sm:-mx-6 sm:px-6 dark:border-slate-800 dark:bg-[#0B0F19]/95",
        className,
      )}
    >
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">{children}</div>
        {search}
      </div>
    </div>
  );
}

export interface FilterOption<K extends string> {
  key: K;
  label: string;
  count?: number;
}

/** 筛选：「·」隔开的文字选项，当前项只变色 */
export function FilterOptions<K extends string>({
  options,
  active,
  onSelect,
}: {
  options: readonly FilterOption<K>[];
  active: K;
  onSelect: (key: K) => void;
}) {
  return (
    <InlineOptions
      items={options.map((o) => ({
        id: o.key,
        label: o.count === undefined ? o.label : `${o.label} ${o.count}`,
      }))}
      active={active}
      onSelect={(id) => onSelect(id as K)}
    />
  );
}

/** 工具栏里的搜索：只有一道底线 */
export function SearchInput({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  className?: string;
}) {
  return (
    <div className={cn("relative w-full md:w-72", className)}>
      <Search
        size={14}
        className="pointer-events-none absolute left-0 top-1/2 -translate-y-1/2 text-slate-400"
      />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="block w-full border-0 border-b border-slate-300 bg-transparent py-1.5 pl-6 pr-6 text-sm text-slate-800 outline-none transition-colors placeholder:text-slate-400 focus:border-(--tone) dark:border-slate-700 dark:text-slate-200 dark:placeholder:text-slate-600 [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          className="absolute right-0 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
          aria-label="清除搜索"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}

export function LoadingState({ text = "加载中…" }: { text?: string }) {
  return (
    <p className="flex items-center justify-center gap-2 py-20 text-sm text-slate-400">
      <Loader2 size={14} className="animate-spin" />
      {text}
    </p>
  );
}

/** 空状态：一句楷体灰字 */
export function EmptyState({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <p
      className={cn(
        "py-20 text-center font-kaiti text-base text-slate-400",
        className,
      )}
    >
      {children}
    </p>
  );
}

export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="py-20 text-center text-sm">
      <p className="text-rose-600 dark:text-rose-400">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className={cn(TEXT_BUTTON_CLASS, "mt-3")}
        >
          重试
        </button>
      )}
    </div>
  );
}

/** 危险操作的两步确认：文字从「删除」变成 rose 色的「确认删除」，3 秒内不点就复原 */
export function ConfirmButton({
  onConfirm,
  label = "删除",
  confirmLabel = "确认删除",
  busy = false,
  disabled,
  className,
}: {
  onConfirm: () => void;
  label?: React.ReactNode;
  confirmLabel?: React.ReactNode;
  busy?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  const { confirming, request } = useTwoStepConfirm();
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        if (request()) onConfirm();
      }}
      disabled={disabled || busy}
      className={cn(
        TEXT_BUTTON_CLASS,
        "inline-flex items-center gap-1",
        confirming && DANGER_TEXT_CLASS,
        className,
      )}
    >
      {busy && <Loader2 size={12} className="animate-spin" />}
      {confirming ? confirmLabel : label}
    </button>
  );
}

export interface Stat {
  label: string;
  value: React.ReactNode;
  /** 需要处理的数字用警示色 */
  warn?: boolean;
}

/** 题头下的一行统计：小字标签加数字，「·」隔开 */
export function StatLine({ stats }: { stats: readonly Stat[] }) {
  if (stats.length === 0) return null;
  return (
    <dl className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm">
      {stats.map((s, i) => (
        <div key={s.label} className="flex items-baseline gap-3">
          {i > 0 && (
            <span aria-hidden className="text-slate-300 dark:text-slate-600">
              ·
            </span>
          )}
          <dt className="text-xs tracking-[0.2em] text-slate-400 dark:text-slate-500">
            {s.label}
          </dt>
          <dd
            className={cn(
              "tabular-nums",
              s.warn
                ? "text-amber-600 dark:text-amber-400"
                : "text-slate-700 dark:text-slate-200",
            )}
          >
            {s.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
