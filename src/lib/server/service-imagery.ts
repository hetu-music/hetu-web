import { cache } from "react";
import {
  getServiceClient,
  getUserClient,
  fetchAll,
  TABLES,
} from "@/lib/db/supabase-server";
import { songTimetags } from "@/lib/imagery/consistency";
import type { MotifEntry } from "@/lib/imagery/suggest";
import type { ImageryCategory, ImageryItem } from "@/lib/types";

export type OccurrenceWithSong = {
  id: number;
  song_id: number;
  imagery_id: number;
  category_id: number;
  lyric_timetag: string[];
  song_title: string;
  song_album: string | null;
  imagery_name?: string;
  category_name?: string;
};

// ─── helper ───────────────────────────────────────────────────────────────────

function mapOccurrenceRow(row: Record<string, unknown>): OccurrenceWithSong {
  const music = row.music as { title?: string; album?: string } | null;
  const imagery = row.imagery as { name?: string } | null;
  const imageryCategories = row.imagery_categories as { name?: string } | null;
  return {
    id: row.id as number,
    song_id: row.song_id as number,
    imagery_id: row.imagery_id as number,
    category_id: row.category_id as number,
    lyric_timetag: (row.lyric_timetag as string[]) ?? [],
    song_title: music?.title ?? "",
    song_album: music?.album ?? null,
    imagery_name: imagery?.name,
    category_name: imageryCategories?.name,
  };
}

// ─── read functions ───────────────────────────────────────────────────────────

// cache(): 同一次请求内 generateMetadata 与页面组件各调一次，去重成一次查询
export const getImageryCategories = cache(
  async function getImageryCategories(): Promise<ImageryCategory[]> {
    const supabase = getServiceClient();
    if (!supabase) return [];
    return fetchAll(
      supabase,
      TABLES.IMAGERY_CAT,
      "id,name,parent_id,level,description",
    ) as Promise<ImageryCategory[]>;
  },
);

/**
 * 后台词典：全部词、各自的标注条数（含争议歌曲），以及在 imagery_motifs 登记的母题。
 * 词能取哪些母题只看登记（见 IMAGERY.md），不再从已有标注里推。
 * 公开的意象页另按母题聚合，见 imagery-index。
 */
export const getImageryWithCounts = cache(
  async function getImageryWithCounts(): Promise<ImageryItem[]> {
    const supabase = getServiceClient();
    if (!supabase) return [];
    try {
      const [rows, motifs] = await Promise.all([
        fetchAll<{ id: number; name: string; count: number | null }>(
          supabase,
          TABLES.IMAGERY_SUMMARY_ALL,
          "id,name,count",
        ),
        fetchAll<MotifEntry>(
          supabase,
          TABLES.IMAGERY_MOTIFS,
          "imagery_id,category_id,role",
        ),
      ]);
      const byWord = new Map<number, MotifEntry[]>();
      for (const m of motifs) {
        const list = byWord.get(m.imagery_id) ?? [];
        list.push(m);
        byWord.set(m.imagery_id, list);
      }
      return rows.map((item) => {
        const entries = byWord.get(item.id) ?? [];
        const of = (role: MotifEntry["role"]) =>
          entries.filter((m) => m.role === role).map((m) => m.category_id);
        return {
          id: item.id,
          name: item.name,
          count: item.count ?? 0,
          primary: of("primary")[0] ?? null,
          alternatives: of("alternative"),
          parts: of("part"),
        };
      });
    } catch (e) {
      console.error("[getImageryWithCounts]", e);
      return [];
    }
  },
);

export async function getOccurrencesForImagery(
  imageryId: number,
): Promise<OccurrenceWithSong[]> {
  const supabase = getServiceClient();
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from(TABLES.IMAGERY_OCC)
      .select("*, music(title, album), imagery(name), imagery_categories(name)")
      .eq("imagery_id", imageryId);
    if (error) {
      console.error("[getOccurrencesForImagery]", error);
      return [];
    }
    return ((data ?? []) as Record<string, unknown>[]).map(mapOccurrenceRow);
  } catch (e) {
    console.error("[getOccurrencesForImagery]", e);
    return [];
  }
}

export async function getOccurrencesForSong(
  songId: number,
): Promise<OccurrenceWithSong[]> {
  const supabase = getServiceClient();
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from(TABLES.IMAGERY_OCC)
      .select("*, music(title, album), imagery(name), imagery_categories(name)")
      .eq("song_id", songId);
    if (error) {
      console.error("[getOccurrencesForSong]", error);
      return [];
    }
    return ((data ?? []) as Record<string, unknown>[]).map(mapOccurrenceRow);
  } catch (e) {
    console.error("[getOccurrencesForSong]", e);
    return [];
  }
}

