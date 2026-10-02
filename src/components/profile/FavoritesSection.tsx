"use client";

import ProfileSectionHeading from "@/components/profile/ProfileSectionHeading";
import { bumpNavDepth, formatDate } from "@/components/profile/profile-ui";
import SongPlayActions from "@/components/shared/SongPlayActions";
import { TEXT_BUTTON_CLASS } from "@/components/shared/text-button";
import { useFavorites } from "@/context/FavoritesContext";
import { useTwoStepConfirm } from "@/hooks/ui";
import { Link } from "@/i18n/navigation";
import type { Song } from "@/lib/types";
import { cn } from "@/lib/utils/utils";
import { getCoverUrl } from "@/lib/utils/utils-song";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import Image from "next/image";

/** 我的收藏：一首一行，缩略图、题名与几个文字操作 */
export default function FavoritesSection() {
  const t = useTranslations("profile");
  const { favoriteSongs, clearFavorites, loaded } = useFavorites();
  const clear = useTwoStepConfirm();

  const heading = (
    <ProfileSectionHeading label={t("tabs.favorites")}>
      {loaded && favoriteSongs.length > 0 && (
        <button
          type="button"
          onClick={() => {
            if (clear.request()) void clearFavorites();
          }}
          className={cn(
            TEXT_BUTTON_CLASS,
            clear.confirming &&
              "text-rose-500 dark:text-rose-400 hover:text-rose-600",
          )}
        >
          {clear.confirming
            ? t("favorites.confirmClear")
            : t("favorites.clearAll")}
        </button>
      )}
    </ProfileSectionHeading>
  );

  if (!loaded) {
    return (
      <section>
        {heading}
        <Loader2 size={20} className="mt-12 animate-spin text-slate-400" />
      </section>
    );
  }

  if (favoriteSongs.length === 0) {
    return (
      <section>
        {heading}
        <p className="mt-12 font-kaiti text-[15px] text-slate-400 dark:text-slate-500">
          {t("favorites.empty")}
        </p>
      </section>
    );
  }

  return (
    <section>
      {heading}
      <p className="mt-8 lg:mt-12 text-xs tracking-[0.2em] text-slate-400 dark:text-slate-500">
        {t("favorites.summary", { count: favoriteSongs.length })}
      </p>
      <ul className="mt-8 space-y-7">
        {favoriteSongs.map((song) => (
          <FavoriteRow key={song.id} song={song} />
        ))}
      </ul>
    </section>
  );
}

function FavoriteRow({ song }: { song: Song }) {
  const t = useTranslations("profile.favorites");
  const { toggleFavorite } = useFavorites();
  const artist = song.artist?.join(" / ");
  const savedAt = song.collectionInfo?.created_at;

  return (
    <li className="group flex items-center gap-4 sm:gap-5">
      <Link
        href={`/song/${song.id}`}
        onClick={bumpNavDepth}
        tabIndex={-1}
        aria-hidden
        className="shrink-0 size-14 overflow-hidden rounded-md bg-slate-100 dark:bg-slate-800 ring-1 ring-slate-900/5 dark:ring-white/10"
      >
        <Image
          src={getCoverUrl(song)}
          alt=""
          width={56}
          height={56}
          className="w-full h-full object-cover grayscale-35 transition duration-700 group-hover:grayscale-0 group-hover:scale-[1.04]"
        />
      </Link>

      <div className="min-w-0 flex-1 sm:flex sm:items-center sm:gap-6">
        <div className="min-w-0 flex-1">
          <Link
            href={`/song/${song.id}`}
            onClick={bumpNavDepth}
            className="block font-serif text-base text-slate-900 dark:text-slate-100 truncate hover:text-(--tone) transition-colors"
          >
            {song.title}
          </Link>
          <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500 truncate">
            {[artist, savedAt && t("savedAt", { date: formatDate(savedAt) })]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>

        <div className="mt-1.5 sm:mt-0 flex items-center gap-4 shrink-0">
          <SongPlayActions song={song} />
          <button
            type="button"
            onClick={() => toggleFavorite(song.id)}
            className={cn(
              TEXT_BUTTON_CLASS,
              "hover:text-rose-500 dark:hover:text-rose-400",
            )}
          >
            {t("unfavorite")}
          </button>
        </div>
      </div>
    </li>
  );
}
