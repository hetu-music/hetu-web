import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/server/server-auth";
import {
  audioErrorResponse,
  updateAudioMapping,
} from "@/lib/server/service-navidrome";

const mappingSchema = z.object({
  songId: z.number().int().positive("歌曲 ID 无效"),
  // null 表示解除关联
  navidId: z.string().trim().min(1).max(100).nullable(),
});

// ─── PUT: 手动关联 / 解除关联单首歌曲 ─────────────────────────────────────────

export const PUT = withAuth(
  async (request: NextRequest) => {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "请求体格式无效" }, { status: 400 });
    }

    const parsed = mappingSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "参数校验失败" },
        { status: 400 },
      );
    }

    try {
      const { songId, navidId } = parsed.data;
      return NextResponse.json(await updateAudioMapping(songId, navidId));
    } catch (error) {
      return audioErrorResponse("PUT /api/admin/audio/mapping", error);
    }
  },
  { requireCSRF: true, requireSuperAdmin: true },
);
