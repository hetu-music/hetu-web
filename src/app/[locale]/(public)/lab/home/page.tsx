import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import HallDemo, {
  type HallImagery,
  type HallRoom,
} from "@/components/lab/HallDemo";
import { fetchAll, getServiceClient, TABLES } from "@/lib/db/supabase-server";
import { PALETTE_FULL, sortLevel1Categories } from "@/lib/imagery/palette";
import { getSongs } from "@/lib/server/service-songs";
import {
  countCatalogSongs,
  processLyricsForSearch,
} from "@/lib/utils/utils-song";

// 原型页：不进搜索引擎
export const metadata: Metadata = {
  title: "展室原型",
  robots: { index: false, follow: false },
};

type Props = { params: Promise<{ locale: string }> };

/** 三间展室：一间寻常、一间最密、一间最空 */
const DEMO_YEARS = [2020, 2016, 2012];

type CategoryRow = {
  id: number;
  name: string;
  parent_id: number | null;
  level: number | null;
};

export default async function HallDemoPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const all = await getSongs(undefined, undefined, true, locale);
  const songs = all.filter((s) => s.year && DEMO_YEARS.includes(s.year));
  const ids = songs.map((s) => s.id);

  const supabase = getServiceClient();
  const [lyricRows, occurrences, categories] = supabase
    ? await Promise.all([
        fetchAll<{ id: number; lyrics: string | null }>(
          supabase,
          TABLES.MUSIC,
          "id,lyrics",
          (q) => q.in("id", ids),
        ),
        fetchAll<{ song_id: number; imagery_id: number; category_id: number }>(
          supabase,
          TABLES.IMAGERY_OCC,
          "song_id,imagery_id,category_id",
          (q) => q.in("song_id", ids),
        ),
        fetchAll<CategoryRow>(
          supabase,
          TABLES.IMAGERY_CAT,
          "id,name,parent_id,level",
        ),
      ])
    : [[], [], []];

  const imageryIds = [...new Set(occurrences.map((o) => o.imagery_id))];
  const imageryRows =
    supabase && imageryIds.length > 0
      ? await fetchAll<{ id: number; name: string }>(
          supabase,
          TABLES.IMAGERY,
          "id,name",
          (q) => q.in("id", imageryIds),
        )
      : [];

  // 意象按一级分类上色，与意象页、详情页同一套颜色
  const catById = new Map(categories.map((c) => [c.id, c]));
  const l1Accent = new Map(
    sortLevel1Categories(categories).map((c, i) => [
      c.id,
      PALETTE_FULL[i % PALETTE_FULL.length].accent,
    ]),
  );
  const accentOf = (categoryId: number) => {
    let cat = catById.get(categoryId);
    for (let i = 0; cat && cat.level !== 1 && i < 5; i++)
      cat = cat.parent_id !== null ? catById.get(cat.parent_id) : undefined;
    return (cat && l1Accent.get(cat.id)) ?? "#94a3b8";
  };

  const songImagery: Record<number, number[]> = {};
  const imageryInfo = new Map<number, { songs: Set<number>; accent: string }>();
  for (const o of occurrences) {
    const list = (songImagery[o.song_id] ??= []);
    if (!list.includes(o.imagery_id)) list.push(o.imagery_id);
    const info = imageryInfo.get(o.imagery_id) ?? {
      songs: new Set<number>(),
      accent: accentOf(o.category_id),
    };
    info.songs.add(o.song_id);
    imageryInfo.set(o.imagery_id, info);
  }
  const imagery: HallImagery[] = imageryRows
    .map((row) => ({
      id: row.id,
      name: row.name,
      count: imageryInfo.get(row.id)?.songs.size ?? 0,
      accent: imageryInfo.get(row.id)?.accent ?? "#94a3b8",
    }))
    .filter((i) => i.count > 0)
    .sort((a, b) => b.count - a.count || a.id - b.id);

  const lyrics: Record<number, string> = {};
  for (const row of lyricRows)
    lyrics[row.id] = processLyricsForSearch(row.lyrics);

  const rooms: HallRoom[] = DEMO_YEARS.map((year) => {
    const roomSongs = songs.filter((s) => s.year === year);
    // 主作：有封面的歌里，写到的意象最多的那首
    const featured = roomSongs
      .filter((s) => s.hascover === true)
      .sort(
        (a, b) =>
          (songImagery[b.id]?.length ?? 0) - (songImagery[a.id]?.length ?? 0),
      )[0];
    // 这一年最常写到的几个意象，写在年份旁边
    const tally = new Map<number, number>();
    for (const s of roomSongs)
      for (const id of songImagery[s.id] ?? [])
        tally.set(id, (tally.get(id) ?? 0) + 1);
    const signature = [...tally.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([id]) => id);
    return {
      year,
      songs: roomSongs,
      featuredId: featured?.id ?? null,
      signature,
    };
  });

  return (
    <HallDemo
      rooms={rooms}
      total={countCatalogSongs(all)}
      lyrics={lyrics}
      songImagery={songImagery}
      imagery={imagery}
    />
  );
}

export const revalidate = 7200;
