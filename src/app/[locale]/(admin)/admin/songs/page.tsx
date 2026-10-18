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

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "歌曲 - 河图作品勘鉴",
  description: "管理全部歌曲",
};

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function SongsAdminPage({ params }: Props) {
  const { locale } = await params;
  const session = await requireAdminPage(locale, "/admin/songs");

  let songs: SongDetail[] = [];
  let error: string | null = null;
  try {
    songs = (await getSongs(TABLES.ADMIN, session.accessToken)) as SongDetail[];
  } catch (e) {
    error = e instanceof Error ? e.message : "Unknown error";
    console.error("Fetch songs error:", e);
  }

  const [publishStatuses, occurrenceCounts] = await Promise.all([
    getPublishStatuses(songs),
    getOccurrenceCountsBySong(),
  ]);

  return (
    <SongListClient
      initialSongs={songs}
      initialError={error}
      publishStatuses={publishStatuses}
      occurrenceCounts={occurrenceCounts}
    />
  );
}
