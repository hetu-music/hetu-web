"use client";

import { AnimatePresence, motion } from "framer-motion";
import { type LucideIcon, PlusSquare, Share, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect } from "react";

const EASE = [0.23, 1, 0.32, 1] as const;
const NUMERALS = ["一", "二", "三"];

interface IOSInstallPromptProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * iOS 不支持网页直接发起安装，只能教用户自己从浏览器菜单里添加。
 * 引号里的词照搬系统界面上的原词（简体系统叫「共享」，繁体叫「分享」），
 * 用户对着屏幕找得到；旁边的图标也照系统按钮的样子画。
 */
export default function IOSInstallPrompt({
  isOpen,
  onClose,
}: IOSInstallPromptProps) {
  const t = useTranslations("common.installGuide");
  const tNav = useTranslations("common.nav");

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  const steps: { text: string; hint?: string; icon?: LucideIcon }[] = [
    { text: t("step1"), hint: t("hint1"), icon: Share },
    { text: t("step2"), hint: t("hint2"), icon: PlusSquare },
    { text: t("step3") },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-60 bg-slate-950/30 backdrop-blur-[2px]"
          />
          <motion.div
            key="sheet"
            role="dialog"
            aria-modal="true"
            aria-label={t("title")}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ duration: 0.4, ease: EASE }}
            className="fixed inset-x-0 bottom-0 z-60 mx-auto max-w-md rounded-t-2xl bg-[#FAFAFA] dark:bg-[#0B0F19] shadow-[0_-20px_50px_-20px_rgba(15,23,42,0.35)] pb-[env(safe-area-inset-bottom)]"
          >
            <div className="flex items-center justify-between px-6 pt-5 pb-2">
              <p className="font-serif text-xs tracking-[0.4em] text-(--tone)">
                {t("title")}
              </p>
              <button
                type="button"
                onClick={onClose}
                aria-label={tNav("close")}
                className="p-1 -mr-1 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="px-6 pb-6">
              <p className="text-sm leading-relaxed text-slate-500 dark:text-slate-400">
                {t("intro")}
              </p>

              <ol className="mt-5 space-y-4">
                {steps.map(({ text, hint, icon: Icon }, i) => (
                  <li key={i} className="flex gap-4">
                    <span className="w-4 shrink-0 font-serif text-sm leading-6 text-(--tone)">
                      {NUMERALS[i]}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-2 text-sm leading-6 text-slate-800 dark:text-slate-200">
                        {text}
                        {Icon && (
                          <Icon
                            size={16}
                            aria-hidden
                            className="shrink-0 text-slate-400 dark:text-slate-500"
                          />
                        )}
                      </p>
                      {hint && (
                        <p className="mt-0.5 text-xs leading-5 text-slate-400 dark:text-slate-500">
                          {hint}
                        </p>
                      )}
                    </div>
                  </li>
                ))}
              </ol>

              <div className="mt-6 flex justify-end">
                <button
                  type="button"
                  onClick={onClose}
                  className="py-2 text-xs tracking-widest text-(--tone) transition-opacity hover:opacity-70"
                >
                  {t("done")}
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
