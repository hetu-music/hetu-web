"use client";

import { cn } from "@/lib/utils/utils";
import { useTranslations } from "next-intl";

/** 页脚的落款：站名加年份，等宽小字，像书末版权页的一行 */
export default function SiteMark({ className }: { className?: string }) {
  const tSite = useTranslations("common.site");

  return (
    <p
      className={cn(
        "font-mono text-xs tracking-[0.2em] text-slate-400 dark:text-slate-500",
        className,
      )}
    >
      {tSite("name")}
      <span aria-hidden className="mx-3 text-slate-300 dark:text-slate-600">
        ·
      </span>
      © {new Date().getFullYear()}
    </p>
  );
}
