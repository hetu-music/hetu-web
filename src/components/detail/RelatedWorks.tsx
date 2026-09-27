"use client";

import SectionHeading from "@/components/detail/SectionHeading";
import { Link } from "@/i18n/navigation";
import type { RelatedSong } from "@/lib/types";
import { getCoverUrl } from "@/lib/utils/utils-song";
import { useTranslations } from "next-intl";
import Image from "next/image";

/** 同有此意：按意象相似度推荐的作品 */
export default function RelatedWorks({ songs }: { songs: RelatedSong[] }) {
  const t = useTranslations("song.folio");
  if (songs.length === 0) return null;

  // 与主页一致：站内跳转前递增导航深度，详情页的返回键才会走 router.back()
  const bumpNavDepth = () => {
    const d = parseInt(
      sessionStorage.getItem("__hetu_web_nav_depth") || "0",
      10,
    );
    sessionStorage.setItem("__hetu_web_nav_depth", String(d + 1));
  };

  return (
    <section id="related" className="py-16 md:py-20">
      <SectionHeading label={t("sections.related")} />
      <ul className="mt-12 grid grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-10">
        {songs.map((song) => (
          <li key={song.id}>
            <Link
              href={`/song/${song.id}`}
              onClick={bumpNavDepth}
              className="group block"
            >
              <div className="aspect-square overflow-hidden rounded-md bg-slate-100 dark:bg-slate-800 ring-1 ring-slate-900/5 dark:ring-white/10">
                <Image
                  src={getCoverUrl(song)}
                  alt={song.title}
                  width={300}
                  height={300}
                  className="w-full h-full object-cover grayscale-[35%] transition duration-700 group-hover:grayscale-0 group-hover:scale-[1.04]"
                />
              </div>
              <p className="mt-4 font-serif text-base text-slate-900 dark:text-slate-100 truncate group-hover:text-(--tone) transition-colors">
                {song.title}
              </p>
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
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
