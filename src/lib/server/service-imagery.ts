import { cache } from "react";
import {
  getServiceClient,
  getUserClient,
  fetchAll,
  TABLES,
} from "@/lib/db/supabase-server";
import { songTimetags } from "@/lib/imagery/consistency";
import type {
  ImageryCategory,
  ImageryItem,
  ImageryMeaning,
  SongRef,
} from "@/lib/types";

export type OccurrenceWithSong = {
  id: number;
  song_id: number;
  imagery_id: number;
  category_id: number;
  meaning_id: number | null;
  lyric_timetag: string[];
  song_title: string;
  song_album: string | null;
  imagery_name?: string;
  category_name?: string;
  meaning_label?: string | null;
};

// ─── helper ───────────────────────────────────────────────────────────────────

function mapOccurrenceRow(row: Record<string, unknown>): OccurrenceWithSong {
  const music = row.music as { title?: string; album?: string } | null;
  const imagery = row.imagery as { name?: string } | null;
  const imageryCategories = row.imagery_categories as { name?: string } | null;
  const imageryMeanings = row.imagery_meanings as { label?: string } | null;
  return {
    id: row.id as number,
    song_id: row.song_id as number,
    imagery_id: row.imagery_id as number,
    category_id: row.category_id as number,
    meaning_id: (row.meaning_id as number | null) ?? null,
    lyric_timetag: (row.lyric_timetag as string[]) ?? [],
    song_title: music?.title ?? "",
    song_album: music?.album ?? null,
    imagery_name: imagery?.name,
    category_name: imageryCategories?.name,
    meaning_label: imageryMeanings?.label ?? null,
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

// cache(): 同上，意象页两处调用去重
export const getImageryWithCounts = cache(
  async function getImageryWithCounts(): Promise<ImageryItem[]> {
    const supabase = getServiceClient();
    if (!supabase) return [];
    try {
      const rows = (await fetchAll(
        supabase,
        TABLES.IMAGERY_SUMMARY,
        'id,name,count,"categoryIds"',
      )) as Array<{
        id: number;
        name: string;
        count: number | null;
        categoryIds: Array<number | string> | null;
      }>;

      return rows.map((item) => ({
        id: item.id,
        name: item.name,
        count: item.count ?? 0,
        categoryIds: (item.categoryIds ?? [])
          .map((value) => Number(value))
          .filter(Number.isFinite),
        meaningCount: 0,
      }));
    } catch (e) {
      console.error("[getImageryWithCounts]", e);
      return [];
    }
  },
);

/* ─────────────────────────────────────────────────────────────────────────────
 * ⚠️ 释义（imagery_meanings）子系统目前不可用，且设计未定，暂缓处理
 *
 * 现状（2026-09-15 核实）：
 *   · imagery_meanings 表 0 行；imagery_occurrences 共 6573 行，meaning_id 全为 NULL
 *   · 表结构声明的是「按意象隔离」：
 *       imagery_id  bigint  NOT NULL  FK → imagery.id   且无默认值
 *   · 但下面的 createImageryMeaning() 插入时不带 imagery_id
 *     → 后台「含义」页点新增会被 NOT NULL 约束拒掉，这才是表一直为空的原因，
 *       而不是「还没人用」
 *
 * 另有两套并行 API，只有前者接进了 UI：
 *   · 全局    /api/admin/meanings              ← 后台「含义」Tab 在用（存不进去）
 *   · 按意象  /api/admin/imagery/[id]/meanings ← 端到端写好了，但零调用
 *
 * 真要启用时需要先定方向，二选一：
 *   A. 跟随表结构做「按意象隔离」——释义挂在具体意象下，出现记录的下拉只列本意象的；
 *      改 UI，删掉全局那套；代价是无法跨意象聚合。
 *   B. 改成「全局共享词表」——DROP 掉 imagery_id 列，删掉按意象那套；
 *      可以回答「哪些意象都表达过思念」，代价是下拉框会随词表变长。
 *
 * 在方向定下来之前不要往这几个函数上叠功能。
 * ────────────────────────────────────────────────────────────────────────── */

export async function getImageryMeanings(): Promise<ImageryMeaning[]> {
  const supabase = getServiceClient();
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from(TABLES.IMAGERY_MEANINGS)
      .select("id,label,description")
      .order("label", { ascending: true });
    if (error) {
      console.error("[getImageryMeanings]", error);
      return [];
    }
    return (data ?? []) as ImageryMeaning[];
  } catch (e) {
    console.error("[getImageryMeanings]", e);
    return [];
  }
}

export async function getOccurrencesForImagery(
  imageryId: number,
): Promise<OccurrenceWithSong[]> {
  const supabase = getServiceClient();
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from(TABLES.IMAGERY_OCC)
      .select(
        "*, music(title, album), imagery(name), imagery_categories(name), imagery_meanings(label)",
      )
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
      .select(
        "*, music(title, album), imagery(name), imagery_categories(name), imagery_meanings(label)",
      )
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

/** 标注属于哪首歌、哪个意象；改动或删除标注前查出来，好刷新对应缓存 */
export async function getOccurrenceRefs(
  id: number,
): Promise<{ song_id: number; imagery_id: number } | null> {
  const supabase = getServiceClient();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from(TABLES.IMAGERY_OCC)
    .select("song_id,imagery_id")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data as { song_id: number; imagery_id: number } | null;
}

// ─── write functions: imagery ─────────────────────────────────────────────────

export async function createImagery(name: string, accessToken: string) {
  const supabase = getUserClient(accessToken);
  if (!supabase) throw new Error("Supabase client unavailable");
  const { data, error } = await supabase
    .from(TABLES.IMAGERY)
    .insert({ name })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateImagery(
  id: number,
  name: string,
  accessToken: string,
) {
  const supabase = getUserClient(accessToken);
  if (!supabase) throw new Error("Supabase client unavailable");
  const { data, error } = await supabase
    .from(TABLES.IMAGERY)
    .update({ name })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ─── write functions: imagery categories ─────────────────────────────────────
export async function createImageryCategory(
  data: {
    name: string;
    parent_id?: number | null;
    level?: number | null;
    description?: string | null;
  },
  accessToken: string,
) {
  // 如果有父分类，校验父分类 level 不能超过 2（即父最深为 L2，子为 L3）
  if (data.parent_id) {
    const supabase = getUserClient(accessToken);
    if (!supabase) throw new Error("Supabase client unavailable");

    const { data: parent, error } = await supabase
      .from(TABLES.IMAGERY_CAT)
      .select("level")
      .eq("id", data.parent_id)
      .single();
    if (error) throw error;

    const parentLevel = (parent as { level: number | null }).level ?? 1;
    if (parentLevel >= 3) {
      throw Object.assign(
        new Error("分类最多支持 3 层，L3 分类不能再添加子分类"),
        { code: "MAX_DEPTH_EXCEEDED" },
      );
    }
  }

  const supabase = getUserClient(accessToken);
  if (!supabase) throw new Error("Supabase client unavailable");
  const { data: created, error } = await supabase
    .from(TABLES.IMAGERY_CAT)
    .insert(data)
    .select()
    .single();
  if (error) throw error;
  return created;
}

export async function updateImageryCategory(
  id: number,
  data: {
    name?: string;
    parent_id?: number | null;
    level?: number | null;
    description?: string | null;
  },
  accessToken: string,
) {
  // 如果传了 parent_id，校验新父分类必须与当前分类同级（level 相差 1）
  if ("parent_id" in data) {
    const supabase = getUserClient(accessToken);
    if (!supabase) throw new Error("Supabase client unavailable");

    // 查当前分类的 level
    const { data: current, error: currentError } = await supabase
      .from(TABLES.IMAGERY_CAT)
      .select("level")
      .eq("id", id)
      .single();
    if (currentError) throw currentError;

    const currentLevel = (current as { level: number | null }).level ?? 1;

    if (data.parent_id === null) {
      // 改为顶级：只有 L1（level === 1）才允许无父分类
      if (currentLevel !== 1) {
        throw Object.assign(new Error("只有 L1 分类可以设为顶级分类"), {
          code: "INVALID_PARENT_LEVEL",
        });
      }
    } else {
      // 查新父分类的 level
      const { data: parent, error: parentError } = await supabase
        .from(TABLES.IMAGERY_CAT)
        .select("level")
        .eq("id", data.parent_id)
        .single();
      if (parentError) throw parentError;

      const parentLevel = (parent as { level: number | null }).level ?? 1;

      if (parentLevel !== currentLevel - 1) {
        throw Object.assign(
          new Error("父分类必须与当前分类同级（只能在同层级间调整父分类）"),
          { code: "INVALID_PARENT_LEVEL" },
        );
      }
    }
  }

  const supabase = getUserClient(accessToken);
  if (!supabase) throw new Error("Supabase client unavailable");
  const { data: updated, error } = await supabase
    .from(TABLES.IMAGERY_CAT)
    .update(data)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return updated;
}

// ─── write functions: meanings ────────────────────────────────────────────────

async function getOccurrenceWithRelationsById(id: number, accessToken: string) {
  const supabase = getUserClient(accessToken);
  if (!supabase) throw new Error("Supabase client unavailable");
  const { data, error } = await supabase
    .from(TABLES.IMAGERY_OCC)
    .select(
      "*, music(title, album), imagery(name), imagery_categories(name), imagery_meanings(label)",
    )
    .eq("id", id)
    .single();
  if (error) throw error;
  return mapOccurrenceRow(data as Record<string, unknown>);
}

/**
 * ⚠️ 当前必定失败：imagery_meanings.imagery_id 为 NOT NULL 且无默认值，
 * 而这里没有传。属于上面那段「释义子系统待定」的一部分，方向定了再改。
 */
export async function createImageryMeaning(
  label: string,
  description: string | null,
  accessToken: string,
) {
  const supabase = getUserClient(accessToken);
  if (!supabase) throw new Error("Supabase client unavailable");
  const { data, error } = await supabase
    .from(TABLES.IMAGERY_MEANINGS)
    .insert({ label, description })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateMeaning(
  id: number,
  label: string,
  description: string | null,
  accessToken: string,
) {
  const supabase = getUserClient(accessToken);
  if (!supabase) throw new Error("Supabase client unavailable");
  const { data, error } = await supabase
    .from(TABLES.IMAGERY_MEANINGS)
    .update({ label, description })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteMeaning(id: number, accessToken: string) {
  const supabase = getUserClient(accessToken);
  if (!supabase) throw new Error("Supabase client unavailable");
  const { error } = await supabase
    .from(TABLES.IMAGERY_MEANINGS)
    .delete()
    .eq("id", id);
  if (error) throw error;
}

// ─── helpers ──────────────────────────────────────────────────────────────────

/**
 * 校验 category_id 必须是叶子节点（没有子分类）。
 * 意象只允许挂载到叶子分类，以保证公开词云页面的层级着色逻辑正确。
 */
async function assertLeafCategory(
  categoryId: number | number[],
  accessToken: string,
): Promise<void> {
  const supabase = getUserClient(accessToken);
  if (!supabase) throw new Error("Supabase client unavailable");

  // 查询是否存在以该分类为父级的子分类
  const { data, error } = await supabase
    .from(TABLES.IMAGERY_CAT)
    .select("id")
    .in("parent_id", Array.isArray(categoryId) ? categoryId : [categoryId])
    .limit(1);

  if (error) throw error;

  if (data && data.length > 0) {
    throw Object.assign(
      new Error("意象只能挂载到叶子分类（该分类下还有子分类）"),
      { code: "NOT_LEAF_CATEGORY" },
    );
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
      .select("id,imagery_id,lyric_timetag,imagery(name)")
      .eq("song_id", songId),
  ]);
  if (song.error) throw song.error;
  if (occurrences.error) throw occurrences.error;
  return {
    lyrics: (song.data as { lyrics: string | null } | null)?.lyrics ?? null,
    rows: ((occurrences.data ?? []) as Record<string, unknown>[]).map((r) => ({
      id: r.id as number,
      imagery_id: r.imagery_id as number,
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
 */
async function syncSongTimetags(
  supabase: UserClient,
  songId: number,
): Promise<void> {
  const { lyrics, rows } = await loadSongWords(supabase, songId);
  const expected = songTimetags(lyrics, [...new Set(rows.map((r) => r.name))]);
  if (!expected) return;
  for (const row of rows) {
    const tags = expected.get(row.name) ?? [];
    if (tags.join() === row.lyric_timetag.join()) continue;
    const { error } = await supabase
      .from(TABLES.IMAGERY_OCC)
      .update({ lyric_timetag: tags })
      .eq("id", row.id);
    if (error) throw error;
  }
}

/** 时间标签不由调用方给出：写入后按歌词重算（syncSongTimetags） */
export async function createOccurrence(
  data: {
    song_id: number;
    imagery_id: number;
    category_id: number;
    meaning_id?: number | null;
  },
  accessToken: string,
) {
  await assertLeafCategory(data.category_id, accessToken);
  const supabase = getUserClient(accessToken);
  if (!supabase) throw new Error("Supabase client unavailable");
  await assertInLyrics(supabase, data.song_id, [data]);
  const motifs = await registerMotifs(supabase, [data]);
  const [main, ...parts] = withParts(
    [
      {
        song_id: data.song_id,
        imagery_id: data.imagery_id,
        category_id: data.category_id,
        meaning_id: data.meaning_id ?? null,
        lyric_timetag: [] as string[],
      },
    ],
    motifs,
  );
  const { data: created, error } = await supabase
    .from(TABLES.IMAGERY_OCC)
    .insert(main)
    .select()
    .single();
  if (error) throw error;
  if (parts.length > 0) {
    const { error: partsError } = await supabase
      .from(TABLES.IMAGERY_OCC)
      .upsert(parts, {
        onConflict: "song_id,imagery_id,category_id",
        ignoreDuplicates: true,
      });
    if (partsError) throw partsError;
  }
  await syncSongTimetags(supabase, data.song_id);
  return getOccurrenceWithRelationsById(
    (created as { id: number }).id,
    accessToken,
  );
}

/**
 * 批量标注的单项：imagery_id 指向已有意象，或 imagery_name 给出新意象名（保存时创建）。
 * 时间标签由服务端按歌词算出
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
 * 为一首歌批量新增意象标注（预标注审核后一次提交）。
 *
 * - 新意象名若已存在同名意象则直接复用，否则创建；创建前先确认歌曲已发布、词都在歌词里，避免留下孤立意象
 * - 解析后指向同一意象的多项合并为一条（母题取第一项）；写入后按歌词重算整首的时间标签
 * - 所选母题不在该词的候选里时登记为候选；挂默认母题的并列词补写其余组成
 * - 该歌已标注过的意象会被跳过，避免重复提交或并发编辑产生重复行
 */
export async function createOccurrencesBatch(
  songId: number,
  items: OccurrenceBatchItem[],
  accessToken: string,
): Promise<{ created: number; skipped: number; newImagery: number }> {
  if (items.length === 0) return { created: 0, skipped: 0, newImagery: 0 };
  await assertLeafCategory(
    [...new Set(items.map((i) => i.category_id))],
    accessToken,
  );
  const supabase = getUserClient(accessToken);
  if (!supabase) throw new Error("Supabase client unavailable");

  const { data: song, error: songError } = await supabase
    .from(TABLES.MUSIC)
    .select("id")
    .eq("id", songId)
    .maybeSingle();
  if (songError) throw songError;
  if (!song) throw songNotPublished();
  await assertInLyrics(supabase, songId, items);

  // ── 新意象名 → id ──
  const names = [
    ...new Set(
      items.flatMap((i) => ("imagery_name" in i ? [i.imagery_name] : [])),
    ),
  ];
  const idByName = new Map<string, number>();
  let newImagery = 0;
  if (names.length > 0) {
    const { data: found, error: findError } = await supabase
      .from(TABLES.IMAGERY)
      .select("id,name")
      .in("name", names);
    if (findError) throw findError;
    for (const row of (found ?? []) as { id: number; name: string }[]) {
      idByName.set(row.name, row.id);
    }
    const missing = names.filter((n) => !idByName.has(n));
    if (missing.length > 0) {
      const { data: created, error: createError } = await supabase
        .from(TABLES.IMAGERY)
        .insert(missing.map((name) => ({ name })))
        .select("id,name");
      if (createError) throw createError;
      for (const row of (created ?? []) as { id: number; name: string }[]) {
        idByName.set(row.name, row.id);
      }
      newImagery = missing.length;
    }
  }

  // ── 按意象合并 ──
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
    fresh.map((item) => ({ ...item, song_id: songId, meaning_id: null })),
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

/** 时间标签不由调用方给出：改动后按歌词重算整首 */
export async function updateOccurrence(
  id: number,
  data: {
    imagery_id?: number;
    category_id?: number;
    meaning_id?: number | null;
  },
  accessToken: string,
) {
  if (data.category_id !== undefined) {
    await assertLeafCategory(data.category_id, accessToken);
  }
  const supabase = getUserClient(accessToken);
  if (!supabase) throw new Error("Supabase client unavailable");
  const { data: current, error: currentError } = await supabase
    .from(TABLES.IMAGERY_OCC)
    .select("song_id,imagery_id")
    .eq("id", id)
    .single();
  if (currentError) throw currentError;
  const before = current as { song_id: number; imagery_id: number };
  const imageryId = data.imagery_id ?? before.imagery_id;
  if (imageryId !== before.imagery_id) {
    await assertInLyrics(supabase, before.song_id, [{ imagery_id: imageryId }]);
  }
  if (data.category_id !== undefined) {
    await registerMotifs(supabase, [
      { imagery_id: imageryId, category_id: data.category_id },
    ]);
  }
  const { error } = await supabase
    .from(TABLES.IMAGERY_OCC)
    .update({
      imagery_id: data.imagery_id,
      category_id: data.category_id,
      meaning_id: data.meaning_id,
    })
    .eq("id", id)
    .select("id")
    .single();
  if (error) throw error;
  if (imageryId !== before.imagery_id) {
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

export async function getSongsForImagery(
  imageryId: number,
): Promise<SongRef[]> {
  const supabase = getServiceClient();
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from(TABLES.IMAGERY_OCC)
      .select("song_id, music(id, title, lyricist)")
      .eq("imagery_id", imageryId);
    if (error) {
      console.error("[getSongsForImagery]", error);
      return [];
    }
    const seen = new Set<number>();
    const results: SongRef[] = [];
    for (const row of (data ?? []) as Record<string, unknown>[]) {
      const m = row.music as {
        id?: number;
        title?: string;
        lyricist?: string[] | null;
      } | null;
      if (m?.id && !seen.has(m.id)) {
        seen.add(m.id);
        results.push({
          id: m.id,
          title: m.title ?? "",
          lyricist: m.lyricist ?? null,
        });
      }
    }
    return results;
  } catch (e) {
    console.error("[getSongsForImagery]", e);
    return [];
  }
}

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