/** 标注属于哪首歌、哪个意象、哪个母题；改动或删除标注前查出来，好刷新对应缓存 */
export async function getOccurrenceRefs(id: number): Promise<{
  song_id: number;
  imagery_id: number;
  category_id: number;
} | null> {
  const supabase = getServiceClient();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from(TABLES.IMAGERY_OCC)
    .select("song_id,imagery_id,category_id")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data as {
    song_id: number;
    imagery_id: number;
    category_id: number;
  } | null;
}

// ─── write functions: 母题 ────────────────────────────────────────────────────
// 门类（第一级）与类别（第二级）固定，增减要先讨论（见 IMAGERY.md），后台只增改母题（第三级）。
// 词不单独新建或改名：词在标注时按歌词原文创建，改名会让它的标注全部对不上歌词。

function badRequest(message: string, code: string) {
  return Object.assign(new Error(message), { code });
}

/** 母题只能挂在类别（第二级）下 */
async function assertCategoryParent(supabase: UserClient, parentId: number) {
  const { data, error } = await supabase
    .from(TABLES.IMAGERY_CAT)
    .select("level")
    .eq("id", parentId)
    .maybeSingle();
  if (error) throw error;
  if ((data as { level: number | null } | null)?.level !== 2) {
    throw badRequest("母题只能放在类别（第二级）下", "INVALID_PARENT");
  }
}

export async function createMotif(
  data: { name: string; parent_id: number; description: string },
  accessToken: string,
): Promise<ImageryCategory> {
  const supabase = getUserClient(accessToken);
  if (!supabase) throw new Error("Supabase client unavailable");
  await assertCategoryParent(supabase, data.parent_id);
  const { data: created, error } = await supabase
    .from(TABLES.IMAGERY_CAT)
    .insert({ ...data, level: 3 })
    .select("id,name,parent_id,level,description")
    .single();
  if (error) throw error;
  return created as ImageryCategory;
}

export async function updateMotif(
  id: number,
  data: { name?: string; parent_id?: number; description?: string },
  accessToken: string,
): Promise<ImageryCategory> {
  const supabase = getUserClient(accessToken);
  if (!supabase) throw new Error("Supabase client unavailable");
  await assertMotifs(supabase, [id]);
  if (data.parent_id !== undefined) {
    await assertCategoryParent(supabase, data.parent_id);
  }
  const { data: updated, error } = await supabase
    .from(TABLES.IMAGERY_CAT)
    .update(data)
    .eq("id", id)
    .select("id,name,parent_id,level,description")
    .single();
  if (error) throw error;
  return updated as ImageryCategory;
}

// ─── write functions: 词的候选母题 ────────────────────────────────────────────

export type WordMotifs = {
  primary: number;
  alternatives: number[];
  parts: number[];
};

/**
 * 整体改写一个词登记的母题（imagery_motifs）。
 *
 * 去掉的母题下若还有这个词的标注，拒绝：那些标注会落到候选之外。
 * 写入顺序照顾「每词一个 primary」的唯一索引：先删去掉的、再把旧默认降为多义、最后写新的。
 */
