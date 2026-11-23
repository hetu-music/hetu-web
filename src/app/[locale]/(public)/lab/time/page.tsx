import HomeTimeClient from "@/components/lab/home-time/HomeTimeClient";
import { routing } from "@/i18n/routing";
import { getSongs } from "@/lib/server/service-songs";
import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

type Props = {
  params: Promise<{ locale: string }>;
};

export const metadata: Metadata = {
  title: "首页原型：二十年的颜色",
  robots: { index: false, follow: false },
};

export default async function HomeTimeLabPage({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const songs = await getSongs(undefined, undefined, true, locale).catch(
    () => [],
  );

  return <HomeTimeClient songs={songs} />;
}

export const revalidate = 21600;
