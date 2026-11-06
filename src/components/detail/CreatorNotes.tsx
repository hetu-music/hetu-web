"use client";

import AnnotateHandle from "@/components/detail/comments/AnnotateHandle";
import CommentGutter from "@/components/detail/comments/CommentGutter";
import { useComments } from "@/components/detail/comments/CommentsContext";
import SlotMarker from "@/components/detail/comments/SlotMarker";
import SectionHeading from "@/components/detail/SectionHeading";
import { cn } from "@/lib/utils/utils";
import { notesSlot } from "@/lib/utils/utils-comments";
import type { Notes } from "@/lib/utils/utils-folio";
import { useTranslations } from "next-intl";
import { useMemo, useRef, useState } from "react";

/** 超过这个字数默认折叠 */
const COLLAPSE_AT = 500;

/**
 * 创作手记：作者写在歌曲旁的话，排在正文之前，楷体，与歌词对齐。
 * 批注以段为单位：宽屏写在左栏，窄屏点段落后在段下展开操作栏。
 */
export default function CreatorNotes({ notes }: { notes: Notes }) {
  const t = useTranslations("song.folio");
  const collapsible = notes.length > COLLAPSE_AT;
  const [expanded, setExpanded] = useState(false);
  const collapsed = collapsible && !expanded;
  const [selected, setSelected] = useState<number | null>(null);
  const { wide, annotate } = useComments();
  const bodyRef = useRef<HTMLDivElement>(null);

  const slots = useMemo(
    () => notes.paragraphs.map((_, i) => notesSlot(i)),
    [notes.paragraphs],
  );

  return (
    <section id="notes" className="py-16 md:py-20">
      <SectionHeading label={t("sections.notes")} />

      <div ref={bodyRef} className="relative mt-12">
        <CommentGutter slots={slots} containerRef={bodyRef} />
        <div className="lg:ml-[26rem] max-w-[40em]">
          <div
            data-comment-clip={collapsed ? "" : undefined}
            className={cn(
              "relative font-kaiti text-base sm:text-[17px] leading-[2.05] text-slate-700 dark:text-slate-300 space-y-5",
              // 只在纵向裁切，好让左侧浮出的「批」不被剪掉
              collapsed && "max-h-[24rem] overflow-y-clip",
            )}
          >
            {notes.paragraphs.map((lines, i) => (
              <div
                key={i}
                data-comment-slot={slots[i].key}
                onClick={() =>
                  !wide && setSelected((prev) => (prev === i ? null : i))
                }
                className="group/slot relative max-lg:cursor-pointer"
              >
                <AnnotateHandle
                  slot={slots[i]}
                  label={t("comments.annotateParagraph")}
                  className="h-[2.05em]"
                />
                {lines.map((line, k) => (
                  <p
                    key={k}
                    className={cn(
                      line.signature &&
                        "text-right text-[0.9em] text-slate-400 dark:text-slate-500 mt-1",
                    )}
                  >
                    {line.text}
                    {k === lines.length - 1 && <SlotMarker slot={slots[i]} />}
                  </p>
                ))}
                {selected === i && (
                  <div className="lg:hidden mt-1 font-sans text-xs tracking-widest text-(--tone)">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        annotate(slots[i]);
                      }}
                    >
                      {t("comments.annotateParagraph")}
                    </button>
                  </div>
                )}
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
      </div>
    </section>
  );
}
