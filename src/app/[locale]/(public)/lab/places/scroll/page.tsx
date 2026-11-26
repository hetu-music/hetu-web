import ScrollClient from "@/components/lab/places/ScrollClient";
import type { Place } from "@/lib/places/types";
import { getPlaces } from "@/lib/server/service-places";
import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";

type Props = {
  params: Promise<{ locale: string }>;
};

export const metadata: Metadata = {
  title: "河图志 · 溯洄横卷原型",
  robots: { index: false, follow: false },
};

export default async function PlacesScrollLabPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  let places: Place[] = [];
  try {
    places = await getPlaces(locale);
  } catch (e) {
    console.error("[lab/places/scroll] 加载河图志失败", e);
  }
  return <ScrollClient places={places} />;
}

export const revalidate = 21600;
