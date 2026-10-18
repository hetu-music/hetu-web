import type { Metadata } from "next";
import SongWorkspace from "@/components/admin/song-admin/SongWorkspace";
import { requireAdminPage } from "@/lib/server/admin-page";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "新增歌曲 - 河图作品勘鉴",
};

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function NewSongPage({ params }: Props) {
  const { locale } = await params;
  await requireAdminPage(locale, "/admin/songs/new");
  return <SongWorkspace song={null} published={null} />;
}