export async function setWordMotifs(
  imageryId: number,
  next: WordMotifs,
  accessToken: string,
): Promise<WordMotifs> {
  const wanted = new Map<number, MotifEntry["role"]>([
    ...next.parts.map((id) => [id, "part"] as const),
    ...next.alternatives.map((id) => [id, "alternative"] as const),
    [next.primary, "primary"] as const,
  ]);
  if (wanted.size !== 1 + next.alternatives.length + next.parts.length) {
    throw badRequest("同一个母题只能登记一次", "DUPLICATE_MOTIF");
  }
  const supabase = getUserClient(accessToken);
  if (!supabase) throw new Error("Supabase client unavailable");
  await assertMotifs(supabase, [...wanted.keys()]);

  const [current, occurrences] = await Promise.all([
    supabase
      .from(TABLES.IMAGERY_MOTIFS)
      .select("category_id,role")
      .eq("imagery_id", imageryId),
    supabase
      .from(TABLES.IMAGERY_OCC)
      .select("category_id")
      .eq("imagery_id", imageryId),
  ]);
  if (current.error) throw current.error;
  if (occurrences.error) throw occurrences.error;
  const rows = (current.data ?? []) as Array<{
    category_id: number;
    role: MotifEntry["role"];
  }>;
  const annotated = new Set(
    ((occurrences.data ?? []) as { category_id: number }[]).map(
      (o) => o.category_id,
    ),
  );

  const removed = rows
    .map((r) => r.category_id)
    .filter((id) => !wanted.has(id));
  const blocked = removed.filter((id) => annotated.has(id));
  if (blocked.length > 0) {
    throw badRequest(
      "这个词在要去掉的母题下还有标注，先到歌曲里改标或删掉",
      "MOTIF_IN_USE",
    );
  }
  if (removed.length > 0) {
    const { error } = await supabase
      .from(TABLES.IMAGERY_MOTIFS)
      .delete()
      .eq("imagery_id", imageryId)
      .in("category_id", removed);
    if (error) throw error;
  }
  const oldPrimary = rows.find((r) => r.role === "primary")?.category_id;
  if (
    oldPrimary !== undefined &&
    oldPrimary !== next.primary &&
    wanted.has(oldPrimary)
  ) {
    const { error } = await supabase
      .from(TABLES.IMAGERY_MOTIFS)
      .update({ role: "alternative" })
      .eq("imagery_id", imageryId)
      .eq("category_id", oldPrimary);
    if (error) throw error;
  }
  // 主键 (imagery_id, category_id)：已有的行改 role，新的行插入；primary 放最后写
  const upserts = [...wanted]
    .map(([category_id, role]) => ({
      imagery_id: imageryId,
      category_id,
      role,
    }))
    .sort(
      (a, b) => Number(a.role === "primary") - Number(b.role === "primary"),
    );
  const { error } = await supabase
    .from(TABLES.IMAGERY_MOTIFS)
    .upsert(upserts, { onConflict: "imagery_id,category_id" });
  if (error) throw error;
  return next;
}

async function getOccurrenceWithRelationsById(id: number, accessToken: string) {
  const supabase = getUserClient(accessToken);
  if (!supabase) throw new Error("Supabase client unavailable");
  const { data, error } = await supabase
    .from(TABLES.IMAGERY_OCC)
    .select("*, music(title, album), imagery(name), imagery_categories(name)")
    .eq("id", id)
    .single();
  if (error) throw error;
  return mapOccurrenceRow(data as Record<string, unknown>);
}

// ─── 整理：删掉没有标注的母题 ─────────────────────────────────────────────────

export type UnusedMotifWord = {
  id: number;
  name: string;
  role: "primary" | "alternative" | "part";
  /**
   * 只对默认母题有：母题删掉后这个词改用的默认母题，取它其余候选里标注最多的；
   * 没有候选时取标注里用得最多的母题。null 表示无可替换，删后这个词没有默认母题
   */
  promoteTo?: { id: number; name: string } | null;
};

/** 可以整理掉的母题，连同登记了它的词（删母题时这些登记一并删掉） */
export type UnusedMotif = ImageryCategory & { words: UnusedMotifWord[] };

/**
 * 没用上的母题：第三级、没有子分类、没有标注指向它。
 * 词登记不算用上：标注改挂别的母题后，原来自动登记的默认母题会留在 imagery_motifs 里
 * （「汗」先标了母题汗、后改成身躯，汗仍是它的默认母题），整理时把登记一并处理掉。
 * 第一、二级是门类与类别，增减要先讨论（见 IMAGERY.md），不在整理范围内。
 */
