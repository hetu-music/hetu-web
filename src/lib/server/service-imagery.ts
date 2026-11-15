import { cache } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getServiceClient,
  getUserClient,
  fetchAll,
  TABLES,
} from "@/lib/db/supabase-server";
import {
  songTimetags,
  withTimetags,
  type VersionWords,
} from "@/lib/imagery/consistency";
import {
  ensureDraft,
  SongVersionError,
  workingVersionId,
} from "@/lib/server/service-versions";
import type { MotifEntry } from "@/lib/imagery/suggest";
import type {
  ImageryCategory,
  ImageryItem,
  ImageryTaxonomy,
  Motif,
} from "@/lib/types";

/**
 * 后台的意象标注：一条标注一行（工作版本，有草稿用草稿）。
 * part_motif_ids 是读时展开的「同时算进」，lyric_timetag 按同一版本的歌词算，都不存（DATABASE.md 第四节）。
 * 行的 id 在各版本间不变，开草稿前后都能用来定位（见 service-versions）
 */
export type OccurrenceWithSong = {
  id: number;
  song_id: number;
  version_id: number;
  imagery_id: number;
  motif_id: number;
  /** 挂在词的默认母题上时一并算进的母题（「风雨」的雨） */
  part_motif_ids: number[];
  lyric_timetag: string[];
  song_title: string;
  song_album: string | null;
  imagery_name?: string;
  motif_name?: string;
};

type UserClient = NonNullable<ReturnType<typeof getUserClient>>;

const OCCURRENCE_FIELDS =
  "id,song_id,version_id,imagery_id,motif_id,part_motif_ids,song_title,song_album,imagery_name,motif_name";

type OccurrenceRow = Omit<OccurrenceWithSong, "lyric_timetag">;

function mapOccurrenceRow(row: Record<string, unknown>): OccurrenceRow {
  return {
    id: row.id as number,
    song_id: row.song_id as number,
    version_id: row.version_id as number,
    imagery_id: row.imagery_id as number,
    motif_id: row.motif_id as number,
    part_motif_ids: (row.part_motif_ids as number[] | null) ?? [],
    song_title: (row.song_title as string | null) ?? "",
    song_album: (row.song_album as string | null) ?? null,
    imagery_name: (row.imagery_name as string | null) ?? undefined,
    motif_name: (row.motif_name as string | null) ?? undefined,
  };
}

// ─── 时间标签 ─────────────────────────────────────────────────────────────────

/** 各版本的歌词与它标注的全部词名：算时间标签时要排除被同曲更长词覆盖的行 */
async function loadVersionWords(
  supabase: SupabaseClient,
  versionIds: readonly number[],
): Promise<Map<number, VersionWords>> {
  const ids = [...new Set(versionIds)];
  if (ids.length === 0) return new Map();
  const [versions, words] = await Promise.all([
    fetchAll<{ id: number; lyrics: string | null }>(
      supabase,
      TABLES.SONG_VERSIONS,
      "id,lyrics",
      (q) => q.in("id", ids).order("id"),
    ),
    fetchAll<{ version_id: number; imagery: { name?: string } | null }>(
      supabase,
      TABLES.SONG_IMAGERY,
      "version_id,imagery(name)",
      (q) => q.in("version_id", ids).order("version_id").order("id"),
    ),
  ]);
  const names = new Map<number, string[]>();
  for (const w of words) {
    const name = w.imagery?.name;
    if (!name) continue;
    names.set(w.version_id, [...(names.get(w.version_id) ?? []), name]);
  }
  return new Map(
    versions.map((v) => [
      v.id,
      { lyrics: v.lyrics, names: names.get(v.id) ?? [] },
    ]),
  );
}

/** 给后台读到的标注补上时间标签 */
async function attachTimetags(
  supabase: SupabaseClient,
  rows: OccurrenceRow[],
): Promise<OccurrenceWithSong[]> {
  const versions = await loadVersionWords(
    supabase,
    rows.map((r) => r.version_id),
  );
  return withTimetags(
    rows.map((r) => ({ ...r, imagery_name: r.imagery_name ?? "" })),
    versions,
  );
}

