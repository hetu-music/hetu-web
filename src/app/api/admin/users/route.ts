import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withAuth, type AuthenticatedUser } from "@/lib/server/server-auth";
import { getServiceClient, fetchAll, TABLES } from "@/lib/db/supabase-server";
import type { UserRecord } from "@/lib/types";
import { serverErrorResponse } from "@/lib/server/server-utils";
import {
  refreshContributors,
  withPurgeStatus,
} from "@/lib/server/server-revalidate";
import { parseJsonBody } from "@/lib/server/parse-body";
import {
  DISPLAY_NAME_TAKEN,
  displayNameField,
} from "@/lib/forms/account-rules";

// ─── 更新字段 Zod schema ──────────────────────────────────────────────────────

const userUpdateSchema = z.object({
  id: z.string().uuid("用户 ID 格式无效"),
  // 与用户自己改名同一套规则：去首尾空格、2–30 字
  name: displayNameField.optional(),
  display: z.boolean().optional(),
  intro: z.string().max(500, "简介不能超过500个字符").nullable().optional(),
  // 超级管理员不在界面上指派（见 lib/auth/roles）
  role: z.enum(["user", "bot", "admin"]).optional(),
  can_stream: z.boolean().optional(),
});

// ─── GET: 列出所有用户 ────────────────────────────────────────────────────────

export const GET = withAuth(
  async (_request: NextRequest, _user: AuthenticatedUser) => {
    const supabase = getServiceClient();
    if (!supabase) {
      return NextResponse.json({ error: "服务暂不可用" }, { status: 503 });
    }

    const users = await fetchAll<UserRecord>(
      supabase,
      TABLES.USERS,
      "id, name, display, intro, role, can_stream",
      (q) => q.order("sort_order", { ascending: true, nullsFirst: false }),
    );

    return NextResponse.json({ users });
  },
  { requireSuperAdmin: true },
);

// ─── PUT: 更新指定用户字段────────────────────────────────────────────────────

export const PUT = withAuth(
  async (request: NextRequest, _user: AuthenticatedUser) => {
    const { data: input, response: invalid } = await parseJsonBody(
      request,
      userUpdateSchema,
    );
    if (invalid) return invalid;

    const { id, ...fieldsToUpdate } = input;

    // 超级管理员的角色不能在这里改
    if (fieldsToUpdate.role !== undefined) {
      const supabase = getServiceClient();
      if (!supabase) {
        return NextResponse.json({ error: "服务暂不可用" }, { status: 503 });
      }
      const { data: targetUser } = await supabase
        .from(TABLES.USERS)
        .select("role")
        .eq("id", id)
        .maybeSingle();
      if (targetUser?.role === "super") {
        return NextResponse.json(
          { error: "不能改超级管理员的角色" },
          { status: 403 },
        );
      }
    }

    // 构造最终更新对象（排除 undefined，允许 null）
    const updateObj: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(fieldsToUpdate)) {
      if (value !== undefined) updateObj[key] = value;
    }

    if (Object.keys(updateObj).length === 0) {
      return NextResponse.json(
        { error: "未提供任何更新字段" },
        { status: 400 },
      );
    }

    const supabase = getServiceClient();
    if (!supabase) {
      return NextResponse.json({ error: "服务暂不可用" }, { status: 503 });
    }

    const { error } = await supabase
      .from(TABLES.USERS)
      .update(updateObj)
      .eq("id", id);

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json(
          { error: DISPLAY_NAME_TAKEN },
          { status: 409 },
        );
      }
      return serverErrorResponse("PUT /api/admin/users", error, "更新失败");
    }

    return withPurgeStatus(
      NextResponse.json({ success: true }),
      await refreshContributors(),
    );
  },
  { requireSuperAdmin: true, requireCSRF: true },
);
