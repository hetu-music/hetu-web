"use client";

import { INK_TONE } from "@/lib/utils/utils-tone";
import { useTranslations } from "next-intl";
import React from "react";

/**
 * 整页加载屏：一行小字、一道细线，线上一段强调色来回划过；底部一句楷体题记
 * （同首页卷首那句，句末同样接「……」）。
 * 延迟 300ms 才淡入，切换很快时不会一闪而过。
 */
export default function Loading() {
  const t = useTranslations("common");
  const tHero = useTranslations("library.hero");

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#FAFAFA] dark:bg-[#0B0F19] [--tone:var(--tone-light)] dark:[--tone:var(--tone-dark)] animate-in fade-in duration-700 delay-300 fill-mode-both"
      style={
        {
          "--tone-light": INK_TONE.light,
          "--tone-dark": INK_TONE.dark,
        } as React.CSSProperties
      }
    >
      <p className="font-serif text-sm tracking-[0.4em] text-slate-500 dark:text-slate-400">
        {t("nav.loading")}
      </p>
      <span
        aria-hidden
        className="relative mt-5 block h-px w-32 overflow-hidden bg-slate-200 dark:bg-slate-800"
      >
        <span className="folio-sweep-anim motion-reduce:animate-none absolute inset-y-0 left-0 w-1/3 bg-(--tone) opacity-70" />
      </span>

      <p
        aria-hidden
        className="absolute bottom-12 inset-x-6 text-center font-kaiti text-[15px] tracking-wider text-slate-400 dark:text-slate-500"
      >
        {tHero("defaultDesc")}……
      </p>
    </div>
  );
}
