"use client";

import SongPlayActions from "@/components/shared/SongPlayActions";
import { PRIMARY_BUTTON_CLASS } from "@/components/shared/text-button";
import type { LyricsSnippetParts } from "@/hooks/library/useLyricsIndex";
import { Link } from "@/i18n/navigation";
import type { LibraryImageryItem, Song } from "@/lib/types";
import { cn } from "@/lib/utils/utils";
import { bumpNavDepth } from "@/lib/utils/utils-nav";
import { getCoverUrl } from "@/lib/utils/utils-song";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import Image from "next/image";
import { useEffect } from "react";
import { useCreditLine } from "./CatalogEntries";

const EASE = [0.23, 1, 0.32, 1] as const;
/** 题签里最多列几个意象 */
const MARK_LIMIT = 8;

interface WallCaptionProps {
  song: Song | null;
  /** 点选（而不只是鼠标停留）：这时才有关闭按钮与同类计数 */
  pinned: boolean;
  /** 这首写到的意象，已按全库少见程度排好 */
  marks: LibraryImageryItem[];
  /** 已点亮的意象 */
  selectedImagery: number[];
  kinCount: number;
  snippet: LyricsSnippetParts | null;
  onSelectImagery: (id: number) => void;
  onNavigate: (songId: number) => void;
  onClose: () => void;
  /** 鼠标移进题签时不要收起（要去点里面的按钮） */
  onHoverChange: (hovering: boolean) => void;
}

/**
 * 封面墙的题签：从顶栏下沿展开，像展厅里画旁的标签。
 * 题名、署名、这首的意象（点一下就按它点灯）、展卷。放在顶栏里，免得和底部的播放条挤在一起。
 */
export default function WallCaption({
  song,
  pinned,
  marks,
  selectedImagery,
  kinCount,
  snippet,
  onSelectImagery,
  onNavigate,
  onClose,
  onHoverChange,
}: WallCaptionProps) {
  const t = useTranslations("library.wall");
  const creditLine = useCreditLine();
  const tEnum = useTranslations("enums");

  useEffect(() => {
    if (!pinned) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pinned, onClose]);

  const credits = song ? creditLine(song) : null;
  const type = song?.type?.[0];
  const meta = song
    ? [
        song.year,
        type && (tEnum.has(`type.${type}`) ? tEnum(`type.${type}`) : type),
        credits,
      ].filter(Boolean)
    : [];

  return (
    <AnimatePresence initial={false}>
      {song && (
        <motion.div
          key="caption"
          role="status"
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.35, ease: EASE }}
          onPointerEnter={() => onHoverChange(true)}
          onPointerLeave={() => onHoverChange(false)}
          className="overflow-hidden"
        >
          <div className="border-t border-slate-200/50 dark:border-slate-800/50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-4">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={song.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.18 }}
                  className="flex min-w-0 flex-1 items-center gap-4"
                >
                  <div className="hidden sm:block size-14 shrink-0 overflow-hidden rounded-sm ring-1 ring-slate-900/5 dark:ring-white/10">
                    <Image
                      src={getCoverUrl(song)}
                      alt=""
                      width={56}
                      height={56}
                      className="size-full object-cover"
                    />
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="flex items-baseline gap-3 min-w-0">
                      <span className="truncate font-serif text-lg text-slate-900 dark:text-slate-50">
                        {song.title}
                      </span>
                      <span className="hidden md:block truncate text-xs tracking-wider text-slate-400 dark:text-slate-500">
                        {meta.join(" · ")}
                      </span>
                    </p>

                    {/* 意象：刻本小字，平时灰色，已点亮的用分类色 */}
                    <div className="mt-1 flex min-w-0 items-baseline gap-x-3 overflow-hidden whitespace-nowrap">
                      {marks.length === 0 ? (
                        <span className="font-kaiti text-sm text-slate-400 dark:text-slate-500">
                          {t("noMarks")}
                        </span>
                      ) : (
                        marks.slice(0, MARK_LIMIT).map((mark) => {
                          const on = selectedImagery.includes(mark.id);
                          return (
                            <button
                              key={mark.id}
                              type="button"
                              onClick={() => onSelectImagery(mark.id)}
                              aria-pressed={on}
                              className={cn(
                                "shrink-0 font-calligraphy text-lg leading-none transition-colors",
                                !on &&
                                  "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white",
                              )}
                              style={on ? { color: mark.accent } : undefined}
                            >
                              {mark.name}
                            </button>
                          );
                        })
                      )}
                      {pinned && kinCount > 0 && (
                        <span className="hidden lg:inline shrink-0 ml-2 text-xs tracking-wider text-slate-400 dark:text-slate-500">
                          {t("kin", { count: kinCount })}
                        </span>
                      )}
                    </div>

                    {snippet && (
                      <p className="mt-1 truncate font-kaiti text-sm text-slate-500 dark:text-slate-400">
                        {snippet.before}
                        <span className="text-(--tone)">{snippet.match}</span>
                        {snippet.after}……
                      </p>
                    )}
                  </div>

                  <div className="flex shrink-0 items-center gap-4">
                    <span className="hidden md:contents">
                      <SongPlayActions song={song} />
                    </span>
                    <Link
                      href={`/song/${song.id}`}
                      onClick={() => {
                        onNavigate(song.id);
                        bumpNavDepth();
                      }}
                      className={PRIMARY_BUTTON_CLASS}
                    >
                      {t("open")}
                    </Link>
                  </div>
                </motion.div>
              </AnimatePresence>

              {pinned && (
                <button
                  type="button"
                  onClick={onClose}
                  aria-label={t("close")}
                  className="shrink-0 p-2 -mr-2 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-200/50 dark:hover:text-slate-200 dark:hover:bg-slate-800 transition-colors"
                >
                  <X size={18} />
                </button>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
