import { NextRequest, NextResponse } from "next/server";
import { withAuth, type AuthenticatedUser } from "@/lib/server/server-auth";
import { updateMotif } from "@/lib/server/service-imagery";
import {
  refreshImagery,
  withPurgeStatus,
} from "@/lib/server/server-revalidate";
import { createSupabaseServerClient } from "@/lib/db/supabase-auth";
import { z } from "zod";
import { parseJsonBody } from "@/lib/server/parse-body";

/** 只能改母题：名称、说明，或移到别的类别下 */
const UpdateMotifSchema = z.object({
  name: z.string().trim().min(1).max(50).optional(),
  parent_id: z.number().int().positive().optional(),
  description: z
    .string()
    .trim()
    .min(1, "写一句这个母题指什么")
    .max(500)
    .optional(),
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
        UpdateMotifSchema,
      );
      if (invalid) return invalid;

      const supabase = await createSupabaseServerClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      const updated = await updateMotif(
        categoryId,
        input,
        session.access_token,
      );
      // 母题名与归属牵动全部详情页，CDN 上的副本等 s-maxage 到期
      const purge = await refreshImagery({ motifIds: [categoryId] });
      return withPurgeStatus(NextResponse.json(updated), purge);
    } catch (e) {
      const code = (e as Error & { code?: string }).code;
      if (
        e instanceof Error &&
        (code === "INVALID_PARENT" || code === "NOT_MOTIF")
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
