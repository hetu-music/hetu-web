import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import MusicLibraryClient from "@/components/library/MusicLibraryClient";
import { getSongs } from "@/lib/server/service-songs";
import { countCatalogSongs } from "@/lib/utils/utils-song";
import { Song } from "@/lib/types";
import Loading from "@/components/shared/Loading";
import ErrorState from "@/components/shared/Error";
import { routing } from "@/i18n/routing";

type Props = {
  params: Promise<{ locale: string }>;
};

// 动态生成首页 SEO 元数据
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = await getTranslations({ locale, namespace: "common" });
  const tLib = await getTranslations({ locale, namespace: "library" });

  let description = t("site.description");

  try {
    const songs = await getSongs(undefined, undefined, true, locale);
    const count = countCatalogSongs(songs);
    const recentTitles = songs
      .slice(0, 5)
      .map((s) => `《${s.title}》`)
      .join("");
    description = tLib("meta.descriptionWithStats", {
      count,
      recentTitles,
    });
  } catch {
    // 获取失败时使用默认描述
  }

  return {
    title: {
      absolute: t("site.title"),
    },
    description,
    alternates: {
      canonical:
        locale === "zh-TW"
          ? "https://hetu-music.com/zh-TW"
          : "https://hetu-music.com/zh-CN",
      languages: {
        "zh-CN": "https://hetu-music.com/zh-CN",
        "zh-TW": "https://hetu-music.com/zh-TW",
      },
    },
    openGraph: {
      title: t("site.title"),
      description,
      type: "website",
      images: [{ url: "/icons/source.png" }],
    },
  };
}

// 服务端组件 - 使用 ISR
export default async function MusicLibraryPage({ params }: Props) {
  const { locale } = await params;
  // 带点号的路径（/.env、/secrets.yml 等扫描器探测）不经过 proxy，会被当成
  // locale 匹配到这里。layout 也会 notFound()，但页面与 layout 并行渲染，
  // 不在这里先拦，就会照常查整个曲库，生成约 520KB 的 ISR 条目进缓存；
  // 先拦之后只缓存一个约 9KB 的 404。
  //
  // 不能改用 dynamicParams = false：revalidatePath 之后缓存条目被清空，
  // Next 会把已预渲染的 /zh-CN 也当成未知参数直接 404，且不再重新生成
  // （NoFallbackError，1.8.14 线上首页因此 404）。
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "common" });
  let songsData: Song[] = [];
  let error: Error | null = null;

  try {
    // forListView = true 只获取列表展示需要的字段，排除歌词等大字段
    songsData = await getSongs(undefined, undefined, true, locale);
  } catch (err) {
    console.error("Error fetching songs:", err);
    error = err instanceof Error ? err : new Error("未知错误");
  }

  if (error) {
    return <ErrorState error={error} />;
  }

  return (
    <>
      <h1 className="sr-only">{t("site.title")}</h1>
      <Suspense fallback={<Loading />}>
        <MusicLibraryClient initialSongsData={songsData} />
      </Suspense>
    </>
  );
}

// 启用 ISR - 每2小时重新生成页面，减少服务器负载
export const revalidate = 7200;
