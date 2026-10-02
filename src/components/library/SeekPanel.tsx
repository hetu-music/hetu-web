"use client";

import { FIELD_LABEL_CLASS } from "@/components/shared/form-field";
import {
  PRIMARY_BUTTON_CLASS,
  TEXT_BUTTON_CLASS,
} from "@/components/shared/text-button";
import type { LyricsSearchState } from "@/hooks/library/useLyricsIndex";
import type { LibraryImageryItem } from "@/lib/types";
import { cn } from "@/lib/utils/utils";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";
import LibraryIndex, {
  countActiveFilters,
  type LibraryFilters,
} from "./LibraryIndex";

const EASE = [0.23, 1, 0.32, 1] as const;
/** 字海平时列出的常用意象数；检索时最多列出的数目 */
const SEA_SIZE = 48;
const SEA_SEARCH_LIMIT = 160;
/** 字海里字号的范围（rem）：写到的作品越多字越大 */
const SEA_MIN_REM = 1.05;
const SEA_MAX_REM = 2.7;

/** 「寻」按钮：刻本一个字，放在顶栏常驻处 */
export function SeekButton({
  open,
  active,
  onClick,
}: {
  open: boolean;
  /** 点着灯时用强调色 */
  active: boolean;
  onClick: () => void;
}) {
  const t = useTranslations("library.seek");
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={open}
      aria-label={t("label")}
      title={t("label")}
      className={cn(
        "inline-flex size-10 items-center justify-center font-calligraphy text-2xl leading-none transition-colors",
        open || active
          ? "text-(--tone)"
          : "text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white",
      )}
    >
      {t("label")}
    </button>
  );
}

interface SeekPanelProps {
  open: boolean;
  onClose: () => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  lyricsState: LyricsSearchState;
  imageryItems: LibraryImageryItem[];
  selectedImagery: number[];
  toggleImagery: (id: number) => void;
  filters: LibraryFilters;
  /** 夜展里点着灯时：一键走进这些作品的特展 */
  onGather?: () => void;
}

/**
 * 寻：从顶栏下沿展开的一层。一行大字的搜索，一片意象字海，收起来的细检。
 * 夜展与近赏共用：在夜展里是掌灯（命中的亮起），在近赏里是办特展（只挂命中的）。
 */
