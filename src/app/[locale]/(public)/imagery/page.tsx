import ImageryClient from "@/components/imagery/ImageryClient";
import Loading from "@/components/shared/Loading";
import { getImageryCloud } from "@/lib/server/service-imagery-cloud";
import type { ImageryCloud } from "@/lib/types";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Metadata } from "next";
import { Suspense } from "react";
import { serializeJsonLd } from "@/lib/utils/utils-common";
import { SITE_URL } from "@/lib/constants";

type Props = {
  params: Promise<{ locale: string }>;
};

const EMPTY_CLOUD: ImageryCloud = {
  l1: [],
  groups: [],
  words: [],
  motifCount: 0,
};

async function loadCloud(locale: string): Promise<ImageryCloud> {
  try {
    return await getImageryCloud(locale);
  } catch (e) {
    console.error("[imagery] 加载意象词云失败", e);
    return EMPTY_CLOUD;
  }
}

function describe(
  t: Awaited<ReturnType<typeof getTranslations>>,
  cloud: ImageryCloud,
) {
  return t("imagery.description", {
    count: cloud.motifCount,
    categoryNames: cloud.groups
      .slice(0, 6)
      .map((g) => g.name)
      .join("、"),
  });
}

// 动态生成意象词云 SEO 元数据
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "common" });
  const description = describe(t, await loadCloud(locale));
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
          ? `${SITE_URL}/zh-TW/imagery`
          : `${SITE_URL}/zh-CN/imagery`,
      languages: {
        "zh-CN": `${SITE_URL}/zh-CN/imagery`,
        "zh-TW": `${SITE_URL}/zh-TW/imagery`,
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
  const cloud = await loadCloud(locale);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: `${t("imagery.title")} - ${t("site.name")}`,
    description: describe(t, cloud),
    url: `${SITE_URL}/zh-CN/imagery`,
    isPartOf: {
      "@type": "WebSite",
      name: t("site.name"),
      url: SITE_URL,
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
        <ImageryClient cloud={cloud} initialMotif={null} />
      </Suspense>
    </>
  );
}

// 全站 ISR 统一 6 小时
export const revalidate = 21600;