// ─── read functions ───────────────────────────────────────────────────────────

/** 类别与母题。cache(): 同一次请求内 generateMetadata 与页面组件各调一次，去重成一次查询 */
export const getImageryTaxonomy = cache(
  async function getImageryTaxonomy(): Promise<ImageryTaxonomy> {
    const supabase = getServiceClient();
    if (!supabase) return { categories: [], motifs: [] };
    const [categories, motifs] = await Promise.all([
      fetchAll<ImageryCategory>(
        supabase,
        TABLES.IMAGERY_CAT,
        "id,name,domain,description",
      ),
      fetchAll<Motif>(
        supabase,
        TABLES.MOTIFS,
        "id,name,category_id,description",
      ),
    ]);
    return { categories, motifs };
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
          "imagery_id,motif_id,role",
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
          entries.filter((m) => m.role === role).map((m) => m.motif_id);
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

async function readOccurrences(
  label: string,
  filter: { column: "imagery_id" | "song_id"; value: number },
): Promise<OccurrenceWithSong[]> {
  const supabase = getServiceClient();
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from(TABLES.WORKING_SONG_IMAGERY)
      .select(OCCURRENCE_FIELDS)
      .eq(filter.column, filter.value);
    if (error) {
      console.error(`[${label}]`, error);
      return [];
    }
    return await attachTimetags(
      supabase,
      ((data ?? []) as Record<string, unknown>[]).map(mapOccurrenceRow),
    );
  } catch (e) {
    console.error(`[${label}]`, e);
    return [];
  }
}

export function getOccurrencesForImagery(
  imageryId: number,
): Promise<OccurrenceWithSong[]> {
  return readOccurrences("getOccurrencesForImagery", {
    column: "imagery_id",
    value: imageryId,
  });
}

export function getOccurrencesForSong(
  songId: number,
): Promise<OccurrenceWithSong[]> {
  return readOccurrences("getOccurrencesForSong", {
    column: "song_id",
    value: songId,
  });
}

async function getOccurrenceWithRelationsById(
  supabase: UserClient,
  id: number,
): Promise<OccurrenceWithSong> {
  const { data, error } = await supabase
    .from(TABLES.WORKING_SONG_IMAGERY)
    .select(OCCURRENCE_FIELDS)
    .eq("id", id)
    .single();
  if (error) throw error;
  const [row] = await attachTimetags(supabase, [
    mapOccurrenceRow(data as Record<string, unknown>),
  ]);
  return row;
}

// ─── 在用的标注 ───────────────────────────────────────────────────────────────

type AnnotationInUse = {
  imagery_id: number;
  motif_id: number;
  part_motif_ids: number[] | null;
};

/**
 * 母题、词登记还有没有标注在用：看每首歌的工作版本与线上版本。
 * 只看工作版本的话，草稿里改掉了、线上还在用的母题会被当成空的删掉；历史版本不算。
 * 按母题筛时只看标注直接挂的母题，不看「同时算进」。
 */
async function annotationsInUse(
  supabase: UserClient,
  filter?: { imageryId?: number; motifId?: number },
): Promise<AnnotationInUse[]> {
  const read = (table: string) =>
    fetchAll<AnnotationInUse>(
      supabase,
      table,
      "imagery_id,motif_id,part_motif_ids",
      (q) => {
        let query = q;
        if (filter?.imageryId !== undefined)
          query = query.eq("imagery_id", filter.imageryId);
        if (filter?.motifId !== undefined)
          query = query.eq("motif_id", filter.motifId);
        return query;
      },
    );
  const [working, published] = await Promise.all([
    read(TABLES.WORKING_SONG_IMAGERY),
    read(TABLES.PUBLISHED_SONG_IMAGERY),
  ]);
  return [...working, ...published];
}

// ─── write functions: 母题 ────────────────────────────────────────────────────
// 门类与类别固定，增减要先讨论（见 IMAGERY.md），后台只增改母题。
// 词不单独新建或改名：词在标注时按歌词原文创建，改名会让它的标注全部对不上歌词。

function badRequest(message: string, code: string) {
  return Object.assign(new Error(message), { code });
}

const MOTIF_FIELDS = "id,name,category_id,description";

async function assertCategory(supabase: UserClient, categoryId: number) {
  const { data, error } = await supabase
    .from(TABLES.IMAGERY_CAT)
    .select("id")
    .eq("id", categoryId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw badRequest("没有这个类别", "INVALID_CATEGORY");
}

export async function createMotif(
  data: { name: string; category_id: number; description: string },
  accessToken: string,
): Promise<Motif> {
  const supabase = getUserClient(accessToken);
  if (!supabase) throw new Error("Supabase client unavailable");
  await assertCategory(supabase, data.category_id);
  const { data: created, error } = await supabase
    .from(TABLES.MOTIFS)
    .insert(data)
    .select(MOTIF_FIELDS)
    .single();
  if (error) throw error;
  return created as Motif;
}

export async function updateMotif(
  id: number,
  data: { name?: string; category_id?: number; description?: string },
  accessToken: string,
): Promise<Motif> {
  const supabase = getUserClient(accessToken);
  if (!supabase) throw new Error("Supabase client unavailable");
  await assertMotifs(supabase, [id]);
  if (data.category_id !== undefined) {
    await assertCategory(supabase, data.category_id);
  }
  const { data: updated, error } = await supabase
    .from(TABLES.MOTIFS)
    .update(data)
    .eq("id", id)
    .select(MOTIF_FIELDS)
    .single();
  if (error) throw error;
  return updated as Motif;
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
 * 去掉的默认母题或多义候选下若还有这个词的标注，拒绝：那些标注会落到候选之外。
 * 「同时算进」是读时展开的，增删随时生效，不拦。
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
    throw badRequest("同一个母题只能出现一次", "DUPLICATE_MOTIF");
  }
  const supabase = getUserClient(accessToken);
  if (!supabase) throw new Error("Supabase client unavailable");
  await assertMotifs(supabase, [...wanted.keys()]);

  const [current, occurrences] = await Promise.all([
    supabase
      .from(TABLES.IMAGERY_MOTIFS)
      .select("motif_id,role")
      .eq("imagery_id", imageryId),
    annotationsInUse(supabase, { imageryId }),
  ]);
  if (current.error) throw current.error;
  const rows = (current.data ?? []) as Array<{
    motif_id: number;
    role: MotifEntry["role"];
  }>;
  const annotated = new Set(occurrences.map((o) => o.motif_id));

  const removed = rows.map((r) => r.motif_id).filter((id) => !wanted.has(id));
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
      .in("motif_id", removed);
    if (error) throw error;
  }
  const oldPrimary = rows.find((r) => r.role === "primary")?.motif_id;
  if (
    oldPrimary !== undefined &&
    oldPrimary !== next.primary &&
    wanted.has(oldPrimary)
  ) {
    const { error } = await supabase
      .from(TABLES.IMAGERY_MOTIFS)
      .update({ role: "alternative" })
      .eq("imagery_id", imageryId)
      .eq("motif_id", oldPrimary);
    if (error) throw error;
  }
  // 主键 (imagery_id, motif_id)：已有的行改 role，新的行插入；primary 放最后写
  const upserts = [...wanted]
    .map(([motif_id, role]) => ({ imagery_id: imageryId, motif_id, role }))
    .sort(
      (a, b) => Number(a.role === "primary") - Number(b.role === "primary"),
    );
  const { error } = await supabase
    .from(TABLES.IMAGERY_MOTIFS)
    .upsert(upserts, { onConflict: "imagery_id,motif_id" });
  if (error) throw error;
  return next;
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
export type UnusedMotif = Motif & { words: UnusedMotifWord[] };

/**
 * 没用上的母题：没有标注挂在它上面，也没有标注「同时算进」它（任一首歌的工作版本、线上版本都算，见 annotationsInUse）。
 * 词登记不算用上：标注改挂别的母题后，原来自动登记的默认母题会留在 imagery_motifs 里
 * （「汗」先标了母题汗、后改成身躯，汗仍是它的默认母题），整理时把登记一并处理掉。
 * 类别固定（见 IMAGERY.md），不在整理范围内。
 */
async function findUnusedMotifs(supabase: UserClient): Promise<UnusedMotif[]> {
  const [motifRows, registrationsAll, occurrences] = await Promise.all([
    fetchAll<Motif>(supabase, TABLES.MOTIFS, MOTIF_FIELDS),
    fetchAll<MotifEntry>(
      supabase,
      TABLES.IMAGERY_MOTIFS,
      "imagery_id,motif_id,role",
    ),
    annotationsInUse(supabase),
  ]);
  const annotated = new Set(
    occurrences.flatMap((o) => [o.motif_id, ...(o.part_motif_ids ?? [])]),
  );
  const unused = motifRows.filter((m) => !annotated.has(m.id));
  if (unused.length === 0) return [];

  const unusedIds = new Set(unused.map((m) => m.id));
  const registrations = registrationsAll.filter((m) =>
    unusedIds.has(m.motif_id),
  );
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

  const motifName = new Map(motifRows.map((m) => [m.id, m.name]));
  const promoteTo = (wordId: number) => {
    const counts = new Map<number, number>();
    for (const o of occurrences) {
      if (o.imagery_id !== wordId) continue;
      counts.set(o.motif_id, (counts.get(o.motif_id) ?? 0) + 1);
    }
    const alternatives = registrationsAll
      .filter(
        (m) =>
          m.imagery_id === wordId &&
          m.role === "alternative" &&
          !unusedIds.has(m.motif_id),
      )
      .map((m) => m.motif_id);
    const pool = alternatives.length > 0 ? alternatives : [...counts.keys()];
    const [id] = pool.sort(
      (a, b) => (counts.get(b) ?? 0) - (counts.get(a) ?? 0),
    );
    return id === undefined
      ? null
      : { id, name: motifName.get(id) ?? `#${id}` };
  };

  return unused.map((m) => ({
    ...m,
    words: registrations
      .filter((r) => r.motif_id === m.id)
      .map((r) => ({
        id: r.imagery_id,
        name: wordName.get(r.imagery_id) ?? `#${r.imagery_id}`,
        role: r.role,
        ...(r.role === "primary" ? { promoteTo: promoteTo(r.imagery_id) } : {}),
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
 * 顺序：先删这些母题的词登记（motif_id 是 on delete restrict），再给默认母题被删的词
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
  const targets = (await findUnusedMotifs(supabase)).filter((m) =>
    wanted.has(m.id),
  );
  if (targets.length === 0) return { deleted: [], promoted: [] };
  const targetIds = targets.map((m) => m.id);

  if (targets.some((m) => m.words.length > 0)) {
    const { error } = await supabase
      .from(TABLES.IMAGERY_MOTIFS)
      .delete()
      .in("motif_id", targetIds);
    if (error) throw error;
  }

  const promotions = targets.flatMap((m) =>
    m.words.flatMap((w) =>
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
        motif_id: p.motif.id,
        role: "primary" as const,
      })),
      { onConflict: "imagery_id,motif_id" },
    );
    if (error) throw error;
  }

  const { data, error } = await supabase
    .from(TABLES.MOTIFS)
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

/** 标注与词登记只能挂在母题上（外键也会拦，这里给出能看懂的错误） */
async function assertMotifs(
  supabase: UserClient,
  motifIds: readonly number[],
): Promise<void> {
  const ids = [...new Set(motifIds)];
  if (ids.length === 0) return;
  const { data, error } = await supabase
    .from(TABLES.MOTIFS)
    .select("id")
    .in("id", ids);
  if (error) throw error;
  const found = new Set(((data ?? []) as { id: number }[]).map((m) => m.id));
  if (ids.some((id) => !found.has(id))) {
    throw badRequest("只能挂到母题上", "NOT_MOTIF");
  }
}

// ─── write functions: occurrences ─────────────────────────────────────────────

/**
 * 保证标注挂的母题登记在该词的候选里（见 IMAGERY.md）：
 * 从未登记母题的新词，以这次选的母题为默认；已登记的词选了候选之外的母题，登记为多义候选。
 */
async function registerMotifs(
  supabase: UserClient,
  pairs: ReadonlyArray<{ imagery_id: number; motif_id: number }>,
): Promise<void> {
  const ids = [...new Set(pairs.map((p) => p.imagery_id))];
  const { data, error } = await supabase
    .from(TABLES.IMAGERY_MOTIFS)
    .select("imagery_id,motif_id,role")
    .in("imagery_id", ids);
  if (error) throw error;

  const known = new Map<number, { primary: number | null; all: Set<number> }>(
    ids.map((id) => [id, { primary: null, all: new Set() }]),
  );
  for (const row of (data ?? []) as MotifEntry[]) {
    const entry = known.get(row.imagery_id);
    if (!entry) continue;
    entry.all.add(row.motif_id);
    if (row.role === "primary") entry.primary = row.motif_id;
  }

  const additions: Array<{
    imagery_id: number;
    motif_id: number;
    role: "primary" | "alternative";
  }> = [];
  for (const { imagery_id, motif_id } of pairs) {
    const entry = known.get(imagery_id);
    if (!entry || entry.all.has(motif_id)) continue;
    const role = entry.primary === null ? "primary" : "alternative";
    if (role === "primary") entry.primary = motif_id;
    entry.all.add(motif_id);
    additions.push({ imagery_id, motif_id, role });
  }
  if (additions.length > 0) {
    const { error: insertError } = await supabase
      .from(TABLES.IMAGERY_MOTIFS)
      .upsert(additions, {
        onConflict: "imagery_id,motif_id",
        ignoreDuplicates: true,
      });
    if (insertError) throw insertError;
  }
}

/**
 * 标注的词必须在歌词里字面出现，且不只出现在同曲更长的标注词里（见 IMAGERY.md）。
 * 歌词没有时间轴时无从核对，不拦。
 */
async function assertInLyrics(
  supabase: UserClient,
  versionId: number,
  words: ReadonlyArray<{ imagery_id: number } | { imagery_name: string }>,
): Promise<void> {
  const ids = words.flatMap((w) => ("imagery_id" in w ? [w.imagery_id] : []));
  const [versions, found] = await Promise.all([
    loadVersionWords(supabase, [versionId]),
    ids.length > 0
      ? supabase.from(TABLES.IMAGERY).select("name").in("id", ids)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (found.error) throw found.error;
  const version = versions.get(versionId);
  const names = [
    ...((found.data ?? []) as { name: string }[]).map((r) => r.name),
    ...words.flatMap((w) => ("imagery_name" in w ? [w.imagery_name] : [])),
  ];
  const expected = songTimetags(version?.lyrics, [
    ...(version?.names ?? []),
    ...names,
  ]);
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
 * 发布前的核对：工作版本里歌词找不到的标注词（改了歌词后常见）。
 * 只提示，不拦发布；要到意象页签删掉或改标。
 */
export async function wordsMissingFromLyrics(
  songId: number,
  accessToken: string,
): Promise<string[]> {
  const supabase = getUserClient(accessToken);
  if (!supabase) throw new Error("Supabase client unavailable");
  const versionId = await workingVersionId(supabase, songId);
  if (versionId === null) return [];
  const version = (await loadVersionWords(supabase, [versionId])).get(
    versionId,
  );
  const expected = songTimetags(version?.lyrics, version?.names ?? []);
  if (!expected) return [];
  return [...expected]
    .filter(([, tags]) => tags.length === 0)
    .map(([name]) => name);
}

/**
 * 新增标注的单项：imagery_id 指向已有的词，或 imagery_name 给出歌词里的原文（词典里没有时保存时创建）。
 * 手动添加与预标注审核都走 createOccurrencesBatch。时间标签读时按歌词算，不用给
 */
export type OccurrenceBatchItem = {
  motif_id: number;
} & ({ imagery_id: number } | { imagery_name: string });

function songNotFound() {
  return Object.assign(new Error("歌曲不存在"), { code: "SONG_NOT_FOUND" });
}

function duplicateWord() {
  return badRequest("这首歌已经标注过这个词", "DUPLICATE_OCCURRENCE");
}

/** 写之前先按工作版本校验，过了再开草稿：校验不过不留下空草稿 */
async function workingVersionOrThrow(
  supabase: UserClient,
  songId: number,
): Promise<number> {
  const versionId = await workingVersionId(supabase, songId);
  if (versionId === null) throw songNotFound();
  return versionId;
}

/** 开草稿；歌在两次请求之间被删了也报「歌曲不存在」 */
async function draftOf(supabase: UserClient, songId: number): Promise<number> {
  try {
    return await ensureDraft(supabase, songId);
  } catch (e) {
    if (e instanceof SongVersionError && e.status === 404) throw songNotFound();
    throw e;
  }
}

/**
 * 词名 → id：词典里有同名的直接用，没有的创建。
 * 调用前要先确认歌曲存在、词都在歌词里，免得留下没有标注的词。
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
 * - 词名若已存在同名的词则直接复用，否则创建；创建前先确认歌曲存在、词都在歌词里，避免留下孤立的词
 * - 写在这首歌的草稿上（没有就开一份），发布后才上线
 * - 解析后指向同一个词的多项合并为一条（母题取第一项）
 * - 所选母题不在该词的候选里时登记为候选；「同时算进」读时展开，不另写
 * - 该歌已标注过的词会被跳过（一个版本里一个词只有一条，库里有唯一约束）
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
    items.map((i) => i.motif_id),
  );

  const working = await workingVersionOrThrow(supabase, songId);
  await assertInLyrics(supabase, working, items);

  const { idByName, created: newImagery } = await resolveImageryNames(
    supabase,
    items.flatMap((i) => ("imagery_name" in i ? [i.imagery_name] : [])),
  );

  // ── 按词合并 ──
  const merged = new Map<number, { imagery_id: number; motif_id: number }>();
  for (const item of items) {
    const imageryId =
      "imagery_id" in item ? item.imagery_id : idByName.get(item.imagery_name);
    if (imageryId === undefined) throw new Error("意象创建失败");
    if (!merged.has(imageryId)) {
      merged.set(imageryId, { imagery_id: imageryId, motif_id: item.motif_id });
    }
  }

  const draft = await draftOf(supabase, songId);
  const { data: existing, error: existingError } = await supabase
    .from(TABLES.SONG_IMAGERY)
    .select("imagery_id")
    .eq("version_id", draft);
  if (existingError) throw existingError;
  const taken = new Set(
    ((existing ?? []) as { imagery_id: number }[]).map((r) => r.imagery_id),
  );
  const fresh = [...merged.values()].filter(
    (item) => !taken.has(item.imagery_id),
  );
  const skipped = merged.size - fresh.length;
  if (fresh.length === 0) return { created: 0, skipped, newImagery };

  await registerMotifs(supabase, fresh);
  const { error } = await supabase
    .from(TABLES.SONG_IMAGERY)
    .insert(fresh.map((item) => ({ ...item, version_id: draft })));
  if (error) {
    // 草稿在两次请求之间被放弃或歌被删了
    if (error.code === "23503" && error.message.includes("version_id")) {
      throw songNotFound();
    }
    // 两个请求同时给这首歌标了同一个词
    if (error.code === "23505") throw duplicateWord();
    throw error;
  }
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
      .eq("motif_id", from)
      .maybeSingle(),
    annotationsInUse(supabase, { imageryId, motifId: from }),
  ]);
  if (registration.error) throw registration.error;
  if ((registration.data as { role?: string } | null)?.role !== "primary") {
    return;
  }
  if (remaining.length > 0) return;
  const { error: deleteError } = await supabase
    .from(TABLES.IMAGERY_MOTIFS)
    .delete()
    .eq("imagery_id", imageryId)
    .eq("motif_id", from);
  if (deleteError) throw deleteError;
  const { error } = await supabase
    .from(TABLES.IMAGERY_MOTIFS)
    .upsert(
      { imagery_id: imageryId, motif_id: to, role: "primary" },
      { onConflict: "imagery_id,motif_id" },
    );
  if (error) throw error;
}

/**
 * 改一条标注的词或母题。词可以给 imagery_id，也可以给 imagery_name（词典里没有时创建）。
 * 改在草稿上（没有就开一份）。时间标签与「同时算进」都是读时算的，改完自然跟着变
 */
export async function updateOccurrence(
  id: number,
  data: {
    imagery_id?: number;
    imagery_name?: string;
    motif_id?: number;
  },
  accessToken: string,
): Promise<OccurrenceWithSong> {
  const supabase = getUserClient(accessToken);
  if (!supabase) throw new Error("Supabase client unavailable");
  if (data.motif_id !== undefined) {
    await assertMotifs(supabase, [data.motif_id]);
  }
  const { data: current, error: currentError } = await supabase
    .from(TABLES.WORKING_SONG_IMAGERY)
    .select("song_id,version_id,imagery_id,motif_id")
    .eq("id", id)
    .single();
  if (currentError) throw currentError;
  const before = current as {
    song_id: number;
    version_id: number;
    imagery_id: number;
    motif_id: number;
  };

  let imageryId = data.imagery_id ?? before.imagery_id;
  if (data.imagery_name !== undefined) {
    await assertInLyrics(supabase, before.version_id, [
      { imagery_name: data.imagery_name },
    ]);
    const { idByName } = await resolveImageryNames(supabase, [
      data.imagery_name,
    ]);
    const resolved = idByName.get(data.imagery_name);
    if (resolved === undefined) throw new Error("意象创建失败");
    imageryId = resolved;
  } else if (imageryId !== before.imagery_id) {
    await assertInLyrics(supabase, before.version_id, [
      { imagery_id: imageryId },
    ]);
  }
  const motifId = data.motif_id ?? before.motif_id;
  if (motifId === before.motif_id && imageryId === before.imagery_id) {
    return getOccurrenceWithRelationsById(supabase, id);
  }
  await registerMotifs(supabase, [
    { imagery_id: imageryId, motif_id: motifId },
  ]);

  const draft = await draftOf(supabase, before.song_id);
  const { error } = await supabase
    .from(TABLES.SONG_IMAGERY)
    .update({ imagery_id: imageryId, motif_id: motifId })
    .eq("version_id", draft)
    .eq("id", id)
    .select("id")
    .single();
  if (error) {
    if (error.code === "23505") throw duplicateWord();
    throw error;
  }
  if (imageryId === before.imagery_id) {
    await followPrimary(supabase, imageryId, before.motif_id, motifId);
  }
  return getOccurrenceWithRelationsById(supabase, id);
}

/**
 * 删掉一条标注，删在草稿上（没有就开一份）。
 * 返回它算进的母题（含「同时算进」）；标注不存在时返回 null
 */
export async function deleteOccurrence(
  id: number,
  accessToken: string,
): Promise<{ songId: number; motifIds: number[] } | null> {
  const supabase = getUserClient(accessToken);
  if (!supabase) throw new Error("Supabase client unavailable");
  const { data: row, error: rowError } = await supabase
    .from(TABLES.WORKING_SONG_IMAGERY)
    .select("song_id,motif_id,part_motif_ids")
    .eq("id", id)
    .maybeSingle();
  if (rowError) throw rowError;
  if (!row) return null;
  const found = row as {
    song_id: number;
    motif_id: number;
    part_motif_ids: number[] | null;
  };
  const draft = await draftOf(supabase, found.song_id);
  const { error } = await supabase
    .from(TABLES.SONG_IMAGERY)
    .delete()
    .eq("version_id", draft)
    .eq("id", id);
  if (error) throw error;
  return {
    songId: found.song_id,
    motifIds: [found.motif_id, ...(found.part_motif_ids ?? [])],
  };
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
