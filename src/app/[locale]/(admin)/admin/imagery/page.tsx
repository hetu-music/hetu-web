import type { Metadata } from "next";
import MotifsClient from "@/components/admin/imagery-admin/MotifsClient";
import { requireAdminPage } from "@/lib/server/admin-page";
import { getImageryCategories } from "@/lib/server/service-imagery";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "意象 - 河图作品勘鉴",
  description: "管理意象母题与词的登记",
};

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function ImageryAdminPage({ params }: Props) {
  const { locale } = await params;
  await requireAdminPage(locale, "/admin/imagery");
  const categories = await getImageryCategories().catch(() => []);
  return <MotifsClient initialCategories={categories} />;
}
