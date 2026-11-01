import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import ProfileClient from "@/components/profile/ProfileClient";
import { isProfileTab } from "@/components/profile/profile-ui";
import { getPageUser } from "@/lib/server/server-auth";
import { loginPathFor } from "@/lib/utils/safe-next";
import { toSearchString } from "@/lib/utils/url-params";

export const dynamic = "force-dynamic";

/** 这几项原先是个人中心的标签页，已移到后台；旧链接转过去 */
const MOVED_TO_ADMIN = new Set(["requests", "users", "logs"]);

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "profile" });
  return { title: t("title"), robots: { index: false, follow: false } };
}

export default async function ProfilePage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const query = await searchParams;
  const { tab } = query;
  const tabValue = typeof tab === "string" ? tab : undefined;
  if (tabValue && MOVED_TO_ADMIN.has(tabValue)) {
    redirect(`/${locale}/admin/${tabValue}`);
  }

  // 页面自身校验登录；登录后回到原来的标签页
  const user = await getPageUser();
  if (!user) {
    const back =
      tabValue && isProfileTab(tabValue)
        ? `/profile?tab=${tabValue}`
        : "/profile";
    redirect(`/${locale}${loginPathFor(back)}`);
  }

  return <ProfileClient initialSearch={toSearchString(query)} />;
}
