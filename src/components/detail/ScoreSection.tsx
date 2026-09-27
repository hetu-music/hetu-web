"use client";

import CommentGutter from "@/components/detail/comments/CommentGutter";
import { useComments } from "@/components/detail/comments/CommentsContext";
import SectionHeading from "@/components/detail/SectionHeading";
import type { SongDetail } from "@/lib/types";
import { countThreads, SCORE_SLOT } from "@/lib/utils/utils-comments";
import { getNmnUrl } from "@/lib/utils/utils-song";
import { useTranslations } from "next-intl";
import Image from "next/image";
import { useRef, useState } from "react";

const SLOTS = [SCORE_SLOT];

/** 乐谱：批注挂在乐谱整体上，宽屏写在左栏，窄屏从题头打开 */
export default function ScoreSection({
  song,
  onOpen,
}: {
  song: SongDetail;
  onOpen: () => void;
}) {
  const t = useTranslations("song");
  const [failed, setFailed] = useState(false);
  const { threads, setOpenSlot, setSheetSlot } = useComments();
  const bodyRef = useRef<HTMLDivElement>(null);
  const count = countThreads(threads.get(SCORE_SLOT.key));

  return (
    <section id="score" className="py-16 md:py-20">
      <SectionHeading label={t("sections.score")}>
        <button
          type="button"
          onClick={() => setSheetSlot(SCORE_SLOT)}
          className="lg:hidden text-xs tracking-widest text-(--tone)"
        >
          {t("folio.comments.annotate")}
          {count > 0 && ` ${count}`}
        </button>
      </SectionHeading>
      <div ref={bodyRef} className="relative mt-12">
        <CommentGutter slots={SLOTS} containerRef={bodyRef} />
        <div
          data-comment-slot={SCORE_SLOT.key}
          className="group/score relative lg:ml-[26rem]"
        >
          <span className="absolute -left-12 top-0 hidden lg:block">
            <button
              type="button"
              onClick={() => setOpenSlot(SCORE_SLOT.key)}
              aria-label={t("folio.comments.annotateScore")}
              className="font-kaiti text-sm text-(--tone) opacity-0 group-hover/score:opacity-60 hover:opacity-100! focus-visible:opacity-100 transition-opacity"
            >
              {t("folio.comments.add")}
            </button>
          </span>
          {failed ? (
            <p className="py-16 text-center text-sm text-slate-400">
              {t("scoreLoadError")}
            </p>
          ) : (
            <button
              type="button"
              onClick={onOpen}
              className="group relative block w-full max-h-[28rem] overflow-hidden rounded-md bg-white ring-1 ring-slate-900/5 dark:ring-white/10"
            >
              <Image
                src={getNmnUrl(song)}
                alt="Score"
                width={800}
                height={600}
                className="w-full h-auto dark:opacity-90"
                onError={() => setFailed(true)}
              />
              <span className="absolute inset-x-0 bottom-0 h-32 bg-linear-to-t from-white via-white/80 to-transparent flex items-end justify-center pb-5">
                <span className="text-xs tracking-[0.3em] text-slate-500 group-hover:text-slate-900 transition-colors">
                  {t("zoomScore")}
                </span>
              </span>
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
