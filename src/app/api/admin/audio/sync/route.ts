import { NextResponse } from "next/server";
import { withAuth } from "@/lib/server/server-auth";
import {
  audioErrorResponse,
  runAudioSync,
} from "@/lib/server/service-navidrome";
import { withPurgeStatus } from "@/lib/server/server-revalidate";

// ─── POST: 按服务端重新计算的计划执行同步 ──────────────────────────────────────

export const POST = withAuth(
  async () => {
    try {
      const { purge, ...result } = await runAudioSync();
      return withPurgeStatus(NextResponse.json(result), purge);
    } catch (error) {
      return audioErrorResponse("POST /api/admin/audio/sync", error);
    }
  },
  { requireCSRF: true, requireSuperAdmin: true },
);
