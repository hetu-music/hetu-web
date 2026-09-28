import { redirect } from "next/navigation";
import type { Metadata } from "next";
import AdminPanelClient from "@/components/admin/AdminPanelClient";
import { getAdminPageSession } from "@/lib/server/server-auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "操作日志 - 河图作品勘鉴",
  description: "数据库审计记录，仅供查阅",
};

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function LogsAdminPage({ params }: Props) {
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

  return <AdminPanelClient section="logs" />;
}
