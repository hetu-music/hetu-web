import Loading from "@/components/shared/Loading";
import QjtxClient from "@/components/story/qjtx/QjtxClient";
import { getQjtxTimeline } from "@/lib/server/service-story";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Metadata } from "next";
import { Suspense } from "react";
import { serializeJsonLd } from "@/lib/utils/utils-common";

type Props = {
  params: Promise<{ locale: string }>;
};

function buildDescription(
  t: Awaited<ReturnType<typeof getTranslations>>,
  count: number,
  firstYear: string | undefined,
  secondLastYear: string | undefined,
) {
  const fy = firstYear || t("story.qjtx.fallbackFirstYear");
  const sly = secondLastYear || t("story.qjtx.fallbackSecondLastYear");
  return t("story.qjtx.description", {
    count,
    firstYear: fy,
    secondLastYear: sly,
  });
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "common" });

  const events = await getQjtxTimeline();
  const description = buildDescription(
    t,
    events.length,
    events[0]?.year,
    (events[events.length - 2] ?? events[events.length - 1])?.year,
  );

  const title = t("story.qjtx.title");
  const siteName = t("site.name");

  return {
    title,
    description,
    keywords: [
      "倾尽天下",
      "河图",
      "编年史",
      "白炎",
      "朱砂",
      "古风音乐",
      "音乐故事",
      "Chronicle",
      "Hetu",
      "Qing Jin Tian Xia",
    ],
    authors: [{ url: "https://hetu-music.com" }],
    creator: siteName,
    alternates: {
      canonical:
        locale === "zh-TW"
          ? "https://hetu-music.com/zh-TW/story/qjtx"
          : "https://hetu-music.com/zh-CN/story/qjtx",
      languages: {
        "zh-CN": "https://hetu-music.com/zh-CN/story/qjtx",
        "zh-TW": "https://hetu-music.com/zh-TW/story/qjtx",
      },
    },
    openGraph: {
      title: `${title} - ${siteName}`,
      description,
      type: "article",
      url: "https://hetu-music.com/zh-CN/story/qjtx",
      siteName: siteName,
      locale: locale.replace("-", "_"),
      images: [
        {
          url: "/story/qjtx/31.avif",
          width: 1200,
          height: 630,
          alt: `${title}封面`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} - ${siteName}`,
      description,
      images: ["/story/qjtx/31.avif"],
    },
  };
}

export default async function QingJinTianXiaPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "common" });

  const events = await getQjtxTimeline();
  const description = buildDescription(
    t,
    events.length,
    events[0]?.year,
    (events[events.length - 2] ?? events[events.length - 1])?.year,
  );

  const title = t("story.qjtx.title");
  const siteName = t("site.name");

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: title,
    description,
    image: "https://hetu-music.com/story/qjtx/31.avif",
    publisher: {
      "@type": "Organization",
      name: siteName,
      logo: {
        "@type": "ImageObject",
        url: "https://hetu-music.com/icons/icon-512x512.png",
      },
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": "https://hetu-music.com/zh-CN/story/qjtx",
    },
  };

  return (
    <>
      <link
        rel="prefetch"
        as="image"
        href="/story/qjtx/4.avif"
        type="image/avif"
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
        suppressHydrationWarning
      />
      <Suspense fallback={<Loading />}>
        <QjtxClient events={events} />
      </Suspense>
    </>
  );
}

export const revalidate = 7200;
