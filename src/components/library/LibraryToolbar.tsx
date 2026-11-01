"use client";

import { NAV_BUTTON_CLASS } from "@/components/shared/nav-button";
import { TAB_HAIRLINE_CLASS } from "@/components/shared/tab-hairline";
import type { LyricsSearchState } from "@/hooks/library/useLyricsLines";
import { useMouseDragScroll } from "@/hooks/ui/useMouseDragScroll";
import {
  FILTER_OPTION_ALL,
  FILTER_OPTION_UNKNOWN,
  MUSIC_LIBRARY_VIEW_MODES,
  type MusicLibraryViewMode,
} from "@/lib/constants";
import { cn } from "@/lib/utils/utils";
import {
  LayoutGrid,
  List,
  Mic2,
  RotateCcw,
  Search,
  SlidersHorizontal,
  X,
  XCircle,
} from "lucide-react";
import { useTranslations } from "next-intl";
import React from "react";

const VIEW_MODE_ICONS: Record<MusicLibraryViewMode, React.ReactNode> = {
  grid: <LayoutGrid size={18} />,
  list: <List size={18} />,
};

/** 类型标签：文字切换，当前项下方一道强调色短线（同个人中心的目录） */
const TYPE_TAB_CLASS =
  "relative flex h-full shrink-0 items-center whitespace-nowrap font-serif text-[15px] tracking-wider transition-colors select-none";

function TypeTab({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        TYPE_TAB_CLASS,
        active
          ? "text-slate-900 dark:text-slate-100"
          : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-(--tone) transition-opacity",
          active ? "opacity-100" : "opacity-0",
        )}
      />
      {label}
    </button>
  );
}

/** 工具栏的图标按钮：同顶栏，选中只变色 */
function toolButtonClass(active: boolean) {
  return cn(
    NAV_BUTTON_CLASS,
    "shrink-0",
    active && "text-(--tone) dark:text-(--tone)",
  );
}

interface LibraryToolbarProps {
  types: string[];
  type: string;
  onTypeChange: (type: string) => void;
  /** 有任何筛选时，「全部」换成「重置」 */
  isAnyFilterActive: boolean;
  onReset: () => void;
  searchInput: string;
  onSearchChange: (query: string) => void;
  /** 搜索框获得焦点：这时才去拉歌词（docs/LIBRARY.md 阶段 5「3.」） */
  onSearchFocus: () => void;
  lyricsState: LyricsSearchState;
  advanced: boolean;
  onAdvancedChange: (open: boolean) => void;
  view: MusicLibraryViewMode;
  onViewChange: (view: MusicLibraryViewMode) => void;
  /** 展开的筛选面板 */
  children?: React.ReactNode;
}

/**
 * 曲目工具栏：吸顶，底下只有一道细线。标签、搜索、按钮都放在等高的
 * 一行里竖直居中，当前标签与聚焦的搜索框在细线上亮一段强调色。
 * 窄屏分两行：上面搜索与按钮，下面类型标签，两行各有一道细线分开；
 * 标签行右缘淡出，提示还能横向滑动。淡出是钉在行的右缘上的，不随滑动走开，
 * 所以行尾补一段空白（gap-6 加 after:w-2，正好 2rem），滑到底时最后一项停在淡出之外。
 *
 * 只认传进来的值，不读地址栏：阶段 4 服务端渲染默认状态时直接用。
 */
