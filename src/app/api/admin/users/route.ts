import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withAuth, type AuthenticatedUser } from "@/lib/server/server-auth";
import { getServiceClient, fetchAll, TABLES } from "@/lib/db/supabase-server";
import type { UserRecord } from "@/lib/types";
import { serverErrorResponse } from "@/lib/server/server-utils";

// ─── 更新字段 Zod schema ──────────────────────────────────────────────────────

const userUpdateSchema = z.object({
  id: z.string().uuid("用户 ID 格式无效"),
  name: z
    .string()
    .min(2, "用户名不能少于2个字符")
    .max(50, "用户名不能超过50个字符")
    .optional(),
  display: z.boolean().optional(),
  intro: z.string().max(500, "简介不能超过500个字符").nullable().optional(),
  is_admin: z.boolean().optional(),
  navid_id: z.string().max(100).nullable().optional(),
  // navid_pw 为只写字段，允许为空字符串（表示不修改）
  navid_pw: z.string().max(200).nullable().optional(),
  // endpoint 为登录网址，普通字段
  endpoint: z.string().max(500).nullable().optional(),
});

// ─── GET: 列出所有用户（不含 navid_pw）────────────────────────────────────────

export const GET = withAuth(
  async (_request: NextRequest, _user: AuthenticatedUser) => {
    const supabase = getServiceClient();
    if (!supabase) {
      return NextResponse.json({ error: "服务暂不可用" }, { status: 503 });
    }

    const users = await fetchAll<UserRecord>(
      supabase,
      TABLES.USERS,
      "id, name, display, intro, is_admin, is_super, navid_id, endpoint",
      (q) => q.order("sort_order", { ascending: true, nullsFirst: false }),
    );

    return NextResponse.json({ users });
  },
  { requireSuperAdmin: true },
);

// ─── PUT: 更新指定用户字段────────────────────────────────────────────────────

export const PUT = withAuth(
  async (request: NextRequest, _user: AuthenticatedUser) => {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "请求体格式无效" }, { status: 400 });
    }

    const parsed = userUpdateSchema.safeParse(body);
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      return NextResponse.json(
        { error: firstIssue?.message ?? "参数校验失败" },
        { status: 400 },
      );
    }

    const { id, navid_pw, ...fieldsToUpdate } = parsed.data;

    // 防止超级管理员被取消 is_admin 权限
    if (fieldsToUpdate.is_admin === false) {
      const supabase = getServiceClient();
      if (!supabase) {
        return NextResponse.json({ error: "服务暂不可用" }, { status: 503 });
      }
      const { data: targetUser } = await supabase
        .from(TABLES.USERS)
        .select("is_super")
        .eq("id", id)
        .maybeSingle();
      if (targetUser?.is_super === true) {
        return NextResponse.json(
          { error: "不能撤销超级管理员的管理权限" },
          { status: 403 },
        );
      }
    }

    // 构造最终更新对象（排除 undefined，允许 null）
    const updateObj: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(fieldsToUpdate)) {
      if (value !== undefined) updateObj[key] = value;
    }
    // navid_pw 非空字符串时才写入（空字符串表示不修改）
    if (navid_pw !== undefined && navid_pw !== null && navid_pw !== "") {
      updateObj.navid_pw = navid_pw;
    } else if (navid_pw === null) {
      updateObj.navid_pw = null;
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
      return serverErrorResponse("PUT /api/admin/users", error, "更新失败");
    }

    return NextResponse.json({ success: true });
  },
  { requireSuperAdmin: true, requireCSRF: true },
);
