"use client";

import { Link } from "@/i18n/navigation";
import type { SongImageryMark } from "@/lib/types";
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

const EASE = [0.23, 1, 0.32, 1] as const;

/**
 * 聚焦某个意象时，从顶栏下沿展开的一条书眉：意象名、分类、本曲与全库的数目。
 * 放在顶栏里而不是浮在底部，免得与右下角按钮、播放条和底部抽屉挤在一起。
 */
export default function ImageryCaption({
  mark,
  lineCount,
  onClose,
}: ImageryCaptionProps) {
  const t = useTranslations("song.folio");

  useEffect(() => {
    if (!mark) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mark, onClose]);

  return (
    <AnimatePresence initial={false}>
      {mark && (
        <motion.div
          key="caption"
          role="status"
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.35, ease: EASE }}
          className="overflow-hidden"
        >
          <div className="border-t border-slate-200/50 dark:border-slate-800/50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-4">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={mark.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.2 }}
                  className="flex min-w-0 flex-1 items-center gap-4"
                >
                  <span
                    aria-hidden
                    className="w-0.5 self-stretch rounded-full"
                    style={{ backgroundColor: mark.accent }}
                  />
                  <span
                    className="shrink-0 font-calligraphy text-3xl leading-none"
                    style={{ color: mark.accent }}
                  >
                    {mark.name}
                  </span>
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="font-serif text-xs tracking-[0.2em] text-slate-500 dark:text-slate-400">
                      {mark.path.join(" · ")}
                    </p>
                    <p className="font-kaiti text-sm text-slate-600 dark:text-slate-300">
                      {t("caption.lines", { count: lineCount })}
                      <span className="mx-2 text-slate-300 dark:text-slate-600">
                        ·
                      </span>
                      {t("caption.songs", { count: mark.songCount })}
                      <Link
                        href={`/imagery?w=${mark.id}`}
                        className="ml-3 inline-flex items-center gap-0.5 whitespace-nowrap font-sans text-xs tracking-wider text-(--tone) hover:underline underline-offset-4"
                      >
                        {t("caption.explore")}
                        <ArrowUpRight size={12} />
                      </Link>
                    </p>
                  </div>
                </motion.div>
              </AnimatePresence>
              <button
                type="button"
                onClick={onClose}
                aria-label={t("caption.close")}
                className="shrink-0 p-2 -mr-2 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-200/50 dark:hover:text-slate-200 dark:hover:bg-slate-800 transition-colors"
              >
                <X size={18} />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
