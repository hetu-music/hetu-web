import { NextResponse } from "next/server";
import { withAuth } from "@/lib/server/server-auth";
import {
  audioErrorResponse,
  runAudioSync,
} from "@/lib/server/service-navidrome";

// ─── POST: 按服务端重新计算的计划执行同步 ──────────────────────────────────────

export const POST = withAuth(
  async () => {
    try {
      return NextResponse.json(await runAudioSync());
    } catch (error) {
      return audioErrorResponse("POST /api/admin/audio/sync", error);
    }
  },
  { requireCSRF: true, requireSuperAdmin: true },
);
