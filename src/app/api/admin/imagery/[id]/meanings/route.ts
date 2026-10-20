import { NextRequest, NextResponse } from "next/server";
import { withAuth, type AuthenticatedUser } from "@/lib/server/server-auth";
import {
  getImageryMeanings,
  createImageryMeaning,
} from "@/lib/server/service-imagery";
import { createSupabaseServerClient } from "@/lib/db/supabase-auth";
import { z } from "zod";
import { parseJsonBody } from "@/lib/server/parse-body";

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
      // ⚠️ 这里没有按 imageryId 过滤，返回的是全部释义。
      // 该路由目前零调用（后台走的是 /api/admin/meanings），释义子系统的
      // 设计方向也未定，详见 service-imagery.ts 中 getImageryMeanings 上方的说明。
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
      const { data: input, response: invalid } = await parseJsonBody(
        request,
        CreateMeaningSchema,
      );
      if (invalid) return invalid;

      const supabase = await createSupabaseServerClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token)
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

      const created = await createImageryMeaning(
        input.label,
        input.description ?? null,
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
