import { cache } from "react";
import {
  getServiceClient,
  getUserClient,
  fetchAll,
  TABLES,
} from "@/lib/db/supabase-server";
import type {
  ImageryCategory,
  ImageryItem,
  ImageryMeaning,
  ImageryOccurrence,
  SongRef,
} from "@/lib/types";

// Suppress unused import warnings — these types are re-exported or used transitively
void (undefined as unknown as ImageryOccurrence);
void (undefined as unknown as SongRef);

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

export async function getMeaningsForImagery(
  _imageryId: number,
): Promise<ImageryMeaning[]> {
  return getImageryMeanings();
}

export async function getOccurrencesForImagery(
  imageryId: number,
): Promise<OccurrenceWithSong[]> {
  const supabase = getServiceClient();
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from("imagery_occurrences")
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
      .from("imagery_occurrences")
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

export async function createMeaning(
  _imageryId: number,
  label: string,
  description: string | null,
  accessToken: string,
) {
  return createImageryMeaning(label, description, accessToken);
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
  categoryId: number,
  accessToken: string,
): Promise<void> {
  const supabase = getUserClient(accessToken);
  if (!supabase) throw new Error("Supabase client unavailable");

  // 查询是否存在以该分类为父级的子分类
  const { data, error } = await supabase
    .from(TABLES.IMAGERY_CAT)
    .select("id")
    .eq("parent_id", categoryId)
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

export async function createOccurrence(
  data: {
    song_id: number;
    imagery_id: number;
    category_id: number;
    meaning_id?: number | null;
    lyric_timetag: string[];
  },
  accessToken: string,
) {
  await assertLeafCategory(data.category_id, accessToken);
  const supabase = getUserClient(accessToken);
  if (!supabase) throw new Error("Supabase client unavailable");
  const { data: created, error } = await supabase
    .from(TABLES.IMAGERY_OCC)
    .insert(data)
    .select()
    .single();
  if (error) throw error;
  return getOccurrenceWithRelationsById(
    (created as { id: number }).id,
    accessToken,
  );
}

export async function updateOccurrence(
  id: number,
  data: {
    imagery_id?: number;
    category_id?: number;
    meaning_id?: number | null;
    lyric_timetag?: string[];
  },
  accessToken: string,
) {
  if (data.category_id !== undefined) {
    await assertLeafCategory(data.category_id, accessToken);
  }
  const supabase = getUserClient(accessToken);
  if (!supabase) throw new Error("Supabase client unavailable");
  const { error } = await supabase
    .from(TABLES.IMAGERY_OCC)
    .update(data)
    .eq("id", id)
    .select("id")
    .single();
  if (error) throw error;
  return getOccurrenceWithRelationsById(id, accessToken);
}

export async function deleteOccurrence(id: number, accessToken: string) {
  const supabase = getUserClient(accessToken);
  if (!supabase) throw new Error("Supabase client unavailable");
  const { error } = await supabase
    .from(TABLES.IMAGERY_OCC)
    .delete()
    .eq("id", id);
  if (error) throw error;
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
