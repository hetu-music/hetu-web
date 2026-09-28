"use client";

import { cn } from "@/lib/utils/utils";
import { useTranslations } from "next-intl";

/** 曲库卡片上的「存疑」标记：资料有争议的歌照常展示，但不计入收录总数 */
export default function DisputedBadge({ className }: { className?: string }) {
  const t = useTranslations("song.labels");

  return (
    <span
      title={t("disputedHint")}
      className={cn(
        "shrink-0 rounded-sm bg-amber-100 px-1.5 py-0.5 text-[11px] leading-none font-medium text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
        className,
      )}
    >
      {t("disputed")}
    </span>
  );
}
