import QjtxStory from "@/components/story/qjtx/QjtxStory";
import { toStoryEvent } from "@/components/story/qjtx/story-data";
import { getQjtxTimeline } from "@/lib/server/service-story";
import { setRequestLocale } from "next-intl/server";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

/** 滚动叙事重构的打样：开场 → #27–#31。只在开发环境打开 */

type Props = {
  params: Promise<{ locale: string }>;
};

export const metadata: Metadata = {
  title: "倾尽天下 · 打样",
  robots: { index: false, follow: false },
};

const FIRST = 27;
const LAST = 31;

export default async function QjtxLabPage({ params }: Props) {
  if (process.env.NODE_ENV !== "development") notFound();
  const { locale } = await params;
  setRequestLocale(locale);

  const timeline = await getQjtxTimeline();
  const events = timeline
    .map(toStoryEvent)
    .filter((e) => e.id >= FIRST && e.id <= LAST);

  return <QjtxStory events={events} tuner />;
}
