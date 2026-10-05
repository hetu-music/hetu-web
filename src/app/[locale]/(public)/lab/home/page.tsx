import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import VerseDemo, {
  type VerseImagery,
  type VerseRoom,
  type VerseSong,
} from "@/components/lab/VerseDemo";
import { fetchAll, getServiceClient, TABLES } from "@/lib/db/supabase-server";
import { parseLrcLines } from "@/lib/imagery/suggest";
import { PALETTE_FULL, sortLevel1Categories } from "@/lib/imagery/palette";
import { getSongs } from "@/lib/server/service-songs";
import { countCatalogSongs } from "@/lib/utils/utils-song";

// 原型页：不进搜索引擎
export const metadata: Metadata = {
  title: "词墙原型",
  robots: { index: false, follow: false },
};

type Props = { params: Promise<{ locale: string }> };

/** 两间展室：最密的一年与最空的一年 */
const DEMO_YEARS = [2016, 2012];

type CategoryRow = {
  id: number;
  name: string;
  parent_id: number | null;
  level: number | null;
};

/** 句末标点去掉，对唱的「合：」「男：」之类前缀也去掉；句中的逗号留着 */
const clean = (text: string) =>
  text
    .replace(/^[^：:s]{1,3}[：:]s*/, "")
    .replace(/^[「『“"]+|[，。、,.;；！!？?」』”"]+$/g, "")
    .trim();

/** 代表句的长度：太短撑不起一列，太长竖排放不下 */
const fits = (text: string) => {
  const len = text.replace(/\s/g, "").length;
  return len >= 4 && len <= 16 && !/[a-z]{3,}/i.test(text);
};

export default async function VerseDemoPage({ params }: Props) {
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
        fetchAll<{
          song_id: number;
          imagery_id: number;
          category_id: number;
          lyric_timetag: string[] | null;
        }>(
          supabase,
          TABLES.IMAGERY_OCC,
          "song_id,imagery_id,category_id,lyric_timetag",
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
  const nameOf = new Map(imageryRows.map((r) => [r.id, r.name]));

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

  // 每首歌：时间标签 → 这一句写到的意象
  const tagImagery = new Map<number, Map<string, Set<number>>>();
  const imageryMeta = new Map<number, { accent: string; songs: Set<number> }>();
  for (const o of occurrences) {
    const byTag = tagImagery.get(o.song_id) ?? new Map<string, Set<number>>();
    tagImagery.set(o.song_id, byTag);
    for (const tag of o.lyric_timetag ?? []) {
      const set = byTag.get(tag) ?? new Set<number>();
      set.add(o.imagery_id);
      byTag.set(tag, set);
    }
    const meta = imageryMeta.get(o.imagery_id) ?? {
      accent: accentOf(o.category_id),
      songs: new Set<number>(),
    };
    meta.songs.add(o.song_id);
    imageryMeta.set(o.imagery_id, meta);
  }

  const lyricsById = new Map(lyricRows.map((r) => [r.id, r.lyrics]));

  const toVerseSong = (song: (typeof songs)[number]): VerseSong => {
    const parsed = parseLrcLines(lyricsById.get(song.id));
    const byTag = tagImagery.get(song.id);
    // 同一句（副歌）只留一次，记下重复次数与它写到的全部意象
    const lines: { text: string; imagery: number[]; repeats: number }[] = [];
    const index = new Map<string, number>();
    for (const { tag, text: raw } of parsed) {
      const text = clean(raw);
      if (!text) continue;
      const found = [...(byTag?.get(tag) ?? [])].filter((id) => {
        // 意象名要真的出现在这句里，才能把字点亮
        const name = nameOf.get(id);
        return name ? text.includes(name) : false;
      });
      const at = index.get(text);
      if (at === undefined) {
        index.set(text, lines.length);
        lines.push({ text, imagery: found, repeats: 1 });
      } else {
        const line = lines[at];
        line.repeats++;
        for (const id of found)
          if (!line.imagery.includes(id)) line.imagery.push(id);
      }
    }
    // 代表句：写到的意象多、又是反复唱的那句（多半是副歌）
    let rep = -1;
    let best = -Infinity;
    lines.forEach((line, i) => {
      if (!fits(line.text)) return;
      const len = line.text.replace(/\s/g, "").length;
      const score =
        line.imagery.length * 2 +
        Math.min(line.repeats, 3) +
        (len >= 6 && len <= 12 ? 1 : 0) -
        i * 0.01;
      if (score > best) {
        best = score;
        rep = i;
      }
    });
    return {
      id: song.id,
      title: song.title,
      year: song.year ?? null,
      artist: song.artist ?? [],
      type: song.type?.[0] ?? null,
      hascover: song.hascover === true,
      lines: lines.map(({ text, imagery }) => ({ text, imagery })),
      rep,
    };
  };

  const rooms: VerseRoom[] = DEMO_YEARS.map((year) => {
    const roomSongs = songs.filter((s) => s.year === year).map(toVerseSong);
    // 主作：有封面的歌里写到意象最多的那首，挂在画框里迎客
    const featured = roomSongs
      .filter((s) => s.hascover)
      .sort(
        (a, b) =>
          b.lines.reduce((n, l) => n + l.imagery.length, 0) -
          a.lines.reduce((n, l) => n + l.imagery.length, 0),
      )[0];
    return { year, songs: roomSongs, featuredId: featured?.id ?? null };
  });

  const imagery: VerseImagery[] = [...imageryMeta.entries()]
    .map(([id, meta]) => ({
      id,
      name: nameOf.get(id) ?? "",
      accent: meta.accent,
      count: meta.songs.size,
    }))
    .filter((i) => i.name)
    .sort((a, b) => b.count - a.count || a.id - b.id);

  return (
    <VerseDemo rooms={rooms} total={countCatalogSongs(all)} imagery={imagery} />
  );
}

export const revalidate = 7200;
