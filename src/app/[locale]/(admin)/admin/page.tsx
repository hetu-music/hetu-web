import type { Metadata } from "next";
import AdminOverviewClient from "@/components/admin/AdminOverviewClient";
import { isSuperRole, roleOf } from "@/lib/auth/roles";
import { TABLES } from "@/lib/db/supabase-server";
import { isPendingPublish } from "@/lib/utils/utils-song-diff";
import { isPoolEligible, MIN_OCCURRENCES } from "@/lib/quiz/pool";
import { requireAdminPage } from "@/lib/server/admin-page";
import {
  getOccurrenceCountsBySong,
  getPendingRequestCount,
  getPublishStatuses,
} from "@/lib/server/service-admin";
import { getSongs } from "@/lib/server/service-songs";
import type { SongDetail } from "@/lib/types";
import {
  MISSING_GROUPS,
  PLATFORM_LINKS,
} from "@/components/admin/song-admin/types";
import {
  getMissingGroups,
  getMissingLinks,
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
  const isSuper = isSuperRole(roleOf(session.user.app_metadata));

  // 几路查询互不依赖，一起发出
  const songsPromise = getSongs(
    TABLES.WORKING_SONGS,
    session.accessToken,
  ).catch((e) => {
    console.error("Fetch songs error:", e);
    return [];
  }) as Promise<SongDetail[]>;
  const [songs, statuses, occurrenceCounts, pendingRequests] =
    await Promise.all([
      songsPromise,
      getPublishStatuses(songsPromise),
      getOccurrenceCountsBySong(),
      getPendingRequestCount(isSuper),
    ]);

  const missingGroups = songs.map(getMissingGroups);
  const missingLinks = songs.map(getMissingLinks);

  return (
    <AdminOverviewClient
      counts={{
        songs: songs.length,
        pendingRequests,
        unpublished: songs.filter((s) =>
          isPendingPublish(statuses[s.id] ?? "unpublished"),
        ).length,
        incomplete: missingGroups.filter((g) => g.length > 0).length,
        missingByGroup: Object.fromEntries(
          MISSING_GROUPS.map((group) => [
            group.key,
            missingGroups.filter((g) => g.includes(group.key)).length,
          ]),
        ) as Record<(typeof MISSING_GROUPS)[number]["key"], number>,
        lacksScore: songs.filter(lacksScore).length,
        lacksLinks: missingLinks.filter((l) => l.length > 0).length,
        missingByPlatform: Object.fromEntries(
          PLATFORM_LINKS.map((platform) => [
            platform.key,
            missingLinks.filter((l) => l.includes(platform.key)).length,
          ]),
        ) as Record<(typeof PLATFORM_LINKS)[number]["key"], number>,
        lacksImagery: songs.filter(
          (s) =>
            isPoolEligible({
              title: s.title,
              type: s.type ?? null,
              date: s.date ?? null,
            }) && (occurrenceCounts[s.id] ?? 0) < MIN_OCCURRENCES,
        ).length,
      }}
    />
  );
}
