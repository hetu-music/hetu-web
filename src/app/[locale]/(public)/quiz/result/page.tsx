import QuizResultClient from "@/components/quiz/QuizResultClient";
import { redirect } from "@/i18n/navigation";
import { getQuizResult } from "@/lib/server/service-quiz";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Metadata } from "next";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ a?: string | string[] }>;
};

function readCode(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export async function generateMetadata({
  params,
  searchParams,
}: Props): Promise<Metadata> {
  const { locale } = await params;
  const code = readCode((await searchParams).a);
  const t = await getTranslations({ locale, namespace: "quiz" });
  const tSite = await getTranslations({ locale, namespace: "common" });
  const result = await getQuizResult(code, locale);
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

export default async function QuizResultPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const code = readCode((await searchParams).a);
  const result = await getQuizResult(code, locale);
  if (!result) {
    redirect({ href: "/quiz", locale });
    return null;
  }

  return <QuizResultClient result={result} />;
}
