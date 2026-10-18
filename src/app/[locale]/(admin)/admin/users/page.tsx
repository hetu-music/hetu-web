import type { Metadata } from "next";
import AdminPanelClient from "@/components/admin/AdminPanelClient";
import { requireAdminPage } from "@/lib/server/admin-page";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "用户 - 河图作品勘鉴",
  description: "管理所有注册用户的资料与权限",
};

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function UsersAdminPage({ params }: Props) {
  const { locale } = await params;
  await requireAdminPage(locale, "/admin/users", { superOnly: true });
  return <AdminPanelClient section="users" />;
}
