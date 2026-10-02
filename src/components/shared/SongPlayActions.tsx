"use client";

import { TEXT_BUTTON_CLASS } from "@/components/shared/text-button";
import { useUserContext } from "@/context/UserContext";
import type { Song } from "@/lib/types";
import { cn } from "@/lib/utils/utils";
import { getCoverUrl } from "@/lib/utils/utils-song";
import { usePlayerStore } from "@/store/player-store";
import { useTranslations } from "next-intl";

/** 播放与加入队列两个文字按钮：只有开通权益、且这首有音频时才出现 */
export default function SongPlayActions({
  song,
}: {
  song: Pick<Song, "id" | "title" | "artist" | "hascover" | "has_audio">;
}) {
  const t = useTranslations("song.actions");
  const { user, loaded } = useUserContext();
  const { currentTrack, isPlaying, queue, play, toggle, enqueue } =
    usePlayerStore();

  if (!loaded || !user?.hasBenefits || !song.has_audio) return null;

  const track = {
    songId: song.id,
    title: song.title,
    artist: song.artist?.join(" / "),
    coverUrl: getCoverUrl(song),
  };
  const isCurrent = currentTrack?.songId === song.id;
  const playing = isCurrent && isPlaying;
  const queued = queue.some((q) => q.songId === song.id);

  return (
    <>
      <button
        type="button"
        onClick={() => (isCurrent ? toggle() : play(track))}
        aria-pressed={playing}
        className={cn(
          TEXT_BUTTON_CLASS,
          playing && "text-(--tone) dark:text-(--tone)",
        )}
      >
        {playing ? t("pause") : t("play")}
      </button>
      <button
        type="button"
        onClick={() => enqueue(track)}
        disabled={queued}
        className={cn(TEXT_BUTTON_CLASS, queued && "disabled:opacity-100")}
      >
        {queued ? t("queued") : t("enqueue")}
      </button>
    </>
  );
}
