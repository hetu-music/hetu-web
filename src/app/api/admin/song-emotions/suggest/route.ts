import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withAuth, type AuthenticatedUser } from "@/lib/server/server-auth";
import { suggestSongEmotions } from "@/lib/server/service-emotions";
import { LlmError } from "@/lib/server/llm";
import { serverErrorResponse } from "@/lib/server/server-utils";
import { parseJsonBody } from "@/lib/server/parse-body";

const SuggestSchema = z.object({ song_id: z.number().int().positive() });

/**
 * 请模型为一首歌标基调，只返回建议、不写库：POST /api/admin/song-emotions/suggest
 * 每次调用都会产生模型费用，因此走 POST + CSRF，由管理员手动触发。
 */
export const POST = withAuth(
  async (request: NextRequest, _user: AuthenticatedUser) => {
    const { data: input, response: invalid } = await parseJsonBody(
      request,
      SuggestSchema,
    );
    if (invalid) return invalid;
    try {
      const suggestion = await suggestSongEmotions(input.song_id);
      if (!suggestion) {
        return NextResponse.json(
          { error: "歌曲尚未发布或没有歌词" },
          { status: 404 },
        );
      }
      return NextResponse.json(suggestion);
    } catch (e) {
      if (e instanceof LlmError) {
        return NextResponse.json(
          { error: e.message },
          { status: e.code === "NOT_CONFIGURED" ? 503 : 502 },
        );
      }
      return serverErrorResponse(
        "POST /api/admin/song-emotions/suggest",
        e,
        "AI 建议失败",
      );
    }
  },
  { requireCSRF: true, requireAdmin: true },
);
