import { redirect } from "next/navigation";
import type { Metadata } from "next";
import AdminPanelClient from "@/components/admin/AdminPanelClient";
import { getAdminPageSession } from "@/lib/server/server-auth";
import { loginPathFor } from "@/lib/utils/safe-next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "反馈管理 - 河图作品勘鉴",
  description: "处理用户提交的纠错、申请等反馈",
};

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function RequestsAdminPage({ params }: Props) {
  const { locale } = await params;

  // 页面自身校验（getUser 会验签），不依赖 middleware 的 matcher
  const adminSession = await getAdminPageSession();
  if (!adminSession) {
    redirect(`/${locale}${loginPathFor("/admin/requests")}`);
  }

  return <AdminPanelClient section="requests" />;
}
