"use client";

import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
} from "@/components/ui/drawer";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import { useIsDesktop } from "@/hooks/ui/useIsDesktop";
import type { PaletteEntry } from "@/lib/imagery/palette";
import type { ImageryItem, SongRef } from "@/lib/types";
import { ChevronRight } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

// ─── shared types ─────────────────────────────────────────────────────────────

export type SongResult = SongRef;

/** 没有署名词作者的曲目归在这一组；只作内部标记，显示时取 i18n 的「未知」 */
export const UNKNOWN_LYRICIST = "\u0000unknown";

export interface DetailPanelProps {
  open: boolean;
  panelSide?: "left" | "right";
  selectedItem: ImageryItem | null;
  selectedPalette: PaletteEntry;
  selectedCategoryPath: string[];
  songs: SongResult[];
  songsLoading: boolean;
  lyricistCounts: [string, number][];
  onClose: () => void;
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function SectionLabel({ label, accent }: { label: string; accent: string }) {
  return (
    <div className="flex items-center gap-3 my-5">
      <div className="flex-1 h-px bg-slate-100 dark:bg-slate-800" />
      <div className="relative h-4 flex items-center justify-center min-w-[30%]">
        <AnimatePresence mode="wait">
          <motion.span
            key={label}
            initial={{ opacity: 0, y: 6, filter: "blur(4px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -6, filter: "blur(4px)" }}
            transition={{
              duration: 0.25,
              ease: [0.23, 1, 0.32, 1],
            }}
            className="absolute text-[10px] tracking-[0.3em] pl-[0.3em] font-medium shrink-0 whitespace-nowrap"
            style={{ color: accent }}
          >
            {label}
          </motion.span>
        </AnimatePresence>
      </div>
      <div className="flex-1 h-px bg-slate-100 dark:bg-slate-800" />
    </div>
  );
}

// ─── Panel body ───────────────────────────────────────────────────────────────

const PanelBody = memo(function PanelBody({
  songs,
  songsLoading,
  lyricistCounts,
  selectedPalette,
  activeLyricist,
  onLyricistClick,
  onLinkClick,
}: {
  songs: SongResult[];
  songsLoading: boolean;
  lyricistCounts: [string, number][];
  selectedPalette: PaletteEntry;
  activeLyricist: string | null;
  onLyricistClick: (name: string) => void;
  onLinkClick: () => void;
}) {
  const t = useTranslations("common.imagery");
  const tCommon = useTranslations("common");
  const activeLyricistLabel =
    (activeLyricist === UNKNOWN_LYRICIST
      ? tCommon("unknown")
      : activeLyricist) || "";
  const filtered = useMemo(
    () =>
      activeLyricist
        ? songs.filter((song) =>
            activeLyricist === UNKNOWN_LYRICIST
              ? !song.lyricist || song.lyricist.length === 0
              : song.lyricist?.includes(activeLyricist),
          )
        : songs,
    [songs, activeLyricist],
  );

  if (songsLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div
          className="inline-block h-5 w-5 animate-spin rounded-full border-[1.5px] border-solid border-r-transparent"
          style={{ borderColor: `${selectedPalette.accent} transparent` }}
        />
      </div>
    );
  }

  if (songs.length === 0) {
    return (
      <p className="text-center font-kaiti text-sm py-16 text-slate-400 dark:text-slate-500">
        {t("detailPanel.noWorks")}
      </p>
    );
  }

  return (
    <>
      {/* Lyricist filter badges */}
      {lyricistCounts.length > 0 && (
        <>
          <SectionLabel
            label={t("detailPanel.lyricistLabel")}
            accent={selectedPalette.accent}
          />
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mb-2">
            <button
              onClick={() => onLyricistClick("")}
              className={`group relative text-[13px] transition-all duration-500 font-serif tracking-widest whitespace-nowrap py-1 ${
                !activeLyricist
                  ? "text-slate-900 dark:text-white"
                  : "text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
              }`}
            >
              <span
                className={`inline-block transition-all duration-500 ${
                  !activeLyricist
                    ? "opacity-100 translate-x-0"
                    : "opacity-0 -translate-x-2"
                } mr-1`}
                style={{ color: selectedPalette.accent }}
              >
                「
              </span>
              {t("all")}
              <span
                className={`inline-block transition-all duration-500 ${
                  !activeLyricist
                    ? "opacity-100 translate-x-0"
                    : "opacity-0 translate-x-2"
                } ml-1`}
                style={{ color: selectedPalette.accent }}
              >
                」
              </span>
            </button>

            {lyricistCounts.map(([name, count]) => {
              const displayName =
                name === UNKNOWN_LYRICIST ? tCommon("unknown") : name;
              const isActive = activeLyricist === name;
              return (
                <button
                  key={name}
                  onClick={() => onLyricistClick(name)}
                  className={`group relative text-[13px] transition-all duration-500 font-serif tracking-widest whitespace-nowrap py-1 ${
                    isActive
                      ? "text-slate-900 dark:text-white"
                      : "text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                  }`}
                >
                  <span
                    className={`inline-block transition-all duration-500 ${
                      isActive
                        ? "opacity-100 translate-x-0"
                        : "opacity-0 -translate-x-2"
                    } mr-1`}
                    style={{ color: selectedPalette.accent }}
                  >
                    「
                  </span>
                  {displayName}
                  <span
                    className={`inline-block transition-all duration-500 ${
                      isActive
                        ? "opacity-100 translate-x-0"
                        : "opacity-0 translate-x-2"
                    } ml-1`}
                    style={{ color: selectedPalette.accent }}
                  >
                    」
                  </span>
                  <span className="ml-1 text-[10px] opacity-40 tracking-normal group-hover:opacity-60 transition-opacity">
                    ({count})
                  </span>
                </button>
              );
            })}
          </div>
        </>
      )}

      {/* Songs */}
      <div className="mt-2">
        <SectionLabel
          label={
            activeLyricist
              ? t("detailPanel.songsByLyricist", { name: activeLyricistLabel })
              : t("detailPanel.relatedSongs")
          }
          accent={selectedPalette.accent}
        />
        <div className="flex flex-col -mx-6 relative">
          <AnimatePresence mode="popLayout" initial={false}>
            {filtered.map((song, i) => (
              <motion.div
                key={song.id}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{
                  opacity: 1,
                  y: 0,
                  transition: {
                    delay: i * 0.02,
                    duration: 0.5,
                    ease: [0.23, 1, 0.32, 1],
                  },
                }}
                exit={{
                  opacity: 0,
                  scale: 0.98,
                  transition: { duration: 0.2 },
                }}
                className="w-full"
              >
                <Link
                  href={`/song/${song.id}`}
                  onClick={onLinkClick}
                  className="flex items-center justify-between py-4 px-6 border-b border-slate-100/80 dark:border-slate-800/50 last:border-0 hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors group"
                >
                  <div className="min-w-0 pr-4">
                    <div className="font-serif text-sm text-slate-700 dark:text-slate-200 group-hover:text-slate-900 dark:group-hover:text-white transition-colors truncate tracking-wide">
                      {song.title}
                    </div>
                    <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-1 truncate tracking-wide">
                      {song.lyricist?.length
                        ? song.lyricist.join("  ·  ")
                        : tCommon("unknown")}
                    </div>
                  </div>
                  <ChevronRight
                    size={14}
                    className="text-slate-300 dark:text-slate-600 group-hover:text-slate-400 dark:group-hover:text-slate-400 transition-all duration-300 transform group-hover:translate-x-0.5"
                  />
                </Link>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>
    </>
  );
});

// ─── Panel header ──────────────────────────────────────────────────────────────

/** 分类与出现次数，写法同歌曲页的意象书眉（ImageryCaption）：分类一行衬线小字，数目一行楷体 */
function PanelMeta({ path, count }: { path: string[]; count: number }) {
  const t = useTranslations("common.imagery");
  return (
    <div className="space-y-1">
      {path.length > 0 && (
        <p className="font-serif text-xs tracking-[0.2em] text-slate-500 dark:text-slate-400">
          {path.join(" · ")}
        </p>
      )}
      <p className="font-kaiti text-sm text-slate-600 dark:text-slate-300">
        {t("detailPanel.appears", { count })}
      </p>
    </div>
  );
}

function PanelHeader({
  selectedItem,
  selectedPalette,
  selectedCategoryPath,
  isDesktop,
}: {
  selectedItem: ImageryItem | null;
  selectedPalette: PaletteEntry;
  selectedCategoryPath: string[];
  isDesktop: boolean;
}) {
  if (!selectedItem) return null;

  if (isDesktop) {
    return (
      <div className="relative shrink-0 px-12 pt-10 pb-7 overflow-hidden border-b border-slate-100/40 dark:border-slate-800/40">
        {/* Decorative background character */}
        <span
          aria-hidden
          className="pointer-events-none select-none absolute -bottom-6 -right-3 font-calligraphy leading-none"
          style={{
            fontSize: "11rem",
            opacity: 0.035,
            color: selectedPalette.accent,
            letterSpacing: "-0.05em",
          }}
        >
          {selectedItem.name[0]}
        </span>

        <h2
          className={`font-calligraphy text-[3.2rem] leading-none font-normal tracking-[0.2em] mb-4 ${selectedPalette.text}`}
        >
          {selectedItem.name}
        </h2>
        <PanelMeta path={selectedCategoryPath} count={selectedItem.count} />
        <div
          className="mt-5 h-[1.5px] w-12 rounded-full"
          style={{ backgroundColor: selectedPalette.accent, opacity: 0.6 }}
        />
      </div>
    );
  }

  // Mobile header (inside the sheet, below the drag handle)
  return (
    <div className="flex items-start justify-between px-8 pt-3 pb-4 border-b border-slate-100/40 dark:border-slate-800/40 shrink-0">
      <div className="min-w-0">
        <h2
          className={`font-calligraphy text-3xl font-normal tracking-[0.2em] mb-1 ${selectedPalette.text}`}
        >
          {selectedItem.name}
        </h2>
        <PanelMeta path={selectedCategoryPath} count={selectedItem.count} />
      </div>
    </div>
  );
}

// ─── unified detail panel ─────────────────────────────────────────────────────

export default function ImageryDetailPanel(props: DetailPanelProps) {
  const {
    open,
    panelSide = "right",
    selectedItem,
    selectedPalette,
    selectedCategoryPath,
    songs,
    songsLoading,
    lyricistCounts,
    onClose,
  } = props;

  const t = useTranslations("common.imagery");
  const isDesktop = useIsDesktop();
  const [activeLyricist, setActiveLyricist] = useState<string | null>(null);

  // Clear lyricist filter when selection changes
  useEffect(() => {
    requestAnimationFrame(() => {
      setActiveLyricist(null);
    });
  }, [selectedItem]);

  // 面板开启时锁定页面滚动
  useEffect(() => {
    if (!open) return;

    const html = document.documentElement;
    const body = document.body;

    const prev = {
      htmlOverflow: html.style.overflow,
      htmlTouchAction: html.style.touchAction,
      htmlOverscrollBehavior: html.style.overscrollBehavior,
      bodyOverflow: body.style.overflow,
      bodyTouchAction: body.style.touchAction,
      bodyOverscrollBehavior: body.style.overscrollBehavior,
    };

    // overflow:hidden 阻止窗口滚动，且不改变 window.scrollY。
    // 不能用 position:fixed —— 它会将 scrollY 重置为 0，
    // 破坏依赖 window.scrollY 定位的 useWindowVirtualizer。
    html.style.overflow = "hidden";
    html.style.touchAction = "none";
    html.style.overscrollBehavior = "none";
    body.style.overflow = "hidden";
    body.style.touchAction = "none";
    body.style.overscrollBehavior = "none";

    // 额外阻止 iOS Safari 橡皮筋回弹，同时放行面板内部滚动容器的触摸事件
    const preventTouchMove = (e: TouchEvent) => {
      const target = e.target as Element | null;
      if (target?.closest(".overflow-y-auto")) return;
      e.preventDefault();
    };
    document.addEventListener("touchmove", preventTouchMove, {
      passive: false,
    });

    return () => {
      html.style.overflow = prev.htmlOverflow;
      html.style.touchAction = prev.htmlTouchAction;
      html.style.overscrollBehavior = prev.htmlOverscrollBehavior;
      body.style.overflow = prev.bodyOverflow;
      body.style.touchAction = prev.bodyTouchAction;
      body.style.overscrollBehavior = prev.bodyOverscrollBehavior;
      document.removeEventListener("touchmove", preventTouchMove);
    };
  }, [open]);

  const handleLyricistClick = useCallback((name: string) => {
    setActiveLyricist((prev) => (name === "" || prev === name ? null : name));
  }, []);

  const sharedBodyProps = {
    songs,
    songsLoading,
    lyricistCounts,
    selectedPalette,
    activeLyricist,
    onLyricistClick: handleLyricistClick,
    onLinkClick: onClose,
  };

  if (!isDesktop) {
    return (
      <Drawer open={open} onOpenChange={(v) => !v && onClose()}>
        <DrawerContent className="h-[65dvh]">
          {/* Accessible title/description (visually hidden) */}
          <DrawerTitle className="sr-only">
            {selectedItem?.name ?? t("detailPanel.title")}
          </DrawerTitle>
          <DrawerDescription className="sr-only">
            {selectedItem
              ? t("detailPanel.description", {
                  name: selectedItem.name,
                  count: selectedItem.count,
                })
              : t("detailPanel.title")}
          </DrawerDescription>

          <PanelHeader
            selectedItem={selectedItem}
            selectedPalette={selectedPalette}
            selectedCategoryPath={selectedCategoryPath}
            isDesktop={isDesktop}
          />

          <div className="flex-1 overflow-y-auto no-scrollbar px-8 py-4 pb-[env(safe-area-inset-bottom,1rem)]">
            <PanelBody {...sharedBodyProps} />
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()} modal={false}>
      <SheetContent
        side={panelSide}
        className={[
          "top-(--nav-h) h-[calc(100vh-var(--nav-h))] w-[min(440px,42vw)] p-0 border-none shadow-2xl transition-all duration-500",
          panelSide === "right"
            ? "border-l border-slate-200/50 dark:border-white/5"
            : "border-r border-slate-200/50 dark:border-white/5",
        ].join(" ")}
      >
        {/* Accessible title/description (visually hidden) */}
        <SheetTitle className="sr-only">
          {selectedItem?.name ?? t("detailPanel.title")}
        </SheetTitle>
        <SheetDescription className="sr-only">
          {selectedItem
            ? t("detailPanel.description", {
                name: selectedItem.name,
                count: selectedItem.count,
              })
            : t("detailPanel.title")}
        </SheetDescription>

        <PanelHeader
          selectedItem={selectedItem}
          selectedPalette={selectedPalette}
          selectedCategoryPath={selectedCategoryPath}
          isDesktop={isDesktop}
        />

        <div className="flex-1 overflow-y-auto no-scrollbar px-12 pb-10">
          <PanelBody {...sharedBodyProps} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
