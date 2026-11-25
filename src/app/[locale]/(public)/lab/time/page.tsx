import type { FeatureData } from "@/components/lab/home-time/TimeScreen";
import HomeTimeClient from "@/components/lab/home-time/HomeTimeClient";
import { getImageryCloud } from "@/lib/server/service-imagery-cloud";
import { getQuizQuestions } from "@/lib/server/service-quiz";
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

  // 特展入口只拿各自内容的一小片：意象取作品最多的几个母题，寻曲取第一题
  const cloud = await getImageryCloud(locale).catch(() => null);
  const features: FeatureData = {
    motifs: (cloud?.groups ?? [])
      .flatMap((g) => g.motifs)
      .sort((a, b) => b.songCount - a.songCount)
      .slice(0, 12)
      .map((m) => ({
        id: m.id,
        name: m.name,
        palette: m.palette,
        songCount: m.songCount,
      })),
    motifCount: cloud?.motifCount ?? 0,
    question: getQuizQuestions(locale)[0] ?? null,
    questionCount: getQuizQuestions(locale).length,
  };

  return <HomeTimeClient songs={songs} features={features} />;
}

export const revalidate = 21600;
