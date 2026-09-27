"use client";

import { Link } from "@/i18n/navigation";
import type { SongImageryMark } from "@/lib/types";
import { cn } from "@/lib/utils/utils";
import { usePlayerStore } from "@/store/player-store";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUpRight, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect } from "react";

interface ImageryCaptionProps {
  mark: SongImageryMark | null;
  /** 本曲写到该意象的句数 */
  lineCount: number;
  onClose: () => void;
}

/** 聚焦某个意象时浮在页面底部的说明条 */
export default function ImageryCaption({
  mark,
  lineCount,
  onClose,
}: ImageryCaptionProps) {
  const t = useTranslations("song.folio");
  const hasPlayer = usePlayerStore((s) => !!s.currentTrack);

  useEffect(() => {
    if (!mark) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mark, onClose]);

  return (
    <AnimatePresence>
      {mark && (
        <motion.div
          key="caption"
          role="status"
          initial={{ opacity: 0, y: 16, filter: "blur(4px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          exit={{ opacity: 0, y: 16, filter: "blur(4px)" }}
          transition={{ duration: 0.35, ease: [0.23, 1, 0.32, 1] }}
          className={cn(
            "fixed z-40 left-4 right-20 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 sm:w-md",
            hasPlayer ? "bottom-[112px]" : "bottom-8",
          )}
        >
          <div className="flex items-center gap-4 rounded-2xl border border-slate-200/70 dark:border-slate-700/60 bg-white/85 dark:bg-slate-900/85 backdrop-blur-xl shadow-[0_16px_40px_-12px_rgba(15,23,42,0.25)] px-5 py-4">
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={mark.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.2 }}
                className="font-calligraphy text-4xl leading-none shrink-0"
                style={{ color: mark.accent }}
              >
                {mark.name}
              </motion.span>
            </AnimatePresence>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-slate-400 dark:text-slate-500 truncate tracking-wide">
                {mark.path.join(" › ")}
              </p>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300 truncate">
                {t("caption.lines", { count: lineCount })}
                <span className="mx-1.5 text-slate-300 dark:text-slate-600">
                  ·
                </span>
                {t("caption.songs", { count: mark.songCount })}
              </p>
            </div>
            <Link
              href="/imagery"
              className="hidden sm:flex items-center gap-0.5 text-xs text-(--tone) whitespace-nowrap hover:underline underline-offset-4"
            >
              {t("caption.explore")}
              <ArrowUpRight size={13} />
            </Link>
            <button
              type="button"
              onClick={onClose}
              aria-label={t("caption.close")}
              className="p-1 -mr-1 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
