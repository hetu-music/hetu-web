import { NextRequest, NextResponse } from "next/server";
import { withAuth, type AuthenticatedUser } from "@/lib/server/server-auth";
import {
  getImageryCategories,
  createImageryCategory,
} from "@/lib/server/service-imagery";
import { refreshImagery } from "@/lib/server/server-revalidate";
import { createSupabaseServerClient } from "@/lib/db/supabase-auth";
import { z } from "zod";
import { parseJsonBody } from "@/lib/server/parse-body";

const CreateCategorySchema = z.object({
  name: z.string().min(1).max(50),
  parent_id: z.number().int().positive().nullable().optional(),
  level: z.number().int().min(1).nullable().optional(),
  description: z.string().max(500).nullable().optional(),
});

export const GET = withAuth(
  async (_request: NextRequest, _user: AuthenticatedUser) => {
    try {
      const categories = await getImageryCategories();
      return NextResponse.json(categories);
    } catch (e) {
      console.error("[GET /api/admin/imagery/categories]", e);
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
      const { data: input, response: invalid } = await parseJsonBody(
        request,
        CreateCategorySchema,
      );
      if (invalid) return invalid;

      const supabase = await createSupabaseServerClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      const created = await createImageryCategory(input, session.access_token);
      await refreshImagery();
      return NextResponse.json(created);
    } catch (e) {
      if (
        e instanceof Error &&
        (e as Error & { code?: string }).code === "MAX_DEPTH_EXCEEDED"
      ) {
        return NextResponse.json({ error: e.message }, { status: 400 });
      }
      console.error("[POST /api/admin/imagery/categories]", e);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 },
      );
    }
  },
  { requireCSRF: true, requireAdmin: true },
);
