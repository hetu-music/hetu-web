import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/server/server-auth";
import {
  audioErrorResponse,
  updateAudioMapping,
} from "@/lib/server/service-navidrome";
import { withPurgeStatus } from "@/lib/server/server-revalidate";
import { parseJsonBody } from "@/lib/server/parse-body";

const mappingSchema = z.object({
  songId: z.number().int().positive("歌曲 ID 无效"),
  // null 表示解除关联
  navidId: z.string().trim().min(1).max(100).nullable(),
});

// ─── PUT: 手动关联 / 解除关联单首歌曲 ─────────────────────────────────────────

export const PUT = withAuth(
  async (request: NextRequest) => {
    const { data: input, response: invalid } = await parseJsonBody(
      request,
      mappingSchema,
    );
    if (invalid) return invalid;

    try {
      const { songId, navidId } = input;
      const { purge, ...body } = await updateAudioMapping(songId, navidId);
      return withPurgeStatus(NextResponse.json(body), purge);
    } catch (error) {
      return audioErrorResponse("PUT /api/admin/audio/mapping", error);
    }
  },
  { requireCSRF: true, requireSuperAdmin: true },
);
