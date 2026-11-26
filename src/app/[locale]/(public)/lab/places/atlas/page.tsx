import AtlasClient from "@/components/lab/places/AtlasClient";
import type { Place } from "@/lib/places/types";
import { getPlaces } from "@/lib/server/service-places";
import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";

type Props = {
  params: Promise<{ locale: string }>;
};

export const metadata: Metadata = {
  title: "河图志 · 绢本舆图原型",
  robots: { index: false, follow: false },
};

export default async function PlacesAtlasLabPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  let places: Place[] = [];
  try {
    places = await getPlaces(locale);
  } catch (e) {
    console.error("[lab/places/atlas] 加载河图志失败", e);
  }
  return <AtlasClient places={places} />;
}

export const revalidate = 21600;
