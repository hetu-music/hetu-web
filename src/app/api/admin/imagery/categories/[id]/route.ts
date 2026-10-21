import { NextRequest, NextResponse } from "next/server";
import { withAuth, type AuthenticatedUser } from "@/lib/server/server-auth";
import { updateImageryCategory } from "@/lib/server/service-imagery";
import { refreshImagery } from "@/lib/server/server-revalidate";
import { createSupabaseServerClient } from "@/lib/db/supabase-auth";
import { z } from "zod";
import { parseJsonBody } from "@/lib/server/parse-body";

const UpdateCategorySchema = z.object({
  name: z.string().min(1).max(50).optional(),
  parent_id: z.number().int().positive().nullable().optional(),
  level: z.number().int().min(1).nullable().optional(),
  description: z.string().max(500).nullable().optional(),
});

function getIdFromUrl(request: NextRequest): number | null {
  const segments = request.nextUrl.pathname.split("/");
  const id = parseInt(segments[segments.length - 1], 10);
  return isNaN(id) || id < 1 ? null : id;
}

export const PUT = withAuth(
  async (request: NextRequest, _user: AuthenticatedUser) => {
    const categoryId = getIdFromUrl(request);
    if (!categoryId) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }
    try {
      const { data: input, response: invalid } = await parseJsonBody(
        request,
        UpdateCategorySchema,
      );
      if (invalid) return invalid;

      const supabase = await createSupabaseServerClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      const updated = await updateImageryCategory(
        categoryId,
        input,
        session.access_token,
      );
      // 分类牵动全部详情页，CDN 上的副本等 s-maxage 到期
      await refreshImagery();
      return NextResponse.json(updated);
    } catch (e) {
      if (
        e instanceof Error &&
        (e as Error & { code?: string }).code === "INVALID_PARENT_LEVEL"
      ) {
        return NextResponse.json({ error: e.message }, { status: 400 });
      }
      console.error("[PUT /api/admin/imagery/categories/[id]]", e);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 },
      );
    }
  },
  { requireCSRF: true, requireAdmin: true },
);
