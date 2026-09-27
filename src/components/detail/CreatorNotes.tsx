"use client";

import SectionHeading from "@/components/detail/SectionHeading";
import { cn } from "@/lib/utils/utils";
import type { Notes } from "@/lib/utils/utils-folio";
import { useTranslations } from "next-intl";
import { useState } from "react";

/** 超过这个字数默认折叠 */
const COLLAPSE_AT = 500;

/**
 * 创作手记：作者写在歌曲旁的话，排在正文之前，楷体，与歌词对齐。
 */
export default function CreatorNotes({ notes }: { notes: Notes }) {
  const t = useTranslations("song.folio");
  const collapsible = notes.length > COLLAPSE_AT;
  const [expanded, setExpanded] = useState(false);
  const collapsed = collapsible && !expanded;

  return (
    <section id="notes" className="py-16 md:py-20">
      <SectionHeading label={t("sections.notes")} />

      <div className="mt-12 lg:ml-[26rem] max-w-[40em]">
        <div
          className={cn(
            "relative font-kaiti text-base sm:text-[17px] leading-[2.05] text-slate-700 dark:text-slate-300 space-y-5",
            collapsed && "max-h-[24rem] overflow-hidden",
          )}
        >
          {notes.paragraphs.map((lines, i) => (
            <div key={i}>
              {lines.map((line, k) => (
                <p
                  key={k}
                  className={cn(
                    line.signature &&
                      "text-right text-[0.9em] text-slate-400 dark:text-slate-500 mt-1",
                  )}
                >
                  {line.text}
                </p>
              ))}
            </div>
          ))}
          {collapsed && (
            <div
              aria-hidden
              className="absolute inset-x-0 bottom-0 h-28 bg-linear-to-t from-[#FAFAFA] dark:from-[#0B0F19] to-transparent"
            />
          )}
        </div>
        {collapsible && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            className="mt-5 text-xs tracking-[0.3em] text-(--tone) hover:opacity-80 transition-opacity"
          >
            {expanded ? t("collapse") : t("expand")}
          </button>
        )}
      </div>
    </section>
  );
}
