import ImageryClient from "@/components/imagery/ImageryClient";
import Loading from "@/components/shared/Loading";
import {
  getImageryCloud,
  getMotifDetail,
} from "@/lib/server/service-imagery-cloud";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { SITE_URL } from "@/lib/constants";

type Props = {
  params: Promise<{ locale: string; motif: string }>;
};

/** 描述里列几种写法 */
const DESCRIPTION_WORDS = 6;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, motif } = await params;
  const id = parseInt(motif, 10);
  if (isNaN(id)) return {};
  const detail = await getMotifDetail(id, locale).catch(() => null);
  if (!detail) return {};
  const t = await getTranslations({ locale, namespace: "common" });

  const title = `${detail.name} · ${t("imagery.title")}`;
  const description = t("imagery.motifDescription", {
    count: detail.songCount,
    name: detail.name,
    words: detail.words
      .slice(0, DESCRIPTION_WORDS)
      .map((w) => `「${w.name}」`)
      .join(""),
  });
  const path = `/imagery/${detail.id}`;
  return {
    title,
    description,
    alternates: {
      canonical: `${SITE_URL}/${locale === "zh-TW" ? "zh-TW" : "zh-CN"}${path}`,
      languages: {
        "zh-CN": `${SITE_URL}/zh-CN${path}`,
        "zh-TW": `${SITE_URL}/zh-TW${path}`,
      },
    },
    openGraph: {
      title: `${title} - ${t("site.name")}`,
      description,
      type: "website",
      images: [{ url: "/icons/source.png" }],
    },
  };
}

/** 一个母题的网址：打开的是整片词云，这个母题亮着、面板展开 */
export default async function MotifPage({ params }: Props) {
  const { locale, motif } = await params;
  setRequestLocale(locale);
  const id = parseInt(motif, 10);
  if (isNaN(id)) notFound();

  let cloud;
  let detail;
  try {
    [cloud, detail] = await Promise.all([
      getImageryCloud(locale),
      getMotifDetail(id, locale),
    ]);
  } catch (e) {
    console.error("[imagery/motif] 加载意象词云失败", e);
    notFound();
  }
  if (!detail) notFound();

  return (
    <Suspense fallback={<Loading />}>
      <ImageryClient cloud={cloud} initialMotif={detail} />
    </Suspense>
  );
}

export async function generateStaticParams() {
  return [];
}

// 全站 ISR 统一 6 小时
export const revalidate = 21600;
