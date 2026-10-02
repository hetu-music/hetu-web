import type { Metadata } from "next";
import { Suspense } from "react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import MusicLibraryClient from "@/components/library/MusicLibraryClient";
import { getLibraryImagery } from "@/lib/server/service-song-imagery";
import { getSongs } from "@/lib/server/service-songs";
import { countCatalogSongs } from "@/lib/utils/utils-song";
import type { LibraryImagery, Song } from "@/lib/types";
import Loading from "@/components/shared/Loading";
import ErrorState from "@/components/shared/Error";

type Props = {
  params: Promise<{ locale: string }>;
};

// 动态生成首页 SEO 元数据
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
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
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "common" });
  let songsData: Song[] = [];
  let imagery: LibraryImagery = { bySong: {}, items: [] };
  let error: Error | null = null;

  try {
    // forListView = true 只获取列表展示需要的字段，排除歌词等大字段
    // 意象取不到时墙照常显示，只是不能按意象点灯（getLibraryImagery 自己兜底）
    [songsData, imagery] = await Promise.all([
      getSongs(undefined, undefined, true, locale),
      getLibraryImagery(locale),
    ]);
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
        <MusicLibraryClient initialSongsData={songsData} imagery={imagery} />
      </Suspense>
    </>
  );
}

// 启用 ISR - 每2小时重新生成页面，减少服务器负载
export const revalidate = 7200;
