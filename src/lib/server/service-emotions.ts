import { cache } from "react";
import { getServiceClient, TABLES } from "@/lib/db/supabase-server";
import {
  buildEmotionPrompt,
  buildEmotionSystemPrompt,
  emotionOutputSchema,
  parseEmotionOutput,
  type EmotionSuggestion,
} from "@/lib/imagery/emotion-suggest";
import { chatJson } from "@/lib/server/llm";
import type { Emotion } from "@/lib/types";
import {
  ensureDraft,
  userDb,
  workingVersionId,
} from "@/lib/server/service-versions";

/** 每首歌最多 1 个主基调 + 2 个副基调 */
export const MAX_SONG_EMOTIONS = 3;

// cache(): 同一次请求内多处取词表时只查一次
export const getEmotions = cache(async function getEmotions(): Promise<
  Emotion[]
> {
  const supabase = getServiceClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from(TABLES.EMOTIONS)
    .select("id,name,description,tone,energy,sort")
    .order("sort");
  if (error) {
    console.error("[getEmotions]", error);
    return [];
  }
  return (data ?? []) as Emotion[];
});

/** 一首歌工作版本（有草稿用草稿）的基调，主基调在前。后台用 */
export async function getSongEmotions(songId: number): Promise<number[]> {
  const supabase = getServiceClient();
  if (!supabase) return [];
  const versionId = await workingVersionId(supabase, songId);
  if (versionId === null) return [];
  const { data, error } = await supabase
    .from(TABLES.SONG_EMOTIONS)
    .select("emotion_id")
    .eq("version_id", versionId)
    .order("rank");
  if (error) {
    console.error("[getSongEmotions]", error);
    return [];
  }
  return ((data ?? []) as { emotion_id: number }[]).map((r) => r.emotion_id);
}

/**
 * 请模型为一首歌标基调，只返回建议、不写库。
 * 歌词取工作版本（基调写在草稿上，按草稿的歌词标）。
 * 歌不存在或没有歌词时返回 null。
 */
export async function suggestSongEmotions(
  songId: number,
): Promise<EmotionSuggestion | null> {
  const supabase = getServiceClient();
  if (!supabase) throw new Error("Supabase client unavailable");
  const { data: song, error } = await supabase
    .from(TABLES.WORKING_SONGS)
    .select("title,lyrics")
    .eq("id", songId)
    .maybeSingle();
  if (error) throw error;
  const row = song as { title: string; lyrics: string | null } | null;
  if (!row?.lyrics?.trim()) return null;
  const emotions = await getEmotions();
  const raw = await chatJson({
    system: buildEmotionSystemPrompt(emotions),
    user: buildEmotionPrompt(row),
    schemaName: "song_emotions",
    schema: emotionOutputSchema(emotions),
  });
  return parseEmotionOutput(raw, emotions);
}

export type SongEmotionErrorCode = "INVALID_EMOTIONS" | "SONG_NOT_FOUND";

function emotionError(code: SongEmotionErrorCode, message: string) {
  return Object.assign(new Error(message), { code });
}

/**
 * 整首替换一首歌的基调：emotionIds 按主、副顺序排列，空数组表示清空。
 * 写在歌的草稿上（没有就开一份），发布时随整首歌上线。
 */
export async function setSongEmotions(
  songId: number,
  emotionIds: number[],
  accessToken: string,
): Promise<number[]> {
  if (
    new Set(emotionIds).size !== emotionIds.length ||
    emotionIds.length > MAX_SONG_EMOTIONS
  ) {
    throw emotionError(
      "INVALID_EMOTIONS",
      `基调最多 ${MAX_SONG_EMOTIONS} 个，且不能重复`,
    );
  }
  const supabase = userDb(accessToken);
  if ((await workingVersionId(supabase, songId)) === null) {
    throw emotionError("SONG_NOT_FOUND", "歌曲不存在");
  }
  const draft = await ensureDraft(supabase, songId);

  const { error: deleteError } = await supabase
    .from(TABLES.SONG_EMOTIONS)
    .delete()
    .eq("version_id", draft);
  if (deleteError) throw deleteError;
  if (emotionIds.length > 0) {
    const { error } = await supabase.from(TABLES.SONG_EMOTIONS).insert(
      emotionIds.map((emotion_id, i) => ({
        version_id: draft,
        emotion_id,
        rank: i + 1,
      })),
    );
    // 外键失败：词表里没有这个基调
    if (error?.code === "23503") {
      throw emotionError("INVALID_EMOTIONS", "词表里没有这个基调");
    }
    if (error) throw error;
  }
  return emotionIds;
}