async function findUnusedMotifs(supabase: UserClient): Promise<UnusedMotif[]> {
  const [categories, motifs, occurrences] = await Promise.all([
    fetchAll<ImageryCategory>(
      supabase,
      TABLES.IMAGERY_CAT,
      "id,name,parent_id,level,description",
    ),
    fetchAll<MotifEntry>(
      supabase,
      TABLES.IMAGERY_MOTIFS,
      "imagery_id,category_id,role",
    ),
    fetchAll<{ imagery_id: number; category_id: number }>(
      supabase,
      TABLES.IMAGERY_OCC,
      "imagery_id,category_id",
    ),
  ]);
  const annotated = new Set(occurrences.map((o) => o.category_id));
  const parents = new Set(categories.map((c) => c.parent_id));
  const unused = categories.filter(
    (c) => c.level === 3 && !annotated.has(c.id) && !parents.has(c.id),
  );
  if (unused.length === 0) return [];

  const unusedIds = new Set(unused.map((c) => c.id));
  const registrations = motifs.filter((m) => unusedIds.has(m.category_id));
  const wordIds = [...new Set(registrations.map((m) => m.imagery_id))];
  const wordName = new Map<number, string>();
  if (wordIds.length > 0) {
    const { data, error } = await supabase
      .from(TABLES.IMAGERY)
      .select("id,name")
      .in("id", wordIds);
    if (error) throw error;
    for (const row of (data ?? []) as { id: number; name: string }[]) {
      wordName.set(row.id, row.name);
    }
  }

  const catName = new Map(categories.map((c) => [c.id, c.name]));
  const promoteTo = (wordId: number) => {
    const counts = new Map<number, number>();
    for (const o of occurrences) {
      if (o.imagery_id !== wordId) continue;
      counts.set(o.category_id, (counts.get(o.category_id) ?? 0) + 1);
    }
    const alternatives = motifs
      .filter(
        (m) =>
          m.imagery_id === wordId &&
          m.role === "alternative" &&
          !unusedIds.has(m.category_id),
      )
      .map((m) => m.category_id);
    const pool = alternatives.length > 0 ? alternatives : [...counts.keys()];
    const [id] = pool.sort(
      (a, b) => (counts.get(b) ?? 0) - (counts.get(a) ?? 0),
    );
    return id === undefined ? null : { id, name: catName.get(id) ?? `#${id}` };
  };

  return unused.map((c) => ({
    ...c,
    words: registrations
      .filter((m) => m.category_id === c.id)
      .map((m) => ({
        id: m.imagery_id,
        name: wordName.get(m.imagery_id) ?? `#${m.imagery_id}`,
        role: m.role,
        ...(m.role === "primary" ? { promoteTo: promoteTo(m.imagery_id) } : {}),
      })),
  }));
}

export async function getUnusedMotifs(
  accessToken: string,
): Promise<UnusedMotif[]> {
  const supabase = getUserClient(accessToken);
  if (!supabase) throw new Error("Supabase client unavailable");
  return findUnusedMotifs(supabase);
}

/**
 * 删掉选中的空母题。删之前按当前数据重查一遍：列表打开后又有了标注的母题不删。
 *
 * 顺序：先删这些母题的词登记（category_id 是 on delete restrict），再给默认母题被删的词
 * 换上新的默认母题（每词只能有一个 primary，所以要在删之后），最后删母题。
 * 返回实际删掉的 id（权限不够时 RLS 会静默不删，这里能看出来）与换了默认母题的词。
 */
export async function deleteUnusedMotifs(
  ids: readonly number[],
  accessToken: string,
): Promise<{
  deleted: number[];
  promoted: Array<{ word: string; motif: string }>;
}> {
  const supabase = getUserClient(accessToken);
  if (!supabase) throw new Error("Supabase client unavailable");
  const wanted = new Set(ids);
  const targets = (await findUnusedMotifs(supabase)).filter((c) =>
    wanted.has(c.id),
  );
  if (targets.length === 0) return { deleted: [], promoted: [] };
  const targetIds = targets.map((c) => c.id);

  if (targets.some((c) => c.words.length > 0)) {
    const { error } = await supabase
      .from(TABLES.IMAGERY_MOTIFS)
      .delete()
      .in("category_id", targetIds);
    if (error) throw error;
  }

  const promotions = targets.flatMap((c) =>
    c.words.flatMap((w) =>
      w.role === "primary" && w.promoteTo
        ? [{ imagery_id: w.id, word: w.name, motif: w.promoteTo }]
        : [],
    ),
  );
  if (promotions.length > 0) {
    // 换上的多半原本是多义候选，已有这一行，改 role 即可
    const { error } = await supabase.from(TABLES.IMAGERY_MOTIFS).upsert(
      promotions.map((p) => ({
        imagery_id: p.imagery_id,
        category_id: p.motif.id,
        role: "primary" as const,
      })),
      { onConflict: "imagery_id,category_id" },
    );
    if (error) throw error;
  }

  const { data, error } = await supabase
    .from(TABLES.IMAGERY_CAT)
    .delete()
    .in("id", targetIds)
    .select("id");
  if (error) throw error;
  return {
    deleted: ((data ?? []) as { id: number }[]).map((r) => r.id),
    promoted: promotions.map((p) => ({ word: p.word, motif: p.motif.name })),
  };
}

// ─── helpers ──────────────────────────────────────────────────────────────────

/**
 * 标注与词登记只能挂在母题（第三级分类）上（见 IMAGERY.md）。
 * 原先按「没有子分类」判断，空着的二级分类也会被当成母题。
 */
