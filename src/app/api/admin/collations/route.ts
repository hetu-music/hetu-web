import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withAuth, type AuthenticatedUser } from "@/lib/server/server-auth";
import { createSupabaseServerClient } from "@/lib/db/supabase-auth";
import {
  CollationError,
  createCollation,
  deleteCollation,
  getSongCollations,
  updateCollation,
} from "@/lib/server/service-collations";
import {
  refreshCollations,
  withPurgeStatus,
} from "@/lib/server/server-revalidate";
import { serverErrorResponse } from "@/lib/server/server-utils";
import { parseJsonBody } from "@/lib/server/parse-body";
import { collationInputSchema } from "@/lib/utils/utils-collations";

const id = z.number().int().positive();
const CreateSchema = z.object({ song_id: id, collation: collationInputSchema });
const UpdateSchema = z.object({ id, collation: collationInputSchema });
const DeleteSchema = z.object({ id });

async function accessToken(): Promise<string | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

function failed(route: string, e: unknown) {
  if (e instanceof CollationError) {
    return NextResponse.json({ error: e.message }, { status: e.status });
  }
  return serverErrorResponse(route, e, "保存失败");
}

/** 一首歌的校记：GET /api/admin/collations?song_id= */
export const GET = withAuth(
  async (request: NextRequest, _user: AuthenticatedUser) => {
    const songId = Number(request.nextUrl.searchParams.get("song_id"));
    if (!Number.isInteger(songId) || songId < 1) {
      return NextResponse.json({ error: "Invalid song_id" }, { status: 400 });
    }
    const collations = await getSongCollations(songId, "zh-CN");
    return NextResponse.json({ collations });
  },
  { requireAdmin: true },
);

/** 新增：POST /api/admin/collations */
export const POST = withAuth(
  async (request: NextRequest, _user: AuthenticatedUser) => {
    const { data: input, response: invalid } = await parseJsonBody(
      request,
      CreateSchema,
    );
    if (invalid) return invalid;
    const token = await accessToken();
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    try {
      const newId = await createCollation(
        input.song_id,
        input.collation,
        token,
      );
      const purge = await refreshCollations(input.song_id);
      return withPurgeStatus(NextResponse.json({ id: newId }), purge);
    } catch (e) {
      return failed("POST /api/admin/collations", e);
    }
  },
  { requireCSRF: true, requireAdmin: true },
);

/** 修改：PUT /api/admin/collations */
export const PUT = withAuth(
  async (request: NextRequest, _user: AuthenticatedUser) => {
    const { data: input, response: invalid } = await parseJsonBody(
      request,
      UpdateSchema,
    );
    if (invalid) return invalid;
    const token = await accessToken();
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    try {
      const songId = await updateCollation(input.id, input.collation, token);
      const purge = await refreshCollations(songId);
      return withPurgeStatus(NextResponse.json({ success: true }), purge);
    } catch (e) {
      return failed("PUT /api/admin/collations", e);
    }
  },
  { requireCSRF: true, requireAdmin: true },
);

/** 删除：DELETE /api/admin/collations */
export const DELETE = withAuth(
  async (request: NextRequest, _user: AuthenticatedUser) => {
    const { data: input, response: invalid } = await parseJsonBody(
      request,
      DeleteSchema,
    );
    if (invalid) return invalid;
    const token = await accessToken();
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    try {
      const songId = await deleteCollation(input.id, token);
      const purge = await refreshCollations(songId);
      return withPurgeStatus(NextResponse.json({ success: true }), purge);
    } catch (e) {
      return failed("DELETE /api/admin/collations", e);
    }
  },
  { requireCSRF: true, requireAdmin: true },
);
