import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import SongDetailClient from "@/components/detail/SongDetailClient";
import { getSongById } from "@/lib/server/service-songs";
import { getSongImagery } from "@/lib/server/service-song-imagery";
import { getSongCollations } from "@/lib/server/service-collations";
import { TABLES } from "@/lib/db/supabase-server";
import { buildFolio, markLines, pickExcerpt } from "@/lib/utils/utils-folio";
import { SITE_URL } from "@/lib/constants";

type PageProps = {
  params: Promise<{ id: string; locale: string }>;
};

// 动态生成每首歌的 SEO 元数据
export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { id, locale } = await params;
  const songId = parseInt(id);
  if (isNaN(songId)) return {};

  const t = await getTranslations({ locale, namespace: "song" });
  const song = await getSongById(songId, TABLES.MUSIC, undefined, locale);
  if (!song) return {};

  // 构建描述信息 — 使用｜分隔的紧凑格式
  const lyricistLabel = t("labels.lyricist");
  const composerLabel = t("labels.composer");
  const arrangerLabel = t("labels.arranger");
  const artistLabel = t("labels.artist");
  const albumLabel = t("labels.album");

  const descParts: string[] = [`《${song.title}》`];
  if (song.artist?.length)
    descParts.push(`${artistLabel}：${song.artist.join("、")}`);
  if (song.lyricist?.length)
    descParts.push(`${lyricistLabel}：${song.lyricist.join("、")}`);
  if (song.composer?.length)
    descParts.push(`${composerLabel}：${song.composer.join("、")}`);
  if (song.arranger?.length)
    descParts.push(`${arrangerLabel}：${song.arranger.join("、")}`);
  if (song.album) descParts.push(`${albumLabel}：《${song.album}》`);
  if (song.year) descParts.push(`${song.year}年`);

  const description = descParts.join("｜") + t("meta.siteSuffix");

  // OG 封面走代理路径，确保爬虫可以访问
  const coverFilename =
    song.hascover === true
      ? `${song.id}.jpg`
      : song.hascover === false
        ? "proto.jpg"
        : "default.jpg";

  return {
    title: song.title,
    description,
    alternates: {
      canonical:
        locale === "zh-TW"
          ? `${SITE_URL}/zh-TW/song/${song.id}`
          : `${SITE_URL}/zh-CN/song/${song.id}`,
      languages: {
        "zh-CN": `${SITE_URL}/zh-CN/song/${song.id}`,
        "zh-TW": `${SITE_URL}/zh-TW/song/${song.id}`,
      },
    },
    openGraph: {
      title: `${song.title}${t("ogSuffix")}`,
      description,
      type: "music.song",
      images: [{ url: `/og-cover/${coverFilename}` }],
    },
  };
}

export default async function SongDetailPage({
  params,
}: {
  params: Promise<{ id: string; locale: string }>;
}) {
  const { id, locale } = await params;
  setRequestLocale(locale);

  const songId = parseInt(id);
  if (isNaN(songId)) {
    console.warn("Invalid song ID:", id);
    notFound();
  }

  let song;
  let imagery;
  let collations;
  try {
    [song, imagery, collations] = await Promise.all([
      getSongById(songId, TABLES.MUSIC, undefined, locale),
      getSongImagery(songId, locale),
      getSongCollations(songId, locale),
    ]);
  } catch (error) {
    console.error("Error in SongDetailPage:", error);
    notFound();
  }

  if (!song) {
    notFound();
  }

  // 摘句在服务端挑定：折长句用到的分词随运行环境而异，前后端各算一遍可能不一致
  const { lines } = buildFolio(song.lyrics, {
    title: song.title,
    lyricsStart: song.lyrics_start,
  });
  const excerpt = pickExcerpt(lines, markLines(lines, imagery.marks));

  return (
    <SongDetailClient
      song={song}
      imagery={imagery}
      excerpt={excerpt}
      collations={collations}
    />
  );
}

// 生成静态参数
export async function generateStaticParams() {
  return [];
}

// 配置 ISR
export const revalidate = 7200;
