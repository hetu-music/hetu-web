import RiverMapClient from "@/components/lab/map/RiverMapClient";
import { setRequestLocale } from "next-intl/server";
import type { Metadata } from "next";

type Props = {
  params: Promise<{ locale: string }>;
};

export const metadata: Metadata = {
  title: "水系图原型",
  robots: { index: false, follow: false },
};

export default async function RiverMapLabPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <RiverMapClient />;
}
