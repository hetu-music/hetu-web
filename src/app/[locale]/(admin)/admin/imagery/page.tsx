import { redirect } from "next/navigation";
import { getAdminPageSession } from "@/lib/server/server-auth";
import { getImageryCategories } from "@/lib/server/service-imagery";
import ImageryAdminClient from "@/components/admin/ImageryAdminClient";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "意象管理 - 河图作品勘鉴",
  description: "管理意象库与分类",
};

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function ImageryAdminPage({ params }: Props) {
  const { locale } = await params;

  // 页面自身校验（getUser 会验签），不依赖 middleware 的 matcher
  const adminSession = await getAdminPageSession();
  if (!adminSession) {
    redirect(`/${locale}/login`);
  }

  const categories = await getImageryCategories().catch(() => []);
  return <ImageryAdminClient initialCategories={categories} />;
}
