"use client";

import SectionHeading from "@/components/detail/SectionHeading";
import { cn } from "@/lib/utils/utils";
import type { NoteLine, Notes } from "@/lib/utils/utils-folio";
import { useTranslations } from "next-intl";
import { useState } from "react";

/** 超过这个字数默认折叠 */
const COLLAPSE_AT = 500;

function Lines({
  lines,
  className,
}: {
  lines: NoteLine[];
  className?: string;
}) {
  return (
    <div className={className}>
      {lines.map((line, i) => (
        <p
          key={i}
          className={cn(
            line.signature &&
              "text-right text-[0.85em] text-slate-400 dark:text-slate-500 mt-1",
          )}
        >
          {line.text}
        </p>
      ))}
    </div>
  );
}

/**
 * 创作手记：作者写在歌曲旁的话。排在正文之前，宽屏时题词落在左栏、
 * 与封面对齐，手记正文落在右栏、与歌词对齐。
 */
export default function CreatorNotes({ notes }: { notes: Notes }) {
  const t = useTranslations("song.folio");
  const collapsible = notes.length > COLLAPSE_AT;
  const [expanded, setExpanded] = useState(false);
  const collapsed = collapsible && !expanded;
  const hasBody = notes.paragraphs.length > 0;

  const epigraph = notes.epigraph && (
    <figure className="relative pl-6">
      <span
        aria-hidden
        className="absolute left-0 top-[0.35em] bottom-[0.35em] w-px bg-(--tone)/60"
      />
      <Lines
        lines={notes.epigraph}
        className="font-kaiti text-xl sm:text-2xl leading-[1.9] text-slate-800 dark:text-slate-100 text-balance"
      />
    </figure>
  );

  return (
    <section id="notes" className="py-16 md:py-20">
      <SectionHeading label={t("sections.notes")} />

      <div className="mt-12 grid gap-10 lg:grid-cols-[22rem_minmax(0,1fr)] lg:gap-x-16">
        {/* 左栏：题词；没有正文时题词直接占右栏 */}
        <div className="min-w-0">{hasBody && epigraph}</div>

        <div className="min-w-0 max-w-[40em]">
          {!hasBody && epigraph}
          {hasBody && (
            <>
              <div
                className={cn(
                  "relative font-serif text-[15px] sm:text-base leading-[2.05] text-slate-600 dark:text-slate-300 space-y-5",
                  collapsed && "max-h-[24rem] overflow-hidden",
                )}
              >
                {notes.paragraphs.map((lines, i) => (
                  <Lines key={i} lines={lines} />
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
            </>
          )}
        </div>
      </div>
    </section>
  );
}
