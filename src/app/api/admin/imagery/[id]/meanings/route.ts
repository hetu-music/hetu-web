import { NextRequest, NextResponse } from "next/server";
import { withAuth, type AuthenticatedUser } from "@/lib/server/server-auth";
import {
  getImageryMeanings,
  createImageryMeaning,
} from "@/lib/server/service-imagery";
import { createSupabaseServerClient } from "@/lib/db/supabase-auth";
import { z } from "zod";

const CreateMeaningSchema = z.object({
  label: z.string().min(1).max(100),
  description: z.string().max(500).nullable().optional(),
});

function getIdFromUrl(request: NextRequest): number | null {
  const segments = request.nextUrl.pathname.split("/");
  // path: /api/admin/imagery/[id]/meanings  → id is at index -2
  const id = parseInt(segments[segments.length - 2], 10);
  return isNaN(id) || id < 1 ? null : id;
}

export const GET = withAuth(
  async (request: NextRequest, _user: AuthenticatedUser) => {
    const imageryId = getIdFromUrl(request);
    if (!imageryId)
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    try {
      // 注：释义目前是全库共享的词表，未按意象隔离。
      // imagery_meanings 表虽有 imagery_id 列但从未写入，路径里的 id 仅用于校验。
      const meanings = await getImageryMeanings();
      return NextResponse.json(meanings);
    } catch (e) {
      console.error("[GET /api/admin/imagery/[id]/meanings]", e);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 },
      );
    }
  },
  { requireAdmin: true },
);

export const POST = withAuth(
  async (request: NextRequest, _user: AuthenticatedUser) => {
    const imageryId = getIdFromUrl(request);
    if (!imageryId)
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    try {
      const body = await request.json();
      const parsed = CreateMeaningSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: "Invalid input", details: parsed.error.issues },
          { status: 400 },
        );
      }

      const supabase = await createSupabaseServerClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token)
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

      const created = await createImageryMeaning(
        parsed.data.label,
        parsed.data.description ?? null,
        session.access_token,
      );
      return NextResponse.json(created);
    } catch (e) {
      console.error("[POST /api/admin/imagery/[id]/meanings]", e);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 },
      );
    }
  },
  { requireCSRF: true, requireAdmin: true },
);
