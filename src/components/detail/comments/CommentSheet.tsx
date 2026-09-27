"use client";

import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { useComments } from "./CommentsContext";
import SlotPanel from "./SlotPanel";

/**
 * 窄屏的批注面板：从底部拉出，顶部引用所批的原文，
 * 下面是这一处的全部批注与输入框。
 */
export default function CommentSheet() {
  const t = useTranslations("song.folio.comments");
  const { sheetSlot: slot, setSheetSlot, anchorCtx } = useComments();

  useEffect(() => {
    if (!slot) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSheetSlot(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [slot, setSheetSlot]);

  const quote = !slot
    ? null
    : slot.section === "lyrics"
      ? anchorCtx.lines[slot.line]?.text
      : slot.section === "notes"
        ? anchorCtx.paragraphs[slot.paragraph]?.map((l) => l.text).join(" ")
        : null;

  return (
    <AnimatePresence>
      {slot && (
        <>
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSheetSlot(null)}
            className="fixed inset-0 z-60 bg-slate-950/30 backdrop-blur-[2px]"
          />
          <motion.div
            key="sheet"
            role="dialog"
            aria-modal
            aria-label={t(`slot.${slot.section}`)}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
            className="fixed inset-x-0 bottom-0 z-60 max-h-[78vh] flex flex-col rounded-t-2xl bg-[#FAFAFA] dark:bg-[#0B0F19] shadow-[0_-20px_50px_-20px_rgba(15,23,42,0.35)] pb-[env(safe-area-inset-bottom)]"
          >
            <div className="flex items-start gap-4 px-6 pt-5 pb-4 border-b border-slate-200/70 dark:border-slate-800/70">
              <div className="min-w-0 flex-1">
                <p className="font-serif text-xs tracking-[0.4em] text-(--tone)">
                  {t(`slot.${slot.section}`)}
                </p>
                {quote && (
                  <p className="mt-2 font-serif text-[15px] leading-relaxed text-slate-800 dark:text-slate-200 line-clamp-2">
                    {quote}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setSheetSlot(null)}
                aria-label={t("close")}
                className="p-1 -mr-1 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            <div className="overflow-y-auto overscroll-contain px-6 py-5">
              <SlotPanel slot={slot} />
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
