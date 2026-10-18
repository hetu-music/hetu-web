import type { Metadata } from "next";
import AudioAdminClient from "@/components/admin/AudioAdminClient";
import { requireAdminPage } from "@/lib/server/admin-page";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "音频 - 河图作品勘鉴",
  description: "管理歌曲与 Navidrome 曲目的关联",
};

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function AudioAdminPage({ params }: Props) {
  const { locale } = await params;
  await requireAdminPage(locale, "/admin/audio", { superOnly: true });
  return <AudioAdminClient />;
}