async function assertMotifs(
  supabase: UserClient,
  categoryIds: readonly number[],
): Promise<void> {
  const ids = [...new Set(categoryIds)];
  if (ids.length === 0) return;
  const { data, error } = await supabase
    .from(TABLES.IMAGERY_CAT)
    .select("id,level")
    .in("id", ids);
  if (error) throw error;
  const motifs = new Set(
    ((data ?? []) as { id: number; level: number | null }[])
      .filter((c) => c.level === 3)
      .map((c) => c.id),
  );
  if (ids.some((id) => !motifs.has(id))) {
    throw badRequest("只能挂到母题（第三级分类）上", "NOT_MOTIF");
  }
}

// ─── write functions: occurrences ─────────────────────────────────────────────

type UserClient = NonNullable<ReturnType<typeof getUserClient>>;
type MotifInfo = { primary: number | null; parts: number[] };

/**
 * 保证标注挂的母题登记在该词的候选里（见 IMAGERY.md）：
 * 从未登记母题的新词，以这次选的母题为默认；已登记的词选了候选之外的母题，登记为多义候选。
 *
 * 返回各词的默认母题与并列组成，供 withParts 为挂默认母题的标注补写并列组成。
 */
async function registerMotifs(
  supabase: UserClient,
  pairs: ReadonlyArray<{ imagery_id: number; category_id: number }>,
): Promise<Map<number, MotifInfo>> {
  const ids = [...new Set(pairs.map((p) => p.imagery_id))];
  const { data, error } = await supabase
    .from(TABLES.IMAGERY_MOTIFS)
    .select("imagery_id,category_id,role")
    .in("imagery_id", ids);
  if (error) throw error;

  const known = new Map<number, MotifInfo & { all: Set<number> }>(
    ids.map((id) => [id, { primary: null, parts: [], all: new Set() }]),
  );
  for (const row of (data ?? []) as Array<{
    imagery_id: number;
    category_id: number;
    role: string;
  }>) {
    const entry = known.get(row.imagery_id);
    if (!entry) continue;
    entry.all.add(row.category_id);
    if (row.role === "primary") entry.primary = row.category_id;
    if (row.role === "part") entry.parts.push(row.category_id);
  }

  const additions: Array<{
    imagery_id: number;
    category_id: number;
    role: "primary" | "alternative";
  }> = [];
  for (const { imagery_id, category_id } of pairs) {
    const entry = known.get(imagery_id);
    if (!entry || entry.all.has(category_id)) continue;
    const role = entry.primary === null ? "primary" : "alternative";
    if (role === "primary") entry.primary = category_id;
    entry.all.add(category_id);
    additions.push({ imagery_id, category_id, role });
  }
  if (additions.length > 0) {
    const { error: insertError } = await supabase
      .from(TABLES.IMAGERY_MOTIFS)
      .upsert(additions, {
        onConflict: "imagery_id,category_id",
        ignoreDuplicates: true,
      });
    if (insertError) throw insertError;
  }
  return known;
}

/** 挂默认母题的标注，补上并列词其余组成的行（「风雨」标了风，再写一条雨） */
function withParts<T extends { imagery_id: number; category_id: number }>(
  rows: T[],
  motifs: ReadonlyMap<number, MotifInfo>,
): T[] {
  return rows.flatMap((row) => {
    const entry = motifs.get(row.imagery_id);
    if (!entry || entry.primary !== row.category_id) return [row];
    return [row, ...entry.parts.map((id) => ({ ...row, category_id: id }))];
  });
}

type SongWords = {
  lyrics: string | null;
  rows: Array<{
    id: number;
    imagery_id: number;
    category_id: number;
    name: string;
    lyric_timetag: string[];
  }>;
};

async function loadSongWords(
  supabase: UserClient,
  songId: number,
): Promise<SongWords> {
  const [song, occurrences] = await Promise.all([
    supabase.from(TABLES.MUSIC).select("lyrics").eq("id", songId).maybeSingle(),
    supabase
      .from(TABLES.IMAGERY_OCC)
      .select("id,imagery_id,category_id,lyric_timetag,imagery(name)")
      .eq("song_id", songId),
  ]);
  if (song.error) throw song.error;
  if (occurrences.error) throw occurrences.error;
  return {
    lyrics: (song.data as { lyrics: string | null } | null)?.lyrics ?? null,
    rows: ((occurrences.data ?? []) as Record<string, unknown>[]).map((r) => ({
      id: r.id as number,
      imagery_id: r.imagery_id as number,
      category_id: r.category_id as number,
      name: (r.imagery as { name?: string } | null)?.name ?? "",
      lyric_timetag: (r.lyric_timetag as string[] | null) ?? [],
    })),
  };
}

