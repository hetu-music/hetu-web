import type { Metadata } from "next";
import AdminPanelClient from "@/components/admin/AdminPanelClient";
import { requireAdminPage } from "@/lib/server/admin-page";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "反馈 - 河图作品勘鉴",
  description: "处理用户提交的纠错、申请等反馈",
};

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ status?: string | string[] }>;
};

const STATUSES = ["pending", "replied", "approved", "rejected"];

export default async function RequestsAdminPage({
  params,
  searchParams,
}: Props) {
  const { locale } = await params;
  await requireAdminPage(locale, "/admin/requests");
  // 待办首页链过来时带 ?status=pending
  const { status } = await searchParams;
  const initialStatus =
    typeof status === "string" && STATUSES.includes(status) ? status : "all";
  return <AdminPanelClient section="requests" initialStatus={initialStatus} />;
}
