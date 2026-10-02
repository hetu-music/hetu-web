"use client";

import { TEXT_BUTTON_CLASS } from "@/components/shared/text-button";
import { ResponsivePanel } from "@/components/ui/responsive-panel";
import type { LibraryImageryItem } from "@/lib/types";
import { cn } from "@/lib/utils/utils";
import { Search } from "lucide-react";
import { useTranslations } from "next-intl";
import React, { useMemo, useState } from "react";

/** 「更多意象」里最多列出多少个，再多就请用户输入检索 */
const PANEL_LIMIT = 240;

/** 一个意象：刻本字，平时灰色，点亮时用分类色 */
function ImageryWord({
  item,
  on,
  onToggle,
  className,
}: {
  item: LibraryImageryItem;
  on: boolean;
  onToggle: (id: number) => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onToggle(item.id)}
      aria-pressed={on}
      title={`${item.name} · ${item.songCount}`}
      className={cn(
        "shrink-0 font-calligraphy leading-none transition-colors duration-300",
        !on &&
          "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white",
        className,
      )}
      style={on ? { color: item.accent } : undefined}
    >
      {item.name}
    </button>
  );
}

/**
 * 意象栏：全库最常写的一排意象，点一个，墙上写到它的作品亮起；再点别的取交集。
 * 已点亮但不在常用之列的排在最前面；「更多意象」里可以检索全部。
 */
export default function ImageryBar({
  top,
  all,
  selected,
  onToggle,
}: {
  top: LibraryImageryItem[];
  all: LibraryImageryItem[];
  selected: number[];
  onToggle: (id: number) => void;
}) {
  const t = useTranslations("library.wall");
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const byId = useMemo(() => new Map(all.map((i) => [i.id, i])), [all]);
  const topIds = useMemo(() => new Set(top.map((i) => i.id)), [top]);
  const extra = selected
    .filter((id) => !topIds.has(id))
    .map((id) => byId.get(id))
    .filter((i): i is LibraryImageryItem => !!i);

  const sortedAll = useMemo(
    () => [...all].sort((a, b) => b.songCount - a.songCount || a.id - b.id),
    [all],
  );
  const q = query.trim();
  const matches = (
    q ? sortedAll.filter((i) => i.name.includes(q)) : sortedAll
  ).slice(0, PANEL_LIMIT);

  if (all.length === 0) return null;

  return (
    <div className="flex items-center gap-5 min-w-0">
      {/* 窄屏横向滑动，右缘淡出提示还有 */}
      <div className="no-scrollbar flex min-w-0 flex-1 items-baseline gap-x-4 md:gap-x-5 overflow-x-auto py-2 mask-[linear-gradient(to_right,black_calc(100%-2rem),transparent)]">
        {[...extra, ...top].map((item) => (
          <ImageryWord
            key={item.id}
            item={item}
            on={selected.includes(item.id)}
            onToggle={onToggle}
            className="text-lg md:text-xl"
          />
        ))}
      </div>

      <ResponsivePanel
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setQuery("");
        }}
        title={t("more")}
        align="end"
        popoverClassName="w-[28rem] p-0 flex flex-col max-h-[min(32rem,calc(var(--available-height)-8px))] overflow-hidden"
        trigger={
          <button
            type="button"
            className={cn(TEXT_BUTTON_CLASS, "shrink-0 py-2")}
          >
            {t("more")}
          </button>
        }
      >
        {() => (
          <div className="flex min-h-0 flex-col">
            <label className="flex h-11 shrink-0 items-center gap-2 border-b border-slate-200/70 px-4 dark:border-slate-800">
              <Search
                size={14}
                className="shrink-0 text-slate-400"
                aria-hidden
              />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("searchImagery")}
                aria-label={t("searchImagery")}
                className="min-w-0 flex-1 bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400 dark:text-slate-300 dark:placeholder:text-slate-500"
              />
            </label>
            {matches.length === 0 ? (
              <p className="px-4 py-8 text-center font-kaiti text-sm text-slate-400 dark:text-slate-500">
                {t("noImagery")}
              </p>
            ) : (
              // 字海：按写到的作品数排，字一样大，只靠颜色区分点亮与否
              <div className="thin-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 flex flex-wrap items-baseline gap-x-4 gap-y-3">
                {matches.map((item) => (
                  <span
                    key={item.id}
                    className="inline-flex items-baseline gap-1"
                  >
                    <ImageryWord
                      item={item}
                      on={selected.includes(item.id)}
                      onToggle={onToggle}
                      className="text-lg"
                    />
                    <span className="text-[10px] tabular-nums text-slate-400 dark:text-slate-500">
                      {item.songCount}
                    </span>
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </ResponsivePanel>
    </div>
  );
}
