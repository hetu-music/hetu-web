"use client";

import SectionHeading from "@/components/detail/SectionHeading";
import { countThreads, SONG_SLOT } from "@/lib/utils/utils-comments";
import { useTranslations } from "next-intl";
import { useComments } from "./CommentsContext";
import SlotPanel from "./SlotPanel";

/** 评点：对整首歌的总评；原句改动后找不回位置的批注也落在这里 */
export default function CommentsSection() {
  const t = useTranslations("song.folio");
  const { threads } = useComments();
  const total = [...threads.values()].reduce(
    (n, list) => n + countThreads(list),
    0,
  );
  const songCount = threads.get(SONG_SLOT.key)?.length ?? 0;

  return (
    <section id="comments" className="py-16 md:py-20">
      <SectionHeading label={t("sections.comments")} />
      <div className="mt-12 grid gap-10 lg:grid-cols-[22rem_minmax(0,1fr)] lg:gap-x-16">
        <div className="text-xs leading-relaxed tracking-wider text-slate-400 dark:text-slate-500 space-y-2">
          <p>{t("comments.intro")}</p>
          {total > 0 && <p>{t("comments.count", { count: total })}</p>}
        </div>
        <div className="min-w-0 max-w-[40em]">
          <SlotPanel slot={SONG_SLOT} composerFirst />
          {songCount === 0 && (
            <p className="mt-8 font-kaiti text-[15px] text-slate-400 dark:text-slate-500">
              {t("comments.empty")}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
