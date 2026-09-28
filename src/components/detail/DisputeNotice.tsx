"use client";

import { TriangleAlert } from "lucide-react";
import { useTranslations } from "next-intl";

/** 资料存疑提示：放在详情页最上方，读者先看到争议再看署名 */
export default function DisputeNotice({ note }: { note: string }) {
  const t = useTranslations("song");

  return (
    <aside
      role="note"
      className="mb-10 md:mb-14 flex gap-3 rounded-lg border border-amber-300/70 bg-amber-50 px-4 py-3.5 md:px-5 md:py-4 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200"
    >
      <TriangleAlert size={18} className="mt-0.5 shrink-0" aria-hidden />
      <div className="min-w-0">
        <p className="text-sm font-semibold tracking-wide">
          {t("folio.dispute")}
        </p>
        <p className="mt-1 text-sm leading-relaxed whitespace-pre-line wrap-break-word text-amber-900/85 dark:text-amber-100/80">
          {note}
        </p>
      </div>
    </aside>
  );
}
