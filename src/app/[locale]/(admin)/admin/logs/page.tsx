import type { Metadata } from "next";
import AdminPanelClient from "@/components/admin/AdminPanelClient";
import { requireAdminPage } from "@/lib/server/admin-page";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "日志 - 河图作品勘鉴",
  description: "数据库审计记录，仅供查阅",
};

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function LogsAdminPage({ params }: Props) {
  const { locale } = await params;
  await requireAdminPage(locale, "/admin/logs", { superOnly: true });
  return <AdminPanelClient section="logs" />;
}
