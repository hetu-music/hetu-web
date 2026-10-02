"use client";

import SectionHeading from "@/components/detail/SectionHeading";
import WorkCard from "@/components/shared/WorkCard";
import type { RelatedSong } from "@/lib/types";
import { useTranslations } from "next-intl";

/** 同有此意：按意象相似度推荐的作品 */
export default function RelatedWorks({ songs }: { songs: RelatedSong[] }) {
  const t = useTranslations("song.folio");
  if (songs.length === 0) return null;

  return (
    <section id="related" className="py-16 md:py-20">
      <SectionHeading label={t("sections.related")} />
      <ul className="mt-12 grid grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-10">
        {songs.map((song) => (
          <li key={song.id}>
            <WorkCard song={song}>
              {song.artist && song.artist.length > 0 && (
                <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500 truncate">
                  {song.artist.join(" / ")}
                </p>
              )}
              {song.shared.length > 0 && (
                <p className="mt-2 text-xs text-slate-400 dark:text-slate-500 truncate">
                  {t("shared")}
                  <span className="ml-2 font-kaiti text-sm text-slate-600 dark:text-slate-300">
                    {song.shared.join(" · ")}
                  </span>
                </p>
              )}
            </WorkCard>
          </li>
        ))}
      </ul>
    </section>
  );
}
