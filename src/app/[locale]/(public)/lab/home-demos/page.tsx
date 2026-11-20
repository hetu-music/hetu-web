import HomeDemosClient from "@/components/lab/home-demos/HomeDemosClient";
import { routing } from "@/i18n/routing";
import { getAuthGallery } from "@/lib/server/service-auth-gallery";
import { getSongs } from "@/lib/server/service-songs";
import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

type Props = {
  params: Promise<{ locale: string }>;
};

export const metadata: Metadata = {
  title: "首页改版方案对比（A / B / C）",
  robots: { index: false, follow: false },
};

export default async function HomeDemosLabPage({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const [songs, gallery] = await Promise.all([
    getSongs(undefined, undefined, true, locale).catch(() => []),
    getAuthGallery(locale).catch(() => []),
  ]);

  return <HomeDemosClient songs={songs} gallery={gallery} />;
}

export const revalidate = 21600;
