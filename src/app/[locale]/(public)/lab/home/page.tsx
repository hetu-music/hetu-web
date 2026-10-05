import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import HomeProto, {
  type ProtoImagery,
  type ProtoNote,
  type ProtoQuestion,
} from "@/components/lab/HomeProto";
import { fetchAll, getServiceClient, TABLES } from "@/lib/db/supabase-server";
import { PALETTE_FULL, sortLevel1Categories } from "@/lib/imagery/palette";
import { QUESTIONS, SIGNATURE_IMAGERY } from "@/lib/quiz";
import { getSongs } from "@/lib/server/service-songs";
import { countCatalogSongs } from "@/lib/utils/utils-song";

// 原型页：不进搜索引擎
export const metadata: Metadata = {
  title: "主页原型",
  robots: { index: false, follow: false },
};

type Props = { params: Promise<{ locale: string }> };

type CategoryRow = {
  id: number;
  name: string;
  parent_id: number | null;
  level: number | null;
};

/** 说明牌上的评点：太长的放不下，只取一句话长短的 */
const NOTE_MAX = 48;

export default async function HomeProtoPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const songs = await getSongs(undefined, undefined, true, locale);
  const supabase = getServiceClient();

  const [occurrences, imageryRows, categories, comments] = supabase
    ? await Promise.all([
        fetchAll<{ song_id: number; imagery_id: number; category_id: number }>(
          supabase,
          TABLES.IMAGERY_OCC,
          "song_id,imagery_id,category_id",
        ),
        fetchAll<{ id: number; name: string }>(
          supabase,
          TABLES.IMAGERY,
          "id,name",
        ),
        fetchAll<CategoryRow>(
          supabase,
          TABLES.IMAGERY_CAT,
          "id,name,parent_id,level",
        ),
        // 公开、正常、不是回复的评点，赞多的在前
        supabase
          .from(TABLES.COMMENTS)
          .select("song_id, body, anchor_quote, like_count, created_at")
          .is("parent_id", null)
          .eq("visibility", 0)
          .eq("status", 0)
          .order("like_count", { ascending: false })
          .order("created_at", { ascending: false })
          .limit(400)
          .then(({ data }) => data ?? []),
      ])
    : [[], [], [], []];

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
  const meta = new Map<number, { accent: string; songs: Set<number> }>();
  for (const o of occurrences) {
    const list = (songImagery[o.song_id] ??= []);
    if (!list.includes(o.imagery_id)) list.push(o.imagery_id);
    const m = meta.get(o.imagery_id) ?? {
      accent: accentOf(o.category_id),
      songs: new Set<number>(),
    };
    m.songs.add(o.song_id);
    meta.set(o.imagery_id, m);
  }
  const imagery: ProtoImagery[] = imageryRows
    .flatMap((r) => {
      const m = meta.get(r.id);
      return m
        ? [{ id: r.id, name: r.name, accent: m.accent, count: m.songs.size }]
        : [];
    })
    .sort((a, b) => b.count - a.count || a.id - b.id);

  // 每首取一句评点挂在说明牌上
  const notes: Record<number, ProtoNote> = {};
  for (const c of comments as {
    song_id: number;
    body: string;
    anchor_quote: string | null;
  }[]) {
    const body = c.body.replace(/\s+/g, " ").trim();
    if (notes[c.song_id] || !body || Array.from(body).length > NOTE_MAX)
      continue;
    notes[c.song_id] = { body, quote: c.anchor_quote };
  }

  // 测验第一题：每个选项指向一个招牌意象，答了就照亮写到它的作品
  const nameToId = new Map(imageryRows.map((r) => [r.name, r.id]));
  const first = QUESTIONS[0];
  const question: ProtoQuestion = {
    title: first.title,
    stem: first.stem,
    options: first.options.map((o) => {
      const aliases = (o.imagery ?? []).flatMap(
        (name) => SIGNATURE_IMAGERY.find((s) => s.name === name)?.aliases ?? [],
      );
      return {
        text: o.text,
        imageryIds: aliases
          .map((a) => nameToId.get(a))
          .filter((id): id is number => id !== undefined),
        label: o.imagery?.[0] ?? "",
      };
    }),
  };

  const storySong = songs.find((s) => s.title === "倾尽天下") ?? null;

  return (
    <HomeProto
      songs={songs}
      total={countCatalogSongs(songs)}
      songImagery={songImagery}
      imagery={imagery}
      notes={notes}
      question={question}
      storySongId={storySong?.id ?? null}
    />
  );
}

export const revalidate = 7200;
