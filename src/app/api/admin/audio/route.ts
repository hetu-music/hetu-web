import { NextResponse } from "next/server";
import { withAuth } from "@/lib/server/server-auth";
import {
  audioErrorResponse,
  getAudioOverview,
} from "@/lib/server/service-navidrome";

// ─── GET: 曲库、映射现状与同步预览 ────────────────────────────────────────────

export const GET = withAuth(
  async () => {
    try {
      return NextResponse.json(await getAudioOverview());
    } catch (error) {
      return audioErrorResponse("GET /api/admin/audio", error);
    }
  },
  { requireSuperAdmin: true },
);
