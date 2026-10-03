import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import HomeLab, { type HeroLine } from "@/components/lab/HomeLab";
import { getServiceClient, TABLES } from "@/lib/db/supabase-server";
import { getImageryWithCounts } from "@/lib/server/service-imagery";
import { getSongs } from "@/lib/server/service-songs";
import type { Song } from "@/lib/types";

// 原型页：不进搜索引擎
export const metadata: Metadata = {
  title: "主页原型",
  robots: { index: false, follow: false },
};

type Props = { params: Promise<{ locale: string }> };

/** 开场轮播的句子取自最近这几首有封面的歌，保证它们都在封面场里 */
const HERO_POOL = 24;
const HERO_LINES = 10;

/** LRC 去掉时间戳与头部，留下纯文本行 */
function lrcLines(lrc: string): string[] {
  return lrc
    .split("\n")
    .map((line) =>
      line
        .replace(/\[\d{1,2}:\d{2}(?:\.\d{1,3})?\]/g, "")
        .replace(/^\[[a-z]+:[^\]]*\]$/i, "")
        .trim()
        // 句末的逗号句号去掉，句中的留着
        .replace(/[，。、,.;；]+$/, ""),
    )
    .filter(Boolean);
}

/**
 * 一首歌里挑一句：重复最多的那句（多半是副歌），长度适中，
 * 不要署名行（含冒号）和英文行
 */
function pickLine(lrc: string): string | null {
  const counts = new Map<string, { n: number; first: number }>();
  lrcLines(lrc).forEach((line, i) => {
    const len = line.replace(/\s/g, "").length;
    if (len < 6 || len > 18) return;
    if (/[:：]/.test(line) || /[a-z]{3,}/i.test(line)) return;
    const prev = counts.get(line);
    counts.set(line, { n: (prev?.n ?? 0) + 1, first: prev?.first ?? i });
  });
  let best: string | null = null;
  let bestScore = -Infinity;
  for (const [line, { n, first }] of counts) {
    // 重复次数优先，同样次数取靠前的
    const score = n * 1000 - first;
    if (score > bestScore) {
      best = line;
      bestScore = score;
    }
  }
  return best;
}

async function getHeroLines(songs: Song[]): Promise<HeroLine[]> {
  const pool = songs
    .filter((s) => s.hascover === true && !s.dispute_note)
    .slice(0, HERO_POOL);
  const supabase = getServiceClient();
  if (!supabase || pool.length === 0) return [];
  const { data } = await supabase
    .from(TABLES.MUSIC)
    .select("id,lyrics")
    .in(
      "id",
      pool.map((s) => s.id),
    );
  const lyricsById = new Map(
    (data ?? []).map((row: { id: number; lyrics: string | null }) => [
      row.id,
      row.lyrics,
    ]),
  );
  const lines: HeroLine[] = [];
  for (const song of pool) {
    const lrc = lyricsById.get(song.id);
    const text = lrc ? pickLine(lrc) : null;
    if (text) lines.push({ songId: song.id, text });
    if (lines.length >= HERO_LINES) break;
  }
  return lines;
}

export default async function HomeLabPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const songs = await getSongs(undefined, undefined, true, locale);
  const [lines, imagery] = await Promise.all([
    getHeroLines(songs),
    getImageryWithCounts().catch(() => []),
  ]);
  const topImagery = [...imagery]
    .sort((a, b) => b.count - a.count)
    .slice(0, 18)
    .map((i) => ({ name: i.name, count: i.count }));

  return <HomeLab songs={songs} lines={lines} imagery={topImagery} />;
}

export const revalidate = 7200;
