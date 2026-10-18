import type { Metadata } from "next";
import { notFound } from "next/navigation";
import SongWorkspace from "@/components/admin/song-admin/SongWorkspace";
import { TABLES } from "@/lib/db/supabase-server";
import { requireAdminPage } from "@/lib/server/admin-page";
import { getPublishedSongRaw } from "@/lib/server/service-admin";
import { getSongById } from "@/lib/server/service-songs";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ locale: string; id: string }>;
};

export const metadata: Metadata = {
  title: "编辑歌曲 - 河图作品勘鉴",
};

export default async function SongWorkspacePage({ params }: Props) {
  const { locale, id: rawId } = await params;
  const id = Number(rawId);
  if (!Number.isInteger(id) || id <= 0) notFound();

  const session = await requireAdminPage(locale, `/admin/songs/${id}`);
  const [song, published] = await Promise.all([
    getSongById(id, TABLES.ADMIN, session.accessToken),
    getPublishedSongRaw(id),
  ]);
  if (!song) notFound();

  return <SongWorkspace song={song} published={published} />;
}
