import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withAuth, type AuthenticatedUser } from "@/lib/server/server-auth";
import { createSupabaseServerClient } from "@/lib/db/supabase-auth";
import { getServiceClient, TABLES } from "@/lib/db/supabase-server";
import { serverErrorResponse } from "@/lib/server/server-utils";

// ─── 创建请求 schema ──────────────────────────────────────────────────────────

const createRequestSchema = z.object({
  type: z.enum(["song_feedback", "benefit_apply", "admin_apply"]),
  song_id: z.number().int().positive().nullable().optional(),
  category: z.string().max(100).nullable().optional(),
  content: z
    .string()
    .min(1, "内容不能为空")
    .max(2000, "内容不能超过2000个字符"),
});

// ─── GET: 获取当前用户的所有请求 ──────────────────────────────────────────────

export const GET = withAuth(
  async (_request: NextRequest, user: AuthenticatedUser) => {
    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase
      .from(TABLES.USER_REQUESTS)
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      return serverErrorResponse("GET /api/public/requests", error);
    }

    const rows = data ?? [];

    // 批量查 music 表获取歌曲标题
    const songIds = [
      ...new Set(
        rows
          .map((r) => r.song_id as number | null)
          .filter((id): id is number => id !== null),
      ),
    ];
    let songTitleMap: Record<number, string> = {};
    if (songIds.length > 0) {
      const serviceClient = getServiceClient();
      if (serviceClient) {
        const { data: songsData } = await serviceClient
          .from(TABLES.MUSIC)
          .select("id, title")
          .in("id", songIds);
        if (songsData) {
          songTitleMap = Object.fromEntries(
            songsData.map((s: { id: number; title: string }) => [
              s.id,
              s.title,
            ]),
          );
        }
      }
    }

    const requests = rows.map((row) => ({
      ...row,
      song_title: row.song_id
        ? (songTitleMap[row.song_id as number] ?? null)
        : null,
    }));

    return NextResponse.json({ requests });
  },
);

// ─── POST: 提交新请求 ─────────────────────────────────────────────────────────

export const POST = withAuth(
  async (request: NextRequest, user: AuthenticatedUser) => {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "请求体格式无效" }, { status: 400 });
    }

    const parsed = createRequestSchema.safeParse(body);
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      return NextResponse.json(
        { error: firstIssue?.message ?? "参数校验失败" },
        { status: 400 },
      );
    }

    const { type, song_id, category, content } = parsed.data;

    // song_feedback 必须提供 song_id
    if (type === "song_feedback" && !song_id) {
      return NextResponse.json(
        { error: "歌曲纠错必须指定歌曲" },
        { status: 400 },
      );
    }

    const supabase = await createSupabaseServerClient();

    // 防止重复提交：同类型 pending 状态下只允许一条（benefit_apply / admin_apply）
    if (type === "benefit_apply" || type === "admin_apply") {
      const { data: existing } = await supabase
        .from(TABLES.USER_REQUESTS)
        .select("id")
        .eq("user_id", user.id)
        .eq("type", type)
        .eq("status", "pending")
        .maybeSingle();

      if (existing) {
        return NextResponse.json(
          { error: "您已有一条待处理的同类申请，请等待处理后再提交" },
          { status: 409 },
        );
      }
    }

    const { data, error } = await supabase
      .from(TABLES.USER_REQUESTS)
      .insert({
        user_id: user.id,
        type,
        song_id: song_id ?? null,
        category: category ?? null,
        content,
        status: "pending",
      })
      .select()
      .single();

    if (error) {
      return serverErrorResponse("POST /api/public/requests", error);
    }

    return NextResponse.json({ request: data }, { status: 201 });
  },
  { requireCSRF: true },
);
