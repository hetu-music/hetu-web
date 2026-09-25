import QuizClient from "@/components/quiz/QuizClient";
import { getQuizPoolSize, getQuizQuestions } from "@/lib/server/service-quiz";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Metadata } from "next";

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "quiz" });
  const tSite = await getTranslations({ locale, namespace: "common" });
  const count = await getQuizPoolSize();
  const title = t("title");
  const description = t("metaDescription", { count });

  return {
    title,
    description,
    alternates: {
      canonical: `https://hetu-music.com/${locale}/quiz`,
      languages: {
        "zh-CN": "https://hetu-music.com/zh-CN/quiz",
        "zh-TW": "https://hetu-music.com/zh-TW/quiz",
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

  return <QuizClient questions={questions} poolSize={poolSize} />;
}

export const revalidate = 7200;
