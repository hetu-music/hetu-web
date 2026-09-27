import { redirect } from "next/navigation";
import type { Metadata } from "next";
import AudioAdminClient from "@/components/admin/AudioAdminClient";
import { getAdminPageSession } from "@/lib/server/server-auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "音频管理 - 河图作品勘鉴",
  description: "管理歌曲与 Navidrome 曲目的关联",
};

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function AudioAdminPage({ params }: Props) {
  const { locale } = await params;

  // 页面自身校验（getUser 会验签），不依赖 middleware 的 matcher
  const adminSession = await getAdminPageSession();
  if (!adminSession) {
    redirect(`/${locale}/login`);
  }
  // 仅超级管理员可用；对应 API 同样以 requireSuperAdmin 校验
  if (adminSession.user.app_metadata?.is_super !== true) {
    redirect(`/${locale}/admin`);
  }

  return <AudioAdminClient />;
}
