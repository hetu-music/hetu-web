import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withAuth, type AuthenticatedUser } from "@/lib/server/server-auth";
import { createSupabaseServerClient } from "@/lib/db/supabase-auth";
import {
  getEmotions,
  getSongEmotions,
  MAX_SONG_EMOTIONS,
  setSongEmotions,
  type SongEmotionErrorCode,
} from "@/lib/server/service-emotions";
import { isLlmConfigured } from "@/lib/server/llm";
import {
  refreshQuizPool,
  withPurgeStatus,
} from "@/lib/server/server-revalidate";
import { serverErrorResponse } from "@/lib/server/server-utils";
import { parseJsonBody } from "@/lib/server/parse-body";

const SetSongEmotionsSchema = z.object({
  song_id: z.number().int().positive(),
  // 按主、副顺序；空数组表示清空
  emotion_ids: z
    .array(z.number().int().positive())
    .max(MAX_SONG_EMOTIONS)
    .refine((ids) => new Set(ids).size === ids.length, "基调不能重复"),
});

const ERROR_STATUS: Record<SongEmotionErrorCode, number> = {
  INVALID_EMOTIONS: 400,
  SONG_NOT_PUBLISHED: 400,
};

/** 词表、一首歌已标的基调及其来源：GET /api/admin/song-emotions?song_id= */
export const GET = withAuth(
  async (request: NextRequest, _user: AuthenticatedUser) => {
    const songId = Number(request.nextUrl.searchParams.get("song_id"));
    if (!Number.isInteger(songId) || songId < 1) {
      return NextResponse.json({ error: "Invalid song_id" }, { status: 400 });
    }
    try {
      const [emotions, current] = await Promise.all([
        getEmotions(),
        getSongEmotions(songId),
      ]);
      return NextResponse.json({
        emotions,
        selected: current.ids,
        source: current.source,
        llmEnabled: isLlmConfigured(),
      });
    } catch (e) {
      return serverErrorResponse("GET /api/admin/song-emotions", e, "加载失败");
    }
  },
  { requireAdmin: true },
);

/** 整首替换一首歌的基调：PUT /api/admin/song-emotions */
export const PUT = withAuth(
  async (request: NextRequest, _user: AuthenticatedUser) => {
    const { data: input, response: invalid } = await parseJsonBody(
      request,
      SetSongEmotionsSchema,
    );
    if (invalid) return invalid;
    const supabase = await createSupabaseServerClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.access_token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    try {
      const selected = await setSongEmotions(
        input.song_id,
        input.emotion_ids,
        session.access_token,
      );
      const purge = await refreshQuizPool();
      return withPurgeStatus(NextResponse.json({ selected }), purge);
    } catch (e) {
      const code = (e as { code?: string }).code as SongEmotionErrorCode;
      if (code in ERROR_STATUS) {
        return NextResponse.json(
          { error: (e as Error).message },
          { status: ERROR_STATUS[code] },
        );
      }
      return serverErrorResponse("PUT /api/admin/song-emotions", e, "保存失败");
    }
  },
  { requireCSRF: true, requireAdmin: true },
);
