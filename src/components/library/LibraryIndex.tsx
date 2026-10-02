"use client";

import { FIELD_LABEL_CLASS } from "@/components/shared/form-field";
import {
  PRIMARY_BUTTON_CLASS,
  TEXT_BUTTON_CLASS,
} from "@/components/shared/text-button";
import { InlineOptions } from "@/components/shared/topbar/menu";
import { Drawer, DrawerContent, DrawerTrigger } from "@/components/ui/drawer";
import { Slider } from "@/components/ui/slider";
import type { LyricsSearchState } from "@/hooks/library/useLyricsIndex";
import { FILTER_OPTION_ALL, FILTER_OPTION_UNKNOWN } from "@/lib/constants";
import type { FilterOptions } from "@/lib/types";
import { cn } from "@/lib/utils/utils";
import { Search, X } from "lucide-react";
import { useTranslations } from "next-intl";
import React, { useState } from "react";
import CustomSelect from "./CustomSelect";

/** 检索要用到的全部筛选状态，由 MusicLibraryClient 汇总后传下来 */
export interface LibraryFilters {
  options: FilterOptions;
  /** 各类型的收录数，键与 options.allTypes 一致 */
  typeCounts: Map<string, number>;
  type: string;
  setType: (type: string) => void;
  sliderYears: (string | number)[];
  yearRange: [number, number];
  setYearRange: (range: [number, number]) => void;
  genre: string[];
  setGenre: (v: string[]) => void;
  artist: string[];
  setArtist: (v: string[]) => void;
  lyricist: string[];
  setLyricist: (v: string[]) => void;
  composer: string[];
  setComposer: (v: string[]) => void;
  arranger: string[];
  setArranger: (v: string[]) => void;
  /** 当前筛出的首数（不计存疑） */
  resultCount: number;
  isAnyActive: boolean;
  reset: () => void;
}

/** 除搜索词以外生效的筛选项数，窄屏「筛选」按钮上用 */
export function countActiveFilters(f: LibraryFilters): number {
  const yearActive =
    f.sliderYears.length > 0 &&
    (f.yearRange[0] !== 0 || f.yearRange[1] !== f.sliderYears.length - 1);
  return [
    f.type !== FILTER_OPTION_ALL,
    yearActive,
    f.genre.length > 0,
    f.artist.length > 0,
    f.lyricist.length > 0,
    f.composer.length > 0,
    f.arranger.length > 0,
  ].filter(Boolean).length;
}

/** 搜索框：只有一道底线，聚焦时换成强调色 */
export function SearchField({
  value,
  onChange,
  lyricsState,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  lyricsState: LyricsSearchState;
  className?: string;
}) {
  const t = useTranslations("library.search");
  return (
    <label
      className={cn(
        "flex items-center gap-2 border-b border-slate-300 dark:border-slate-700 focus-within:border-(--tone) transition-colors",
        className,
      )}
    >
      <Search size={14} className="shrink-0 text-slate-400" aria-hidden />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={
          lyricsState === "ready"
            ? t("placeholderWithLyrics")
            : t("placeholderNoLyrics")
        }
        className="h-10 min-w-0 flex-1 bg-transparent text-[15px] text-slate-800 dark:text-slate-200 outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500 [&::-webkit-search-cancel-button]:hidden"
      />
      {value ? (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label={t("clear")}
          className="shrink-0 p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
        >
          <X size={14} />
        </button>
      ) : (
        lyricsState === "loading" && (
          // 歌词索引还在建：一圈细线转着，建好后占位字会多出「歌词」
          <span
            aria-hidden
            className="block size-3 shrink-0 animate-spin rounded-full border border-slate-300 border-t-(--tone) dark:border-slate-600"
          />
        )
      )}
    </label>
  );
}

function useTypeLabel() {
  const tCommon = useTranslations("common");
  const tEnum = useTranslations("enums");
  return (type: string) => {
    if (type === FILTER_OPTION_ALL) return tCommon("all");
    if (type === FILTER_OPTION_UNKNOWN) return tCommon("unknown");
    return tEnum.has(`type.${type}`) ? tEnum(`type.${type}`) : type;
  };
}

/**
 * 检索：类型、年份与五个下拉，排成一行行文字。
 * 宽屏在总目左栏（aside），窄屏收进底部面板（drawer）；搜索框两处都单独放。
 */
