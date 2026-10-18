import type { Metadata } from "next";
import ImageryCategoriesClient from "@/components/admin/imagery-admin/ImageryCategoriesClient";
import { requireAdminPage } from "@/lib/server/admin-page";
import { getImageryCategories } from "@/lib/server/service-imagery";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "意象分类 - 河图作品勘鉴",
  description: "管理意象分类树",
};

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function ImageryCategoriesPage({ params }: Props) {
  const { locale } = await params;
  await requireAdminPage(locale, "/admin/imagery/categories");
  const categories = await getImageryCategories().catch(() => []);
  return <ImageryCategoriesClient initialCategories={categories} />;
}
