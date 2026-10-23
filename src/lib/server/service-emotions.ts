import { cache } from "react";
import {
  getServiceClient,
  getUserClient,
  TABLES,
} from "@/lib/db/supabase-server";
import type { Emotion } from "@/lib/types";

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

/** 一首歌的基调 id，主基调在前 */
export async function getSongEmotionIds(songId: number): Promise<number[]> {
  const supabase = getServiceClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from(TABLES.SONG_EMOTIONS)
    .select("emotion_id")
    .eq("song_id", songId)
    .order("rank");
  if (error) {
    console.error("[getSongEmotionIds]", error);
    return [];
  }
  return ((data ?? []) as { emotion_id: number }[]).map((r) => r.emotion_id);
}

export type SongEmotionErrorCode = "INVALID_EMOTIONS" | "SONG_NOT_PUBLISHED";

function emotionError(code: SongEmotionErrorCode, message: string) {
  return Object.assign(new Error(message), { code });
}

/**
 * 整首替换一首歌的基调：emotionIds 按主、副顺序排列，空数组表示清空。
 * 基调挂在正式曲库的歌上，未发布的歌不能标。
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
  const supabase = getUserClient(accessToken);
  if (!supabase) throw new Error("Supabase client unavailable");

  const { data: song, error: songError } = await supabase
    .from(TABLES.MUSIC)
    .select("id")
    .eq("id", songId)
    .maybeSingle();
  if (songError) throw songError;
  if (!song) {
    throw emotionError("SONG_NOT_PUBLISHED", "歌曲尚未发布，发布后才能标基调");
  }

  const { error: deleteError } = await supabase
    .from(TABLES.SONG_EMOTIONS)
    .delete()
    .eq("song_id", songId);
  if (deleteError) throw deleteError;
  if (emotionIds.length > 0) {
    const { error } = await supabase.from(TABLES.SONG_EMOTIONS).insert(
      emotionIds.map((emotion_id, i) => ({
        song_id: songId,
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
