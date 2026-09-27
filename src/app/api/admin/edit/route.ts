import { NextRequest, NextResponse } from "next/server";
import { getSongs, createSong, updateSong } from "@/lib/server/service-songs";
import { TABLES } from "@/lib/db/supabase-server";
import { createSupabaseServerClient } from "@/lib/db/supabase-auth";
import { z } from "zod";
import { withAuth, type AuthenticatedUser } from "@/lib/server/server-auth";

//类型校验
const SongSchema = z.object({
  title: z.string().min(1).max(100),
  album: z.string().max(100).nullable().optional(),
  genre: z.array(z.string().max(30)).nullable().optional(),
  lyricist: z.array(z.string().max(30)).nullable().optional(),
  composer: z.array(z.string().max(30)).nullable().optional(),
  artist: z.array(z.string().max(30)).nullable().optional(),
  length: z.number().int().min(1).nullable().optional(),
  hascover: z.boolean().nullable().optional(),
  date: z.string().max(30).nullable().optional(),
  type: z.array(z.string().max(30)).nullable().optional(),
  albumartist: z.array(z.string().max(30)).nullable().optional(),
  arranger: z.array(z.string().max(30)).nullable().optional(),
  comment: z.string().max(10000).nullable().optional(),
  discnumber: z.number().int().min(1).nullable().optional(),
  disctotal: z.number().int().min(1).nullable().optional(),
  lyrics: z.string().max(10000).nullable().optional(),
  lyrics_start: z
    .string()
    .regex(/^\d{1,2}:\d{2}(?:\.\d{2,3})?$/)
    .nullable()
    .optional(),
  track: z.number().int().min(1).nullable().optional(),
  tracktotal: z.number().int().min(1).nullable().optional(),
  kugolink: z.url().max(200).nullable().optional(),
  qmlink: z.url().max(200).nullable().optional(),
  nelink: z.url().max(200).nullable().optional(),
  nmn_status: z.boolean().nullable().optional(),
});

export const GET = withAuth(
  async (_request: NextRequest, _user: AuthenticatedUser) => {
    try {
      const supabase = await createSupabaseServerClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const songs = await getSongs(TABLES.ADMIN, session?.access_token);
      return NextResponse.json(songs);
    } catch (e: unknown) {
      if (
        e &&
        typeof e === "object" &&
        "message" in e &&
        typeof (e as Error).message === "string"
      ) {
        console.error("GET songs error:", (e as Error).message);
      } else {
        console.error("GET songs error:", e);
      }
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
      const body = await request.json();
      // 校验 body
      const parseResult = SongSchema.safeParse(body);
      if (!parseResult.success) {
        return NextResponse.json(
          { error: "Invalid input", details: parseResult.error.issues },
          { status: 400 },
        );
      }

      const supabase = await createSupabaseServerClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const song = await createSong(
        parseResult.data,
        TABLES.ADMIN,
        session?.access_token,
      );
      return NextResponse.json(song);
    } catch (e: unknown) {
      if (
        e &&
        typeof e === "object" &&
        "message" in e &&
        typeof (e as Error).message === "string"
      ) {
        console.error("POST song error:", (e as Error).message);
      } else {
        console.error("POST song error:", e);
      }
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 },
      );
    }
  },
  { requireCSRF: true, requireAdmin: true },
);

export const PUT = withAuth(
  async (request: NextRequest, _user: AuthenticatedUser) => {
    try {
      const body = await request.json();
      const { id, updated_at, ...data } = body;
      if (!id || typeof id !== "number" || id < 1 || !Number.isInteger(id))
        return NextResponse.json(
          { error: "Missing or invalid id" },
          { status: 400 },
        );
      // 校验 data
      const parseResult = SongSchema.safeParse(data);
      if (!parseResult.success) {
        return NextResponse.json(
          { error: "Invalid input", details: parseResult.error.issues },
          { status: 400 },
        );
      }
      const supabase = await createSupabaseServerClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      // 传递 updated_at
      const song = await updateSong(
        id,
        { ...parseResult.data, updated_at },
        TABLES.ADMIN,
        session?.access_token,
      );
      return NextResponse.json(song);
    } catch (e: unknown) {
      if (
        e &&
        typeof e === "object" &&
        ((e as { status?: number; message?: string }).status === 409 ||
          ((e as { message?: string }).message &&
            (e as { message: string }).message.includes("乐观锁冲突")))
      ) {
        return NextResponse.json(
          { error: "数据已被他人修改，请刷新页面后重试" },
          { status: 409 },
        );
      }
      if (
        e &&
        typeof e === "object" &&
        "message" in e &&
        typeof (e as Error).message === "string"
      ) {
        console.error("PUT song error:", (e as Error).message);
      } else {
        console.error("PUT song error:", e);
      }
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 },
      );
    }
  },
  { requireCSRF: true, requireAdmin: true },
);
