import type { Metadata } from "next";
import AdminPanelClient from "@/components/admin/AdminPanelClient";
import { requireAdminPage } from "@/lib/server/admin-page";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "署名 - 河图作品勘鉴",
  description: "登记同一个人在不同作品里的不同署名",
};

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function CreditsAdminPage({ params }: Props) {
  const { locale } = await params;
  await requireAdminPage(locale, "/admin/credits");
  return <AdminPanelClient section="credits" />;
}
