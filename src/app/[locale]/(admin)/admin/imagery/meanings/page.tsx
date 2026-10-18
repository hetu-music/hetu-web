import type { Metadata } from "next";
import ImageryMeaningsClient from "@/components/admin/imagery-admin/ImageryMeaningsClient";
import { requireAdminPage } from "@/lib/server/admin-page";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "意象含义 - 河图作品勘鉴",
  description: "管理全局含义库",
};

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function ImageryMeaningsPage({ params }: Props) {
  const { locale } = await params;
  await requireAdminPage(locale, "/admin/imagery/meanings");
  return <ImageryMeaningsClient />;
}
