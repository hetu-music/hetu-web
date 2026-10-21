import { NextRequest, NextResponse } from "next/server";
import { withAuth, type AuthenticatedUser } from "@/lib/server/server-auth";
import { getServiceClient, TABLES } from "@/lib/db/supabase-server";
import { serverErrorResponse } from "@/lib/server/server-utils";

const PAGE_SIZE = 50;

export const GET = withAuth(
  async (request: NextRequest, _user: AuthenticatedUser) => {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
    const table = searchParams.get("table");
    const from = (page - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    const supabase = getServiceClient();
    if (!supabase) {
      return NextResponse.json({ error: "服务暂不可用" }, { status: 503 });
    }

    let query = supabase
      .from(TABLES.AUDIT_LOGS)
      .select(
        "id, table_name, action_type, user_id, old_data, new_data, changed_at",
        {
          count: "exact",
        },
      );

    if (table && table !== "all") {
      query = query.eq("table_name", table);
    }

    const { data, error, count } = await query
      .order("changed_at", { ascending: false })
      .range(from, to);

    if (error) {
      return serverErrorResponse("GET /api/admin/audit-logs", error);
    }

    const rows = data ?? [];

    // 批量查 public.users 获取操作人的用户名
    const userIds = [
      ...new Set(
        rows
          .map((r) => r.user_id as string | null)
          .filter((id): id is string => id !== null),
      ),
    ];
    let userNameMap: Record<string, string> = {};
    if (userIds.length > 0) {
      const { data: usersData } = await supabase
        .from(TABLES.USERS)
        .select("id, name")
        .in("id", userIds);
      if (usersData) {
        userNameMap = Object.fromEntries(
          usersData.map((u: { id: string; name: string }) => [u.id, u.name]),
        );
      }
    }

    return NextResponse.json({
      logs: rows.map((row) => ({
        ...row,
        user_name: row.user_id
          ? (userNameMap[row.user_id as string] ?? null)
          : null,
      })),
      total: count ?? 0,
      page,
      pageSize: PAGE_SIZE,
    });
  },
  { requireSuperAdmin: true },
);
