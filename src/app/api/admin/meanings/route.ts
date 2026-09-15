/**
 * ⚠️ 全局释义接口：POST 目前必定失败（imagery_meanings.imagery_id 为 NOT NULL，
 * 此处不传）。仓库里另有一套按意象的 /api/admin/imagery/[id]/meanings，端到端
 * 写好但零调用。两套并存且方向未定，详见 service-imagery.ts 中
 * getImageryMeanings 上方的说明。
 */
import { NextRequest, NextResponse } from "next/server";
import { withAuth, type AuthenticatedUser } from "@/lib/server/server-auth";
import {
  createImageryMeaning,
  getImageryMeanings,
} from "@/lib/server/service-imagery";
import { createSupabaseServerClient } from "@/lib/db/supabase-auth";
import { z } from "zod";

const CreateMeaningSchema = z.object({
  label: z.string().min(1).max(100),
  description: z.string().max(500).nullable().optional(),
});

export const GET = withAuth(
  async (_request: NextRequest, _user: AuthenticatedUser) => {
    try {
      const meanings = await getImageryMeanings();
      return NextResponse.json(meanings);
    } catch (e) {
      console.error("[GET /api/admin/meanings]", e);
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
      console.error("[POST /api/admin/meanings]", e);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 },
      );
    }
  },
  { requireCSRF: true, requireAdmin: true },
);