export default function LibraryIndex({
  filters: f,
  layout,
}: {
  filters: LibraryFilters;
  layout: "aside" | "drawer";
}) {
  const t = useTranslations("library");
  const tFilter = useTranslations("library.filter");
  const tCommon = useTranslations("common");
  const tEnum = useTranslations("enums");
  const typeLabel = useTypeLabel();

  const genreLabel = (genre: string) => {
    if (genre === FILTER_OPTION_UNKNOWN) return tCommon("unknown");
    return tEnum.has(`genre.${genre}`) ? tEnum(`genre.${genre}`) : genre;
  };
  const toOptions = (values: string[], label = (v: string) => v) =>
    values
      .filter((v) => v !== FILTER_OPTION_ALL)
      .map((v) => ({ value: v, label: label(v) }));

  const selects = [
    {
      key: "genre",
      value: f.genre,
      onChange: f.setGenre,
      placeholder: tFilter("allGenres"),
      options: toOptions(f.options.allGenres, genreLabel),
    },
    {
      key: "artist",
      value: f.artist,
      onChange: f.setArtist,
      placeholder: tFilter("allArtists"),
      options: toOptions(f.options.allArtists),
    },
    {
      key: "lyricist",
      value: f.lyricist,
      onChange: f.setLyricist,
      placeholder: tFilter("allLyricists"),
      options: toOptions(f.options.allLyricists),
    },
    {
      key: "composer",
      value: f.composer,
      onChange: f.setComposer,
      placeholder: tFilter("allComposers"),
      options: toOptions(f.options.allComposers),
    },
    {
      key: "arranger",
      value: f.arranger,
      onChange: f.setArranger,
      placeholder: tFilter("allArrangers"),
      options: toOptions(f.options.allArrangers),
    },
  ];

  // 年份还没算出来时先给个占位区间
  const years =
    f.sliderYears.length > 0
      ? f.sliderYears
      : [new Date().getFullYear(), FILTER_OPTION_UNKNOWN];
  const [from, to] = f.yearRange;
  const yearLabel = (i: number) => {
    const v = years[i];
    return v === FILTER_OPTION_UNKNOWN ? tCommon("unknown") : String(v);
  };

  return (
    <div>
      {/* 类型：宽屏竖排成目录并注明首数；窄屏是一行「·」隔开的文字 */}
      <h3 className={FIELD_LABEL_CLASS}>{tFilter("type")}</h3>
      {layout === "aside" ? (
        <ol className="mt-3">
          {f.options.allTypes.map((type) => {
            const current = f.type === type;
            return (
              <li key={type}>
                <button
                  type="button"
                  onClick={() => f.setType(type)}
                  aria-pressed={current}
                  className={cn(
                    "relative flex w-full items-baseline justify-between gap-4 py-1.5 pl-4 text-left font-serif text-[15px] tracking-wider transition-colors",
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
                  <span className="truncate">{typeLabel(type)}</span>
                  <span className="shrink-0 font-sans text-xs tabular-nums text-slate-400 dark:text-slate-500">
                    {f.typeCounts.get(type) ?? 0}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      ) : (
        <div className="mt-1">
          <InlineOptions
            items={f.options.allTypes.map((type) => ({
              id: type,
              label: typeLabel(type),
            }))}
            active={f.type}
            onSelect={(id) => f.setType(id)}
          />
        </div>
      )}

      {/* 年份：标签与区间一行，滑轨在下；区间文字定宽右对齐，拖动时不跳 */}
      <div className="mt-10 grid grid-cols-[1fr_auto] items-center gap-x-6 gap-y-3">
        <span className={FIELD_LABEL_CLASS}>{tFilter("yearRange")}</span>
        <span className="text-right text-xs tabular-nums tracking-wider text-slate-700 dark:text-slate-300">
          {from === to
            ? yearLabel(from)
            : `${yearLabel(from)} — ${yearLabel(to)}`}
        </span>
        <div className="col-span-2 flex h-5 items-center">
          <Slider
            min={0}
            max={years.length - 1}
            step={1}
            value={[from, to]}
            onValueChange={(v) =>
              f.setYearRange([v[0], v[1]] as [number, number])
            }
            minStepsBetweenValues={0}
            aria-label={tFilter("yearRange")}
          />
        </div>
      </div>

      <dl className="mt-8 space-y-3">
        {selects.map((s) => (
          <div
            key={s.key}
            className="grid grid-cols-[3rem_minmax(0,1fr)] items-center gap-x-4"
          >
            <dt className={FIELD_LABEL_CLASS}>{tFilter(s.key)}</dt>
            <dd className="min-w-0">
              <CustomSelect
                value={s.value}
                onChange={s.onChange}
                label={tFilter(s.key)}
                placeholder={s.placeholder}
                options={s.options}
              />
            </dd>
          </div>
        ))}
      </dl>

      <p className="mt-10 flex items-baseline gap-3 text-xs tracking-[0.2em] text-slate-400 dark:text-slate-500">
        <span className="tabular-nums">
          {t("catalog.result", { count: f.resultCount })}
        </span>
        {f.isAnyActive && (
          <>
            <span aria-hidden className="text-slate-300 dark:text-slate-600">
              ·
            </span>
            <button
              type="button"
              onClick={f.reset}
              className={PRIMARY_BUTTON_CLASS}
            >
              {t("catalog.reset")}
            </button>
          </>
        )}
      </p>
    </div>
  );
}

/** 窄屏：吸顶栏里的「筛选」文字按钮，点开底部面板 */
export function IndexDrawerButton({ filters }: { filters: LibraryFilters }) {
  const t = useTranslations("library.catalog");
  const [open, setOpen] = useState(false);
  const active = countActiveFilters(filters);

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger
        render={
          <button
            type="button"
            className={cn(
              TEXT_BUTTON_CLASS,
              "shrink-0 py-2",
              active > 0 && "text-(--tone) dark:text-(--tone)",
            )}
          />
        }
      >
        {active > 0 ? t("filterActive", { count: active }) : t("filter")}
      </DrawerTrigger>
      <DrawerContent title={t("index")} className="max-h-[85vh]">
        <LibraryIndex filters={filters} layout="drawer" />
      </DrawerContent>
    </Drawer>
  );
}
