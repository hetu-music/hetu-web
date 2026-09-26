import {
  fetchAll,
  getServiceClient,
  getUserClient,
  TABLES,
} from "@/lib/db/supabase-server";
import {
  buildPriors,
  suggestImagery,
  type ImagerySuggestion,
} from "@/lib/imagery/suggest";

export interface CategoryOption {
  id: number;
  /** 完整路径，如「自然 / 天象 / 月」 */
  label: string;
}

/** 词典条目，供审核时把候选改成另一个意象 */
export interface DictionaryOption {
  id: number;
  name: string;
  /** 历史上使用过的分类，按使用次数从多到少 */
  categoryIds: number[];
}

export interface ImagerySuggestionsResult {
  /** 歌曲是否已发布到正式曲库；未发布时标注无法保存 */
  published: boolean;
  hasLyrics: boolean;
  suggestions: ImagerySuggestion[];
  /** 可挂载意象的叶子分类，用于候选改分类 */
  categories: CategoryOption[];
  dictionary: DictionaryOption[];
}

type CategoryRow = {
  id: number;
  name: string;
  parent_id: number | null;
};

function toLeafOptions(categories: CategoryRow[]): CategoryOption[] {
  const byId = new Map(categories.map((c) => [c.id, c]));
  const parents = new Set(categories.map((c) => c.parent_id));
  const pathOf = (cat: CategoryRow): string => {
    const names: string[] = [];
    const visited = new Set<number>();
    for (
      let c: CategoryRow | undefined = cat;
      c && !visited.has(c.id);
      c = c.parent_id === null ? undefined : byId.get(c.parent_id)
    ) {
      visited.add(c.id);
      names.unshift(c.name);
    }
    return names.join(" / ");
  };
  return categories
    .filter((c) => !parents.has(c.id))
    .map((c) => ({ id: c.id, label: pathOf(c) }))
    .sort((a, b) => a.label.localeCompare(b.label, "zh-CN"));
}

/**
 * 为一首歌生成意象标注候选。歌词取自暂存表（管理员正在编辑的版本），
 * 历史先验取自正式曲库的全部已有标注。
 *
 * 不做跨请求缓存：这是管理员手动触发的低频操作，而刚保存的标注应立即影响下一首歌的候选。
 * 全表读取约 7 千条标注和数百首歌词（共约 0.8MB），耗时主要是 fetchAll 的分页往返
 *（标注表 7 页），匹配计算本身约 100ms。
 *
 * 歌曲在暂存表中不存在时返回 null。
 */
export async function getImagerySuggestions(
  songId: number,
  accessToken: string,
): Promise<ImagerySuggestionsResult | null> {
  const userClient = getUserClient(accessToken);
  const service = getServiceClient();
  if (!userClient || !service) throw new Error("Supabase client unavailable");

  const { data: song, error: songError } = await userClient
    .from(TABLES.ADMIN)
    .select("id,lyrics")
    .eq("id", songId)
    .maybeSingle();
  if (songError) throw songError;
  if (!song) return null;

  const [dictionary, occurrences, songs, categories] = await Promise.all([
    fetchAll<{ id: number; name: string }>(service, TABLES.IMAGERY, "id,name"),
    fetchAll<{ song_id: number; imagery_id: number; category_id: number }>(
      service,
      TABLES.IMAGERY_OCC,
      "song_id,imagery_id,category_id",
    ),
    fetchAll<{ id: number; lyrics: string | null }>(
      service,
      TABLES.MUSIC,
      "id,lyrics",
    ),
    fetchAll<CategoryRow>(service, TABLES.IMAGERY_CAT, "id,name,parent_id"),
  ]);
  // fetchAll 出错时只记日志并返回部分数据；词典为空时生成的候选毫无意义
  if (dictionary.length === 0) throw new Error("意象词典为空");

  const lyrics = (song as { lyrics: string | null }).lyrics;
  const priors = buildPriors({
    dictionary,
    occurrences,
    songs,
    excludeSongId: songId,
  });
  const existingImageryIds = new Set(
    occurrences.filter((o) => o.song_id === songId).map((o) => o.imagery_id),
  );

  return {
    published: songs.some((s) => s.id === songId),
    hasLyrics: Boolean(lyrics?.trim()),
    suggestions: suggestImagery({
      lyrics,
      dictionary,
      priors,
      existingImageryIds,
    }),
    categories: toLeafOptions(categories),
    dictionary: dictionary.map((d) => ({
      id: d.id,
      name: d.name,
      categoryIds: priors.get(d.id)?.categoryIds ?? [],
    })),
  };
}
