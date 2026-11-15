import { NextRequest, NextResponse } from "next/server";
import {
  withAuth,
  type AuthenticatedUser,
  type AuthContext,
} from "@/lib/server/server-auth";
import { getImageryTaxonomy, createMotif } from "@/lib/server/service-imagery";
import {
  refreshImagery,
  withPurgeStatus,
} from "@/lib/server/server-revalidate";
import { z } from "zod";
import { parseJsonBody } from "@/lib/server/parse-body";

/**
 * GET 返回类别与母题（{ categories, motifs }）。类别固定，只能新建母题：
 * 挂在某个类别下，说明必填（见 IMAGERY.md）
 */
const CreateMotifSchema = z.object({
  name: z.string().trim().min(1).max(50),
  category_id: z.number().int().positive(),
  description: z.string().trim().min(1, "写一句这个母题指什么").max(500),
});

export const GET = withAuth(
  async (_request: NextRequest, _user: AuthenticatedUser) => {
    try {
      return NextResponse.json(await getImageryTaxonomy());
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
  async (
    request: NextRequest,
    _user: AuthenticatedUser,
    { accessToken }: AuthContext,
  ) => {
    try {
      const { data: input, response: invalid } = await parseJsonBody(
        request,
        CreateMotifSchema,
      );
      if (invalid) return invalid;

      const created = await createMotif(input, accessToken);
      const purge = await refreshImagery();
      return withPurgeStatus(NextResponse.json(created), purge);
    } catch (e) {
      if (
        e instanceof Error &&
        (e as Error & { code?: string }).code === "INVALID_CATEGORY"
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
