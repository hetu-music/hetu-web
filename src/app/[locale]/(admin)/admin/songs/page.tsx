import type { Metadata } from "next";
import SongListClient from "@/components/admin/song-admin/SongListClient";
import { TABLES } from "@/lib/db/supabase-server";
import { requireAdminPage } from "@/lib/server/admin-page";
import {
  getOccurrenceCountsBySong,
  getPublishStatuses,
} from "@/lib/server/service-admin";
import { getSongs } from "@/lib/server/service-songs";
import type { SongDetail } from "@/lib/types";
import { toSearchString } from "@/lib/utils/url-params";
import { toListSong } from "@/components/admin/song-admin/utils";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "歌曲 - 河图作品勘鉴",
  description: "管理全部歌曲",
};

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function SongsAdminPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const session = await requireAdminPage(locale, "/admin/songs");

  const loaded = (
    getSongs(TABLES.ADMIN, session.accessToken) as Promise<SongDetail[]>
  ).then(
    (songs) => ({ songs, error: null }),
    (e: unknown) => {
      console.error("Fetch songs error:", e);
      return {
        songs: [] as SongDetail[],
        error: e instanceof Error ? e.message : "Unknown error",
      };
    },
  );

  // 几路查询一起发出（发布状态要等暂存表，但它读正式表不用等）
  const [{ songs, error }, publishStatuses, occurrenceCounts] =
    await Promise.all([
      loaded,
      getPublishStatuses(loaded.then((r) => r.songs)),
      getOccurrenceCountsBySong(),
    ]);

  return (
    <SongListClient
      initialSongs={songs.map(toListSong)}
      initialError={error}
      publishStatuses={publishStatuses}
      occurrenceCounts={occurrenceCounts}
      initialSearch={toSearchString(await searchParams)}
    />
  );
}
