import { NextRequest, NextResponse } from "next/server";
import {
  withAuth,
  type AuthenticatedUser,
  type AuthContext,
} from "@/lib/server/server-auth";
import {
  updateOccurrence,
  deleteOccurrence,
} from "@/lib/server/service-imagery";
import { z } from "zod";
import { parseJsonBody } from "@/lib/server/parse-body";

/** 词给 imagery_id 或 imagery_name（歌词里的原文，词典里没有时创建），二者择一 */
const UpdateOccurrenceSchema = z
  .object({
    imagery_id: z.number().int().positive().optional(),
    imagery_name: z.string().trim().min(1).max(50).optional(),
    motif_id: z.number().int().positive().optional(),
  })
  .refine((v) => v.imagery_id === undefined || v.imagery_name === undefined, {
    message: "imagery_id 与 imagery_name 只能给一个",
  });

function getIdFromUrl(request: NextRequest): number | null {
  const segments = request.nextUrl.pathname.split("/");
  const id = parseInt(segments[segments.length - 1], 10);
  return isNaN(id) || id < 1 ? null : id;
}

export const PUT = withAuth(
  async (
    request: NextRequest,
    _user: AuthenticatedUser,
    { accessToken }: AuthContext,
  ) => {
    const id = getIdFromUrl(request);
    if (!id) return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    try {
      const { data: input, response: invalid } = await parseJsonBody(
        request,
        UpdateOccurrenceSchema,
      );
      if (invalid) return invalid;
      // 改在草稿上，线上不变；发布时再刷新
      const updated = await updateOccurrence(id, input, accessToken);
      return NextResponse.json(updated);
    } catch (e) {
      if (
        e instanceof Error &&
        ["NOT_MOTIF", "IMAGERY_NOT_IN_LYRICS", "DUPLICATE_OCCURRENCE"].includes(
          (e as Error & { code?: string }).code ?? "",
        )
      ) {
        return NextResponse.json({ error: e.message }, { status: 400 });
      }
      console.error("[PUT /api/admin/occurrences/[id]]", e);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 },
      );
    }
  },
  { requireCSRF: true, requireAdmin: true },
);

export const DELETE = withAuth(
  async (
    request: NextRequest,
    _user: AuthenticatedUser,
    { accessToken }: AuthContext,
  ) => {
    const id = getIdFromUrl(request);
    if (!id) return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    try {
      // 删在草稿上；发布时再刷新
      await deleteOccurrence(id, accessToken);
      return NextResponse.json({ success: true });
    } catch (e) {
      console.error("[DELETE /api/admin/occurrences/[id]]", e);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 },
      );
    }
  },
  { requireCSRF: true, requireAdmin: true },
);