export default function LibraryToolbar({
  types,
  type,
  onTypeChange,
  isAnyFilterActive,
  onReset,
  searchInput,
  onSearchChange,
  onSearchFocus,
  lyricsState,
  advanced,
  onAdvancedChange,
  view,
  onViewChange,
  children,
}: LibraryToolbarProps) {
  const t = useTranslations("library");
  const tCommon = useTranslations("common");
  const tEnum = useTranslations("enums");
  const { containerRef, hasDraggedRef, dragHandlers } =
    useMouseDragScroll<HTMLDivElement>();

  return (
    <section className="sticky top-(--nav-h) z-40 -mx-6 mb-10 bg-[#FAFAFA]/95 px-6 pt-2 backdrop-blur-sm dark:bg-[#0B0F19]/95">
      <div
        className={cn(
          TAB_HAIRLINE_CLASS,
          "flex flex-col-reverse md:h-12 md:flex-row md:gap-8",
        )}
      >
        <div
          ref={containerRef}
          {...dragHandlers}
          className="no-scrollbar flex h-12 min-w-0 cursor-grab gap-6 overflow-x-auto mask-[linear-gradient(to_right,black_calc(100%-2rem),transparent)] after:w-2 after:shrink-0 active:cursor-grabbing md:h-full md:mask-none md:after:hidden"
        >
          {types.map((option) => {
            if (option === FILTER_OPTION_ALL && isAnyFilterActive) {
              return (
                <button
                  key="reset"
                  type="button"
                  onClick={(event) => {
                    if (hasDraggedRef.current) {
                      event.preventDefault();
                      return;
                    }
                    onReset();
                  }}
                  className={cn(
                    TYPE_TAB_CLASS,
                    "gap-1.5 text-(--tone) hover:opacity-75",
                  )}
                >
                  <RotateCcw size={13} />
                  {t("reset")}
                </button>
              );
            }

            const tabLabel = (() => {
              if (option === FILTER_OPTION_ALL) return tCommon("all");
              if (option === FILTER_OPTION_UNKNOWN) return tCommon("unknown");
              return tEnum.has(`type.${option}`)
                ? tEnum(`type.${option}`)
                : option;
            })();

            return (
              <TypeTab
                key={option}
                label={tabLabel}
                active={type === option}
                onClick={() => {
                  if (hasDraggedRef.current) return;
                  onTypeChange(option);
                }}
              />
            );
          })}
        </div>

        <div
          className={cn(
            TAB_HAIRLINE_CLASS,
            "flex h-11 items-center gap-1 md:ml-auto md:h-full md:before:hidden",
          )}
        >
          {/* 搜索：平时没有边框，只靠放大镜与占位字辨认；聚焦时细线上亮一段强调色 */}
          <label className="group relative flex h-full min-w-0 flex-1 items-center gap-2 md:w-60 md:flex-none">
            <Search size={15} className="shrink-0 text-slate-400" />
            <input
              type="text"
              // 固定提到歌词：点了搜索框才拉歌词，没点之前它永远没到
              placeholder={t("search.placeholder")}
              value={searchInput}
              onFocus={onSearchFocus}
              onChange={(event) => onSearchChange(event.target.value)}
              className="h-full min-w-0 flex-1 bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400 dark:text-slate-200 dark:placeholder:text-slate-500"
            />
            {searchInput ? (
              <button
                type="button"
                onClick={() => onSearchChange("")}
                className="shrink-0 p-1 text-slate-300 transition-colors hover:text-slate-500 dark:text-slate-600 dark:hover:text-slate-400"
              >
                <XCircle size={14} />
              </button>
            ) : lyricsState === "loading" ? (
              <span className="block h-3 w-3 shrink-0 animate-spin rounded-full border border-slate-300 border-t-(--tone) dark:border-slate-600" />
            ) : lyricsState === "ready" ? (
              <Mic2 size={13} className="shrink-0 text-(--tone) opacity-50" />
            ) : null}
            <span
              aria-hidden
              className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-(--tone) opacity-0 transition-opacity group-focus-within:opacity-100"
            />
          </label>

          {/* 搜索与按钮之间一道竖线，分开「找」与「怎么看」 */}
          <span
            aria-hidden
            className="mx-2 h-4 w-px shrink-0 bg-slate-200 dark:bg-slate-800"
          />

          <button
            type="button"
            onClick={() => onAdvancedChange(!advanced)}
            aria-pressed={advanced}
            className={toolButtonClass(advanced)}
            title={t("advancedFilter")}
          >
            {advanced ? <X size={18} /> : <SlidersHorizontal size={18} />}
          </button>
          {MUSIC_LIBRARY_VIEW_MODES.map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => onViewChange(mode)}
              aria-pressed={view === mode}
              className={toolButtonClass(view === mode)}
              title={mode === "grid" ? t("view.grid") : t("view.list")}
            >
              {VIEW_MODE_ICONS[mode]}
            </button>
          ))}
        </div>
      </div>

      {advanced && children && (
        <div className="animate-in slide-in-from-top-2 fade-in border-b border-slate-200/70 pb-6 pt-5 duration-300 dark:border-slate-800">
          {children}
        </div>
      )}
    </section>
  );
}
