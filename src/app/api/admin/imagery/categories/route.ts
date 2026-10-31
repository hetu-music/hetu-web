import { NextRequest, NextResponse } from "next/server";
import { withAuth, type AuthenticatedUser } from "@/lib/server/server-auth";
import {
  getImageryCategories,
  createMotif,
} from "@/lib/server/service-imagery";
import {
  refreshImagery,
  withPurgeStatus,
} from "@/lib/server/server-revalidate";
import { createSupabaseServerClient } from "@/lib/db/supabase-auth";
import { z } from "zod";
import { parseJsonBody } from "@/lib/server/parse-body";

/** 只能新建母题：挂在某个类别（第二级）下，说明必填（见 IMAGERY.md） */
const CreateMotifSchema = z.object({
  name: z.string().trim().min(1).max(50),
  parent_id: z.number().int().positive(),
  description: z.string().trim().min(1, "写一句这个母题指什么").max(500),
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
        CreateMotifSchema,
      );
      if (invalid) return invalid;

      const supabase = await createSupabaseServerClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      const created = await createMotif(input, session.access_token);
      const purge = await refreshImagery();
      return withPurgeStatus(NextResponse.json(created), purge);
    } catch (e) {
      if (
        e instanceof Error &&
        (e as Error & { code?: string }).code === "INVALID_PARENT"
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
