"use client";

import { Link } from "@/i18n/navigation";
import type { SongImageryMark } from "@/lib/types";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUpRight, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils/utils";
import { useEffect, useState } from "react";

interface ImageryCaptionProps {
  mark: SongImageryMark | null;
  /** 本曲写到该意象的句数 */
  lineCount: number;
  onClose: () => void;
}

/**
 * 聚焦某个意象时，从顶栏下沿展开的一条书眉：意象名、分类、本曲与全库的数目。
 * 放在顶栏里而不是浮在底部，免得与右下角按钮、播放条和底部抽屉挤在一起。
 *
 * 展开收起用 CSS 的 grid 0fr → 1fr，不用 framer 的 height: auto：framer 量高度前会记下滚动位置、
 * 量完滚回去，正好打断点题签时发起的平滑滚动（说明条一展开，页面就停在卷首不动）。
 */
export default function ImageryCaption({
  mark,
  lineCount,
  onClose,
}: ImageryCaptionProps) {
  const t = useTranslations("song.folio");
  const open = mark !== null;

  // 收起时 mark 立刻变成 null，书眉还在往上收；留着上一个意象，收完之前内容不消失
  const [shown, setShown] = useState({ mark, lineCount });
  if (mark && (mark !== shown.mark || lineCount !== shown.lineCount)) {
    setShown({ mark, lineCount });
  }
  // 每展开一次换一个 key，让里面的切换动画从头算：重新打开时直接显示新的意象，
  // 不先把收起前留着的那个淡出一遍
  const [openCount, setOpenCount] = useState(open ? 1 : 0);
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setOpenCount((n) => n + 1);
  }

  useEffect(() => {
    if (!mark) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mark, onClose]);

  const current = shown.mark;
  return (
    <div
      role="status"
      inert={!open}
      className={cn(
        "grid transition-[grid-template-rows,opacity] duration-350 ease-page",
        open ? "grid-rows-[1fr]" : "grid-rows-[0fr] opacity-0",
      )}
    >
      {current && (
        <div className="min-h-0 overflow-hidden">
          <div className="border-t border-slate-200/50 dark:border-slate-800/50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-4">
              <AnimatePresence key={openCount} mode="wait" initial={false}>
                <motion.div
                  key={current.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.2 }}
                  className="flex min-w-0 flex-1 items-center gap-4"
                >
                  <span
                    aria-hidden
                    className="w-0.5 self-stretch rounded-full"
                    style={{ backgroundColor: current.accent }}
                  />
                  <span
                    className="shrink-0 font-calligraphy text-3xl leading-none"
                    style={{ color: current.accent }}
                  >
                    {current.name}
                  </span>
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="font-serif text-xs tracking-[0.2em] text-slate-500 dark:text-slate-400">
                      {current.path.join(" · ")}
                    </p>
                    <p className="font-kaiti text-sm text-slate-600 dark:text-slate-300">
                      {t("caption.lines", { count: shown.lineCount })}
                      <span className="mx-2 text-slate-300 dark:text-slate-600">
                        ·
                      </span>
                      {t("caption.songs", { count: current.songCount })}
                      <Link
                        href={`/imagery/${current.motifId}?w=${current.id}`}
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
        </div>
      )}
    </div>
  );
}
