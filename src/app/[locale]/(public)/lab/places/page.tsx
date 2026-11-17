import QinglvClient from "@/components/lab/places/QinglvClient";
import type { Place } from "@/lib/places/types";
import { getPlaces } from "@/lib/server/service-places";
import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";

type Props = {
  params: Promise<{ locale: string }>;
};

export const metadata: Metadata = {
  title: "河图志 · 青绿金线原型",
  robots: { index: false, follow: false },
};

export default async function PlacesLabPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  let places: Place[] = [];
  try {
    places = await getPlaces(locale);
  } catch (e) {
    console.error("[lab/places] 加载河图志失败", e);
  }
  return <QinglvClient places={places} />;
}

export const revalidate = 21600;
