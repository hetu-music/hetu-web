import QuizClient from "@/components/quiz/QuizClient";
import {
  getQuizPoolSize,
  getQuizQuestions,
  getQuizResultGlyphs,
} from "@/lib/server/service-quiz";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Metadata } from "next";
import { SITE_URL } from "@/lib/constants";
import { getSongs } from "@/lib/server/service-songs";
import { countCatalogSongs } from "@/lib/utils/utils-song";

type Props = {
  params: Promise<{ locale: string }>;
};

/** SEO 描述里的曲库总数，与首页统计同一口径；候选池的真实大小不对外展示 */
async function getSongCount(locale: string): Promise<number> {
  return countCatalogSongs(await getSongs(undefined, undefined, true, locale));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "quiz" });
  const tSite = await getTranslations({ locale, namespace: "common" });
  const count = await getSongCount(locale);
  const title = t("title");
  const description = t("metaDescription", { count });

  return {
    title,
    description,
    // 内测期间不进入搜索引擎索引，正式上线时移除
    robots: { index: false, follow: true },
    alternates: {
      canonical: `${SITE_URL}/${locale}/quiz`,
      languages: {
        "zh-CN": `${SITE_URL}/zh-CN/quiz`,
        "zh-TW": `${SITE_URL}/zh-TW/quiz`,
      },
    },
    openGraph: {
      title: `${title} - ${tSite("site.name")}`,
      description,
      type: "website",
      images: [{ url: "/icons/source.png" }],
    },
  };
}

export default async function QuizPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const questions = getQuizQuestions(locale);
  const poolSize = await getQuizPoolSize();

  return (
    <QuizClient
      questions={questions}
      resultGlyphs={getQuizResultGlyphs(locale)}
      poolSize={poolSize}
    />
  );
}

export const revalidate = 7200;
