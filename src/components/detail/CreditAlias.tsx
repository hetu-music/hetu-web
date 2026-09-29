"use client";

import { cn } from "@/lib/utils/utils";
import { useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState } from "react";

/**
 * 版记里的别署：照录原署，下加细线；悬停、键盘聚焦或点按时注明是谁。
 *
 * 点按要靠自己的状态：iOS Safari 点按钮不会让它获得焦点，只靠 :focus 在手机上打不开，
 * 也等不到 blur，所以点别处收起要自己监听。
 */
export default function CreditAlias({
  name,
  mainName,
}: {
  name: string;
  mainName: string;
}) {
  const t = useTranslations("song");
  const [open, setOpen] = useState(false);
  const noteId = useId();
  const rootRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  return (
    <span ref={rootRef} className="group relative inline-block">
      <button
        type="button"
        aria-describedby={noteId}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        onBlur={() => setOpen(false)}
        onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
        className="cursor-help underline decoration-slate-300 dark:decoration-slate-600 decoration-1 underline-offset-[5px] transition-colors hover:decoration-(--tone) focus-visible:decoration-(--tone) focus-visible:outline-none"
      >
        {name}
      </button>
      <span
        id={noteId}
        role="tooltip"
        className={cn(
          "pointer-events-none absolute left-0 top-full z-10 mt-2 whitespace-nowrap rounded-md border border-slate-200/70 dark:border-slate-800 bg-[#FAFAFA] dark:bg-[#0B0F19] px-2.5 py-1 font-kaiti text-xs text-slate-600 dark:text-slate-400 shadow-[0_8px_20px_-8px_rgba(15,23,42,0.25)]",
          "opacity-0 -translate-y-0.5 transition duration-200 ease-[cubic-bezier(0.23,1,0.32,1)]",
          "group-hover:opacity-100 group-hover:translate-y-0 group-has-focus-visible:opacity-100 group-has-focus-visible:translate-y-0",
          open && "opacity-100 translate-y-0",
        )}
      >
        {t("folio.aliasOf", { name: mainName })}
      </span>
    </span>
  );
}
