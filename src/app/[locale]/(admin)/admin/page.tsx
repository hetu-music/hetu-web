import { redirect } from "next/navigation";
import AdminClientComponent from "@/components/admin/AdminClient";
import { getSongs } from "@/lib/server/service-songs";
import { TABLES } from "@/lib/db/supabase-server";
import { getAdminPageSession } from "@/lib/server/server-auth";
import type { Song } from "@/lib/types";

// 强制动态渲染，不在构建时预渲染
export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function AdminPage({ params }: Props) {
  const { locale } = await params;

  // 页面自身校验（getUser 会验签），不依赖 middleware 的 matcher
  const adminSession = await getAdminPageSession();
  if (!adminSession) {
    redirect(`/${locale}/login`);
  }

  let songs: Song[] = [];
  let error = null;
  try {
    songs = await getSongs(TABLES.ADMIN, adminSession.accessToken);
  } catch (e: unknown) {
    if (
      e &&
      typeof e === "object" &&
      "message" in e &&
      typeof (e as Error).message === "string"
    ) {
      error = (e as Error).message;
      console.error("Fetch songs error:", (e as Error).message);
    } else {
      error = "Unknown error";
      console.error("Fetch songs error:", e);
    }
  }

  return <AdminClientComponent initialSongs={songs} initialError={error} />;
}