/**
 * 标注的词必须在歌词里字面出现，且不只出现在同曲更长的标注词里（见 IMAGERY.md）。
 * 歌词没有时间轴时无从核对，不拦。
 */
async function assertInLyrics(
  supabase: UserClient,
  songId: number,
  words: ReadonlyArray<{ imagery_id: number } | { imagery_name: string }>,
): Promise<void> {
  const ids = words.flatMap((w) => ("imagery_id" in w ? [w.imagery_id] : []));
  const [{ lyrics, rows }, found] = await Promise.all([
    loadSongWords(supabase, songId),
    ids.length > 0
      ? supabase.from(TABLES.IMAGERY).select("name").in("id", ids)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (found.error) throw found.error;
  const names = [
    ...((found.data ?? []) as { name: string }[]).map((r) => r.name),
    ...words.flatMap((w) => ("imagery_name" in w ? [w.imagery_name] : [])),
  ];
  const expected = songTimetags(lyrics, [...rows.map((r) => r.name), ...names]);
  if (!expected) return;
  const absent = names.filter((n) => (expected.get(n) ?? []).length === 0);
  if (absent.length > 0) {
    throw Object.assign(
      new Error(
        `歌词里没有「${absent.join("」「")}」，或只出现在同曲更长的标注词里`,
      ),
      { code: "IMAGERY_NOT_IN_LYRICS" },
    );
  }
}

/**
 * 按歌词重算一首歌全部标注的时间标签：恰好是词字面出现的行。
 * 增删一个词会改变同曲短词被覆盖的行（加了「岁月」，「月」就让出那几行），所以整首重算。
 * 歌词没有时间轴时不动。
 *
 * 返回标签有变动的标注所挂的母题，以及在歌词里一处都找不到的词（标签被清空，标注要人工处理）。
 */
async function syncSongTimetags(
  supabase: UserClient,
  songId: number,
): Promise<TimetagSyncResult> {
  const { lyrics, rows } = await loadSongWords(supabase, songId);
  const expected = songTimetags(lyrics, [...new Set(rows.map((r) => r.name))]);
  if (!expected) return { motifIds: [], notFound: [] };
  const motifIds = new Set<number>();
  for (const row of rows) {
    const tags = expected.get(row.name) ?? [];
    if (tags.join() === row.lyric_timetag.join()) continue;
    const { error } = await supabase
      .from(TABLES.IMAGERY_OCC)
      .update({ lyric_timetag: tags })
      .eq("id", row.id);
    if (error) throw error;
    motifIds.add(row.category_id);
  }
  const notFound = [...expected]
    .filter(([, tags]) => tags.length === 0)
    .map(([name]) => name);
  return { motifIds: [...motifIds], notFound };
}

export type TimetagSyncResult = { motifIds: number[]; notFound: string[] };

/**
 * 歌词发布到正式表后调用：按新歌词重算这首歌全部标注的时间标签。
 * 标注只挂在正式表的歌上，暂存表里改歌词不影响，所以在发布而不是暂存时同步。
 */
export async function resyncSongTimetags(
  songId: number,
  accessToken: string,
): Promise<TimetagSyncResult> {
  const supabase = getUserClient(accessToken);
  if (!supabase) throw new Error("Supabase client unavailable");
  return syncSongTimetags(supabase, songId);
}

/**
 * 新增标注的单项：imagery_id 指向已有的词，或 imagery_name 给出歌词里的原文（词典里没有时保存时创建）。
 * 手动添加与预标注审核都走 createOccurrencesBatch。时间标签由服务端按歌词算出
 */
export type OccurrenceBatchItem = {
  category_id: number;
} & ({ imagery_id: number } | { imagery_name: string });

function songNotPublished() {
  return Object.assign(new Error("歌曲尚未发布，发布后才能保存意象标注"), {
    code: "SONG_NOT_PUBLISHED",
  });
}

/**
 * 词名 → id：词典里有同名的直接用，没有的创建。
 * 调用前要先确认歌曲已发布、词都在歌词里，免得留下没有标注的词。
 */
async function resolveImageryNames(
  supabase: UserClient,
  names: readonly string[],
): Promise<{ idByName: Map<string, number>; created: number }> {
  const unique = [...new Set(names)];
  const idByName = new Map<string, number>();
  if (unique.length === 0) return { idByName, created: 0 };
  const { data: found, error: findError } = await supabase
    .from(TABLES.IMAGERY)
    .select("id,name")
    .in("name", unique);
  if (findError) throw findError;
  for (const row of (found ?? []) as { id: number; name: string }[]) {
    idByName.set(row.name, row.id);
  }
  const missing = unique.filter((n) => !idByName.has(n));
  if (missing.length > 0) {
    const { data: created, error: createError } = await supabase
      .from(TABLES.IMAGERY)
      .insert(missing.map((name) => ({ name })))
      .select("id,name");
    if (createError) throw createError;
    for (const row of (created ?? []) as { id: number; name: string }[]) {
      idByName.set(row.name, row.id);
    }
  }
  return { idByName, created: missing.length };
}

/**
 * 为一首歌新增意象标注：手动添加一条，或预标注审核后一次提交多条。
 *
 * - 词名若已存在同名的词则直接复用，否则创建；创建前先确认歌曲已发布、词都在歌词里，避免留下孤立的词
 * - 解析后指向同一个词的多项合并为一条（母题取第一项）；写入后按歌词重算整首的时间标签
 * - 所选母题不在该词的候选里时登记为候选；挂默认母题的并列词补写其余组成
 * - 该歌已标注过的词会被跳过，避免重复提交或并发编辑产生重复行
 */
export async function createOccurrencesBatch(
  songId: number,
  items: OccurrenceBatchItem[],
  accessToken: string,
): Promise<{ created: number; skipped: number; newImagery: number }> {
  if (items.length === 0) return { created: 0, skipped: 0, newImagery: 0 };
  const supabase = getUserClient(accessToken);
  if (!supabase) throw new Error("Supabase client unavailable");
  await assertMotifs(
    supabase,
    items.map((i) => i.category_id),
  );

  const { data: song, error: songError } = await supabase
    .from(TABLES.MUSIC)
    .select("id")
    .eq("id", songId)
    .maybeSingle();
  if (songError) throw songError;
  if (!song) throw songNotPublished();
  await assertInLyrics(supabase, songId, items);

  const { idByName, created: newImagery } = await resolveImageryNames(
    supabase,
    items.flatMap((i) => ("imagery_name" in i ? [i.imagery_name] : [])),
  );

  // ── 按词合并 ──
  const merged = new Map<
    number,
    { imagery_id: number; category_id: number; lyric_timetag: string[] }
  >();
  for (const item of items) {
    const imageryId =
      "imagery_id" in item ? item.imagery_id : idByName.get(item.imagery_name);
    if (imageryId === undefined) throw new Error("意象创建失败");
    if (!merged.has(imageryId)) {
      merged.set(imageryId, {
        imagery_id: imageryId,
        category_id: item.category_id,
        lyric_timetag: [],
      });
    }
  }

  const { data: existing, error: existingError } = await supabase
    .from(TABLES.IMAGERY_OCC)
    .select("imagery_id")
    .eq("song_id", songId);
  if (existingError) throw existingError;
  const taken = new Set(
    ((existing ?? []) as { imagery_id: number }[]).map((r) => r.imagery_id),
  );
  const fresh = [...merged.values()].filter(
    (item) => !taken.has(item.imagery_id),
  );
  const skipped = merged.size - fresh.length;
  if (fresh.length === 0) return { created: 0, skipped, newImagery };

  const motifs = await registerMotifs(supabase, fresh);
  const rows = withParts(
    fresh.map((item) => ({ ...item, song_id: songId })),
    motifs,
  );

  const { error } = await supabase.from(TABLES.IMAGERY_OCC).insert(rows);
  if (error) {
    // 上面已确认歌曲存在；这里兜底发布状态在两次请求之间变化的情况
    if (error.code === "23503" && error.message.includes("song_id")) {
      throw songNotPublished();
    }
    throw error;
  }
  await syncSongTimetags(supabase, songId);
  return { created: fresh.length, skipped, newImagery };
}

/**
 * 标注改挂母题后，默认母题跟着走：词在原母题下已没有任何标注、而原母题是它的默认母题时，
 * 新母题升为默认，原母题的登记删掉。原母题多半是当初这条标注自动登记的
 * （「汗」先挂了新建的母题汗、后改成身躯，汗却一直是它的默认母题，整理时也删不掉）。
 */
async function followPrimary(
  supabase: UserClient,
  imageryId: number,
  from: number,
  to: number,
): Promise<void> {
  if (from === to) return;
  const [registration, remaining] = await Promise.all([
    supabase
      .from(TABLES.IMAGERY_MOTIFS)
      .select("role")
      .eq("imagery_id", imageryId)
      .eq("category_id", from)
      .maybeSingle(),
    supabase
      .from(TABLES.IMAGERY_OCC)
      .select("id")
      .eq("imagery_id", imageryId)
      .eq("category_id", from)
      .limit(1),
  ]);
  if (registration.error) throw registration.error;
  if (remaining.error) throw remaining.error;
  if ((registration.data as { role?: string } | null)?.role !== "primary") {
    return;
  }
  if (((remaining.data ?? []) as unknown[]).length > 0) return;
  const { error: deleteError } = await supabase
    .from(TABLES.IMAGERY_MOTIFS)
    .delete()
    .eq("imagery_id", imageryId)
    .eq("category_id", from);
  if (deleteError) throw deleteError;
  const { error } = await supabase
    .from(TABLES.IMAGERY_MOTIFS)
    .upsert(
      { imagery_id: imageryId, category_id: to, role: "primary" },
      { onConflict: "imagery_id,category_id" },
    );
  if (error) throw error;
}

/**
 * 改一条标注的词或母题。词可以给 imagery_id，也可以给 imagery_name（词典里没有时创建）。
 * 时间标签不由调用方给出：改动后按歌词重算整首
 */
export async function updateOccurrence(
  id: number,
  data: {
    imagery_id?: number;
    imagery_name?: string;
    category_id?: number;
  },
  accessToken: string,
) {
  const supabase = getUserClient(accessToken);
  if (!supabase) throw new Error("Supabase client unavailable");
  if (data.category_id !== undefined) {
    await assertMotifs(supabase, [data.category_id]);
  }
  const { data: current, error: currentError } = await supabase
    .from(TABLES.IMAGERY_OCC)
    .select("song_id,imagery_id,category_id")
    .eq("id", id)
    .single();
  if (currentError) throw currentError;
  const before = current as {
    song_id: number;
    imagery_id: number;
    category_id: number;
  };

  let imageryId = data.imagery_id ?? before.imagery_id;
  if (data.imagery_name !== undefined) {
    await assertInLyrics(supabase, before.song_id, [
      { imagery_name: data.imagery_name },
    ]);
    const { idByName } = await resolveImageryNames(supabase, [
      data.imagery_name,
    ]);
    const resolved = idByName.get(data.imagery_name);
    if (resolved === undefined) throw new Error("意象创建失败");
    imageryId = resolved;
  } else if (imageryId !== before.imagery_id) {
    await assertInLyrics(supabase, before.song_id, [{ imagery_id: imageryId }]);
  }
  const categoryId = data.category_id ?? before.category_id;
  if (data.category_id !== undefined || imageryId !== before.imagery_id) {
    await registerMotifs(supabase, [
      { imagery_id: imageryId, category_id: categoryId },
    ]);
  }

  const { error } = await supabase
    .from(TABLES.IMAGERY_OCC)
    .update({ imagery_id: imageryId, category_id: categoryId })
    .eq("id", id)
    .select("id")
    .single();
  if (error) throw error;
  if (imageryId === before.imagery_id) {
    await followPrimary(supabase, imageryId, before.category_id, categoryId);
  } else {
    await syncSongTimetags(supabase, before.song_id);
  }
  return getOccurrenceWithRelationsById(id, accessToken);
}

export async function deleteOccurrence(id: number, accessToken: string) {
  const supabase = getUserClient(accessToken);
  if (!supabase) throw new Error("Supabase client unavailable");
  const { data, error } = await supabase
    .from(TABLES.IMAGERY_OCC)
    .delete()
    .eq("id", id)
    .select("song_id");
  if (error) throw error;
  // 删掉长词后，被它覆盖的短词要拿回那几行
  const songId = (data as { song_id: number }[] | null)?.[0]?.song_id;
  if (songId !== undefined) await syncSongTimetags(supabase, songId);
}

// ─── public read functions ─────────────────────────────────────────────────────

/**
 * 意象页内容的最后变更时间，供 sitemap 使用。
 * imagery 表只有 created_at——该页内容以新增意象为主，取最新一条的创建时间
 * 作为近似；对已有意象的文字修订无法反映，属于可接受的偏晚上报。
 */
export const getImageryLastModified = cache(
  async function getImageryLastModified(): Promise<Date | null> {
    const supabase = getServiceClient();
    if (!supabase) return null;
    try {
      const { data, error } = await supabase
        .from(TABLES.IMAGERY)
        .select("created_at")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error || !data?.created_at) return null;
      const parsed = new Date(data.created_at as string);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    } catch (e) {
      console.error("[getImageryLastModified]", e);
      return null;
    }
  },
);
