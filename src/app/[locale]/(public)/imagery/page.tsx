import ImageryClient from "@/components/imagery/ImageryClient";
import Loading from "@/components/shared/Loading";
import {
  getImageryCategories,
  getImageryWithCounts,
} from "@/lib/server/service-imagery";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Metadata } from "next";
import { Suspense } from "react";
import { serializeJsonLd } from "@/lib/utils/utils-common";

type Props = {
  params: Promise<{ locale: string }>;
};

// 动态生成意象词云 SEO 元数据
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "common" });

  const [items, categories] = await Promise.all([
    getImageryWithCounts().catch(() => []),
    getImageryCategories().catch(() => []),
  ]);

  const count = items.length;
  const categoryNames = categories
    .slice(0, 6)
    .map((c) => c.name)
    .join("、");

  const description = t("imagery.description", {
    count,
    categoryNames,
  });
  const siteName = t("site.name");

  return {
    title: t("imagery.title"),
    description,
    keywords: [
      "河图",
      "音乐",
      "歌词",
      "意象",
      "词云",
      "诗意",
      "国风",
      "中国风",
      "古风",
      "歌曲鉴赏",
      "文学性",
    ],
    alternates: {
      canonical:
        locale === "zh-TW"
          ? "https://hetu-music.com/zh-TW/imagery"
          : "https://hetu-music.com/zh-CN/imagery",
      languages: {
        "zh-CN": "https://hetu-music.com/zh-CN/imagery",
        "zh-TW": "https://hetu-music.com/zh-TW/imagery",
      },
    },
    openGraph: {
      title: `${t("imagery.title")} - ${siteName}`,
      description,
      type: "website",
      images: [{ url: "/icons/source.png" }],
    },
    twitter: {
      card: "summary_large_image",
      title: `${t("imagery.title")} - ${siteName}`,
      description,
      images: ["/icons/source.png"],
    },
  };
}

export default async function ImageryPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "common" });

  const [items, categories] = await Promise.all([
    getImageryWithCounts().catch(() => []),
    getImageryCategories().catch(() => []),
  ]);

  const count = items.length;
  const categoryNames = categories
    .slice(0, 6)
    .map((c) => c.name)
    .join("、");
  const description = t("imagery.description", {
    count,
    categoryNames,
  });

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: `${t("imagery.title")} - ${t("site.name")}`,
    description: description,
    url: "https://hetu-music.com/zh-CN/imagery",
    isPartOf: {
      "@type": "WebSite",
      name: t("site.name"),
      url: "https://hetu-music.com",
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
        suppressHydrationWarning
      />
      <Suspense fallback={<Loading />}>
        <ImageryClient items={items} categories={categories} />
      </Suspense>
    </>
  );
}

export const revalidate = 7200;
