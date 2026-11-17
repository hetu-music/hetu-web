import PlacesClient from "@/components/places/PlacesClient";
import type { Place } from "@/lib/places/types";
import { getPlaces } from "@/lib/server/service-places";
import { localeAlternates } from "@/lib/utils/site-url";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

type Props = {
  params: Promise<{ locale: string }>;
};

async function loadPlaces(locale: string): Promise<Place[]> {
  try {
    return await getPlaces(locale);
  } catch (e) {
    console.error("[places] 加载河图志失败", e);
    return [];
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "places" });
  const places = await loadPlaces(locale);
  const songs = new Set(places.flatMap((p) => p.entries.map((e) => e.songId)));
  return {
    title: t("title"),
    description: t("description", {
      places: places.length,
      songs: songs.size,
    }),
    alternates: localeAlternates(locale, "/places"),
    // 上线前（合规确认、加进导航与 sitemap）不收录，见 docs/PLACES.md
    robots: { index: false, follow: false },
  };
}

export default async function PlacesPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <PlacesClient places={await loadPlaces(locale)} />;
}

// 全站 ISR 统一 6 小时
export const revalidate = 21600;
