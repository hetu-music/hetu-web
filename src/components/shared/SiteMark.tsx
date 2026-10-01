"use client";

import { cn } from "@/lib/utils/utils";
import { useTranslations } from "next-intl";

/**
 * 页脚的站标：缩小的「河图 | 作品勘鉴」加年份，像书末版权页的一行落款。
 * 竖线与顶栏站名一样固定用蓝色，是站标的一部分。
 */
export default function SiteMark({ className }: { className?: string }) {
  const tLogo = useTranslations("common.site.logo");

  return (
    <p
      className={cn(
        "inline-flex items-center font-serif text-xs tracking-[0.3em] text-slate-400 dark:text-slate-500",
        className,
      )}
    >
      {tLogo("part1")}
      <span
        aria-hidden
        className="mx-1.5 h-3 w-px rounded-full bg-blue-600/70"
      />
      {tLogo("part2")}
      <span aria-hidden className="mx-3 text-slate-300 dark:text-slate-600">
        ·
      </span>
      <span className="tracking-[0.15em]">© {new Date().getFullYear()}</span>
    </p>
  );
}
