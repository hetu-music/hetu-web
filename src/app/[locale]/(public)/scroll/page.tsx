import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import NightScroll from "@/components/scroll/NightScroll";
import ErrorState from "@/components/shared/Error";
import { getLibraryImagery } from "@/lib/server/service-song-imagery";
import { getSongs } from "@/lib/server/service-songs";
import type { LibraryImagery, Song } from "@/lib/types";

type Props = {
  params: Promise<{ locale: string }>;
};

// 夜展长卷的原型：定下来之前不进搜索引擎
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "common" });
  return {
    title: { absolute: t("site.title") },
    robots: { index: false, follow: false },
  };
}

export default async function NightScrollPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  let songs: Song[] = [];
  let imagery: LibraryImagery = { bySong: {}, items: [] };
  try {
    [songs, imagery] = await Promise.all([
      getSongs(undefined, undefined, true, locale),
      getLibraryImagery(locale),
    ]);
  } catch (err) {
    return (
      <ErrorState error={err instanceof Error ? err : new Error("未知错误")} />
    );
  }
  return <NightScroll songs={songs} imagery={imagery} />;
}

export const revalidate = 7200;
