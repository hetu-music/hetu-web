import {
  fetchAll,
  getServiceClient,
  getUserClient,
  TABLES,
} from "@/lib/db/supabase-server";
import {
  buildReviewPrompt,
  toLeafCategories,
  parseReviewOutput,
  REVIEW_OUTPUT_SCHEMA,
  REVIEW_SYSTEM_PROMPT,
  type ReviewCandidate,
  type ReviewResult,
} from "@/lib/imagery/review";
import {
  buildPriors,
  parseLrcLines,
  type MotifEntry,
  suggestImagery,
  type ImagerySuggestion,
} from "@/lib/imagery/suggest";
import { chatJson, isLlmConfigured, LlmError } from "@/lib/server/llm";

export interface ImagerySuggestionsResult {
  /** 歌曲是否已发布到正式曲库；未发布时标注无法保存 */
  published: boolean;
  hasLyrics: boolean;
  /** 词典与母题不随结果返回：审核时用后台共用的那一份（含各词登记的母题） */
  suggestions: ImagerySuggestion[];
  /** 是否配置了 LLM，决定界面是否提供 AI 校验 */
  llmEnabled: boolean;
}

type CategoryRow = {
  id: number;
  name: string;
  parent_id: number | null;
};

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

  const [dictionary, occurrences, songs, motifs] = await Promise.all([
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
    fetchAll<MotifEntry>(
      service,
      TABLES.IMAGERY_MOTIFS,
      "imagery_id,category_id,role",
    ),
  ]);
  // fetchAll 出错时只记日志并返回部分数据；词典为空时生成的候选毫无意义
  if (dictionary.length === 0) throw new Error("意象词典为空");

  const lyrics = (song as { lyrics: string | null }).lyrics;
  const priors = buildPriors({
    dictionary,
    occurrences,
    songs,
    motifs,
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
    llmEnabled: isLlmConfigured(),
  };
}

/**
 * 用 LLM 校验一首歌的标注候选：逐个判断保留或剔除，并补充词典没匹配到的意象。
 * 歌词取自暂存表，与生成候选时一致。歌曲不存在时返回 null。
 */
export async function reviewImagerySuggestions(
  songId: number,
  candidates: ReviewCandidate[],
  accessToken: string,
): Promise<ReviewResult | null> {
  const userClient = getUserClient(accessToken);
  const service = getServiceClient();
  if (!userClient || !service) throw new Error("Supabase client unavailable");

  const { data: song, error } = await userClient
    .from(TABLES.ADMIN)
    .select("id,title,lyrics")
    .eq("id", songId)
    .maybeSingle();
  if (error) throw error;
  if (!song) return null;

  const { title, lyrics } = song as { title: string; lyrics: string | null };
  const lines = parseLrcLines(lyrics);
  if (lines.length === 0) {
    throw new LlmError("这首歌没有可用的歌词", "BAD_RESPONSE");
  }
  const categories = toLeafCategories(
    await fetchAll<CategoryRow>(
      service,
      TABLES.IMAGERY_CAT,
      "id,name,parent_id",
    ),
  );

  const raw = await chatJson({
    system: REVIEW_SYSTEM_PROMPT,
    user: buildReviewPrompt({ title, lines, candidates, categories }),
    schemaName: "imagery_review",
    schema: REVIEW_OUTPUT_SCHEMA,
  });
  try {
    return parseReviewOutput(raw, { lines, candidates, categories });
  } catch (e) {
    console.error("[reviewImagerySuggestions] 输出结构不符", e);
    throw new LlmError("LLM 返回的结构不符合要求", "BAD_RESPONSE");
  }
}
