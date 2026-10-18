import type { Metadata } from "next";
import AdminOverviewClient from "@/components/admin/AdminOverviewClient";
import { TABLES } from "@/lib/db/supabase-server";
import { isPoolEligible, MIN_OCCURRENCES } from "@/lib/quiz/pool";
import { requireAdminPage } from "@/lib/server/admin-page";
import {
  getOccurrenceCountsBySong,
  getPendingRequestCount,
  getPublishStatuses,
} from "@/lib/server/service-admin";
import { getSongs } from "@/lib/server/service-songs";
import type { SongDetail } from "@/lib/types";
import { MISSING_GROUPS } from "@/components/admin/song-admin/types";
import {
  getMissingGroups,
  lacksScore,
} from "@/components/admin/song-admin/utils";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "后台 - 河图作品勘鉴",
};

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function AdminOverviewPage({ params }: Props) {
  const { locale } = await params;
  const session = await requireAdminPage(locale, "/admin");
  const isSuper = session.user.app_metadata?.is_super === true;

  const songs = (await getSongs(TABLES.ADMIN, session.accessToken).catch(
    (e) => {
      console.error("Fetch songs error:", e);
      return [];
    },
  )) as SongDetail[];
  const [statuses, occurrenceCounts, pendingRequests] = await Promise.all([
    getPublishStatuses(songs),
    getOccurrenceCountsBySong(),
    getPendingRequestCount(isSuper),
  ]);

  const missingGroups = songs.map(getMissingGroups);

  return (
    <AdminOverviewClient
      counts={{
        songs: songs.length,
        pendingRequests,
        unpublished: songs.filter(
          (s) => (statuses[s.id] ?? "unpublished") !== "published",
        ).length,
        incomplete: missingGroups.filter((g) => g.length > 0).length,
        missingByGroup: Object.fromEntries(
          MISSING_GROUPS.map((group) => [
            group.key,
            missingGroups.filter((g) => g.includes(group.key)).length,
          ]),
        ) as Record<(typeof MISSING_GROUPS)[number]["key"], number>,
        lacksScore: songs.filter(lacksScore).length,
        lacksImagery: songs.filter(
          (s) =>
            isPoolEligible({ title: s.title, type: s.type ?? null }) &&
            (occurrenceCounts[s.id] ?? 0) < MIN_OCCURRENCES,
        ).length,
      }}
    />
  );
}