export default function SeekPanel({
  open,
  onClose,
  searchQuery,
  setSearchQuery,
  lyricsState,
  imageryItems,
  selectedImagery,
  toggleImagery,
  filters,
  onGather,
}: SeekPanelProps) {
  const t = useTranslations("library.seek");
  const tCatalog = useTranslations("library.catalog");
  const tSearch = useTranslations("library.search");
  const [imageryQuery, setImageryQuery] = useState("");
  const [detailOpen, setDetailOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const detailCount = countActiveFilters(filters);

  useEffect(() => {
    if (!open) return;
    // 展开动画走一会儿再聚焦，免得窄屏键盘把面板顶乱
    const timer = setTimeout(() => inputRef.current?.focus(), 250);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  const sorted = useMemo(
    () =>
      [...imageryItems].sort(
        (a, b) => b.songCount - a.songCount || a.id - b.id,
      ),
    [imageryItems],
  );
  const maxCount = sorted[0]?.songCount ?? 1;
  const q = imageryQuery.trim();
  // 已点亮的意象总在字海里，排在最前
  const sea = useMemo(() => {
    const base = q
      ? sorted.filter((i) => i.name.includes(q)).slice(0, SEA_SEARCH_LIMIT)
      : sorted.slice(0, SEA_SIZE);
    const ids = new Set(base.map((i) => i.id));
    const pinned = sorted.filter(
      (i) => selectedImagery.includes(i.id) && !ids.has(i.id),
    );
    return [...pinned, ...base];
  }, [sorted, q, selectedImagery]);

  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.div
          key="seek"
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.45, ease: EASE }}
          className="overflow-hidden"
        >
          <div className="border-t border-slate-200/50 dark:border-slate-800/50">
            <div className="thin-scrollbar max-h-[calc(100dvh-var(--nav-h)-3rem)] overflow-y-auto overscroll-contain">
              <div className="mx-auto max-w-7xl px-4 sm:px-6 pt-6 pb-8 md:pt-10 md:pb-12">
                {/* 一行大字的搜索 */}
                <div className="flex items-end gap-6">
                  <label className="min-w-0 flex-1 border-b border-slate-300 dark:border-slate-700 focus-within:border-(--tone) transition-colors">
                    <span className="sr-only">{t("label")}</span>
                    <input
                      ref={inputRef}
                      type="search"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder={
                        lyricsState === "ready"
                          ? t("placeholder")
                          : tSearch("placeholderNoLyrics")
                      }
                      className="w-full bg-transparent pb-3 font-serif text-2xl md:text-4xl text-slate-900 dark:text-slate-50 outline-none placeholder:text-slate-300 dark:placeholder:text-slate-600 [&::-webkit-search-cancel-button]:hidden"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={onClose}
                    aria-label={t("close")}
                    className="mb-3 shrink-0 p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                  >
                    <X size={20} />
                  </button>
                </div>

                {/* 得几首、复原、走进特展 */}
                <div className="mt-4 flex min-h-5 flex-wrap items-baseline gap-x-4 gap-y-2 text-xs tracking-[0.2em] text-slate-400 dark:text-slate-500">
                  {filters.isAnyActive && (
                    <>
                      <span className="tabular-nums">
                        {tCatalog("result", { count: filters.resultCount })}
                      </span>
                      <span aria-hidden>·</span>
                      <button
                        type="button"
                        onClick={filters.reset}
                        className={TEXT_BUTTON_CLASS}
                      >
                        {tCatalog("reset")}
                      </button>
                      {onGather && filters.resultCount > 0 && (
                        <>
                          <span aria-hidden>·</span>
                          <button
                            type="button"
                            onClick={onGather}
                            className={PRIMARY_BUTTON_CLASS}
                          >
                            {t("gather", { count: filters.resultCount })}
                          </button>
                        </>
                      )}
                    </>
                  )}
                </div>

                {/* 意象字海：字号随写到的作品数 */}
                <section className="mt-10">
                  <div className="flex items-center justify-between gap-6">
                    <h3 className={FIELD_LABEL_CLASS}>{t("imagery")}</h3>
                    <input
                      value={imageryQuery}
                      onChange={(e) => setImageryQuery(e.target.value)}
                      placeholder={t("imageryFilter")}
                      aria-label={t("imageryFilter")}
                      className="w-32 md:w-44 border-0 border-b border-slate-200 dark:border-slate-800 bg-transparent px-0 py-1 text-right text-xs text-slate-600 dark:text-slate-300 outline-none focus:border-(--tone) placeholder:text-slate-400 dark:placeholder:text-slate-600"
                    />
                  </div>
                  {sea.length === 0 ? (
                    <p className="mt-6 font-kaiti text-sm text-slate-400 dark:text-slate-500">
                      {t("noImagery")}
                    </p>
                  ) : (
                    <div className="mt-5 flex flex-wrap items-baseline gap-x-5 gap-y-3 md:gap-x-7">
                      {sea.map((item) => {
                        const on = selectedImagery.includes(item.id);
                        const size =
                          SEA_MIN_REM +
                          (SEA_MAX_REM - SEA_MIN_REM) *
                            Math.sqrt(item.songCount / maxCount);
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => toggleImagery(item.id)}
                            aria-pressed={on}
                            title={`${item.name} · ${item.songCount}`}
                            className={cn(
                              "font-calligraphy leading-none transition-colors duration-300",
                              !on &&
                                "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white",
                            )}
                            style={{
                              fontSize: `${size}rem`,
                              color: on ? item.accent : undefined,
                            }}
                          >
                            {item.name}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </section>

                {/* 细检：类型、年代、流派与署名，平时收起 */}
                <section className="mt-10">
                  <button
                    type="button"
                    onClick={() => setDetailOpen(!detailOpen)}
                    aria-expanded={detailOpen}
                    className={cn(
                      TEXT_BUTTON_CLASS,
                      detailCount > 0 && "text-(--tone) dark:text-(--tone)",
                    )}
                  >
                    {detailCount > 0
                      ? t("detailActive", { count: detailCount })
                      : t("detail")}
                  </button>
                  <div
                    className={cn(
                      "grid transition-[grid-template-rows] duration-500 ease-page",
                      detailOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
                    )}
                  >
                    <div
                      className="min-h-0 overflow-hidden"
                      inert={!detailOpen}
                    >
                      <div className="max-w-xl pt-6">
                        <LibraryIndex filters={filters} />
                      </div>
                    </div>
                  </div>
                </section>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
