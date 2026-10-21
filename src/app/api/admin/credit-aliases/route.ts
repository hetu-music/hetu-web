import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withAuth, type AuthenticatedUser } from "@/lib/server/server-auth";
import { createSupabaseServerClient } from "@/lib/db/supabase-auth";
import {
  createCreditAlias,
  deleteCreditAlias,
  getPublishedSongIdsCreditedAs,
  listCreditAliases,
  listCreditNames,
  type CreditAliasErrorCode,
} from "@/lib/server/service-credit-aliases";
import {
  refreshSongPages,
  withPurgeStatus,
} from "@/lib/server/server-revalidate";
import { serverErrorResponse } from "@/lib/server/server-utils";
import { parseJsonBody } from "@/lib/server/parse-body";

const CreditNameSchema = z.string().trim().min(1, "名字不能为空").max(100);

const CreateAliasSchema = z
  .object({ alias: CreditNameSchema, name: CreditNameSchema })
  .refine((v) => v.alias !== v.name, { message: "别名不能与主名相同" });

const ERROR_STATUS: Record<CreditAliasErrorCode, number> = {
  ALIAS_EXISTS: 409,
  INVALID_ALIAS: 400,
};

async function getAccessToken(): Promise<string | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

/** 别名只影响署有它的歌；主名没署过的歌不用动 */
async function refreshPagesCreditedAs(alias: string) {
  const ids = await getPublishedSongIdsCreditedAs(alias);
  return refreshSongPages(ids);
}

export const GET = withAuth(
  async (_request: NextRequest, _user: AuthenticatedUser) => {
    const token = await getAccessToken();
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    try {
      const [aliases, names] = await Promise.all([
        listCreditAliases(token),
        listCreditNames(token),
      ]);
      return NextResponse.json({ aliases, names });
    } catch (e) {
      return serverErrorResponse(
        "GET /api/admin/credit-aliases",
        e,
        "加载失败",
      );
    }
  },
  { requireAdmin: true },
);

export const POST = withAuth(
  async (request: NextRequest, _user: AuthenticatedUser) => {
    const { data: input, response: invalid } = await parseJsonBody(
      request,
      CreateAliasSchema,
    );
    if (invalid) return invalid;

    const token = await getAccessToken();
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
      const created = await createCreditAlias(input.alias, input.name, token);
      const purge = await refreshPagesCreditedAs(created.alias);
      return withPurgeStatus(NextResponse.json(created), purge);
    } catch (e) {
      const code = (e as { code?: string }).code as CreditAliasErrorCode;
      if (code in ERROR_STATUS) {
        return NextResponse.json(
          { error: (e as Error).message },
          { status: ERROR_STATUS[code] },
        );
      }
      return serverErrorResponse(
        "POST /api/admin/credit-aliases",
        e,
        "登记失败",
      );
    }
  },
  { requireCSRF: true, requireAdmin: true },
);

export const DELETE = withAuth(
  async (request: NextRequest, _user: AuthenticatedUser) => {
    const parsed = CreditNameSchema.safeParse(
      request.nextUrl.searchParams.get("alias") ?? "",
    );
    if (!parsed.success) {
      return NextResponse.json({ error: "缺少别名" }, { status: 400 });
    }

    const token = await getAccessToken();
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
      const deleted = await deleteCreditAlias(parsed.data, token);
      if (!deleted) {
        return NextResponse.json({ error: "别名不存在" }, { status: 404 });
      }
      const purge = await refreshPagesCreditedAs(parsed.data);
      return withPurgeStatus(NextResponse.json({ success: true }), purge);
    } catch (e) {
      return serverErrorResponse(
        "DELETE /api/admin/credit-aliases",
        e,
        "删除失败",
      );
    }
  },
  { requireCSRF: true, requireAdmin: true },
);
