import QuizResultClient from "@/components/quiz/QuizResultClient";
import { redirect } from "@/i18n/navigation";
import { getQuizResult } from "@/lib/server/service-quiz";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Metadata } from "next";

type Props = {
  params: Promise<{ locale: string; slug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const t = await getTranslations({ locale, namespace: "quiz" });
  const tSite = await getTranslations({ locale, namespace: "common" });
  const result = await getQuizResult(slug, locale);
  const title = result ? `${result.persona.motto} · ${t("title")}` : t("title");
  const description = result
    ? t("resultMetaDescription", { motto: result.persona.motto })
    : undefined;

  return {
    title,
    description,
    // 结果页随作答千变万化，不进入索引；分享卡片仍可正常展示
    robots: { index: false, follow: true },
    openGraph: {
      title: `${title} - ${tSite("site.name")}`,
      description,
      type: "website",
      images: [{ url: "/icons/source.png" }],
    },
  };
}

export default async function QuizResultPage({ params }: Props) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const result = await getQuizResult(slug, locale);
  if (!result) {
    redirect({ href: "/quiz", locale });
    return null;
  }

  return <QuizResultClient result={result} />;
}
