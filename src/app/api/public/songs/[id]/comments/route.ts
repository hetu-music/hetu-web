import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/server/server-auth";
import {
  listSongComments,
  localizeQuotes,
} from "@/lib/server/service-comments";
import { serverErrorResponse } from "@/lib/server/server-utils";

// GET /api/public/songs/[id]/comments — 某首歌的批注
// 未登录只能看到公开的；登录后另含自己的私批与待审批注，并标出自己赞过哪些
// ?locale=zh-TW：被批原文转成繁体，好与繁体页的歌词对上
export const GET = async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) => {
  const { id } = await params;
  const songId = Number(id);
  if (!Number.isInteger(songId) || songId < 1) {
    return NextResponse.json({ error: "Invalid song id" }, { status: 400 });
  }

  const viewer = await getUserFromRequest(request).catch(() => null);

  try {
    const locale = request.nextUrl.searchParams.get("locale") ?? "zh-CN";
    const comments = await localizeQuotes(
      await listSongComments(songId, viewer?.id ?? null),
      songId,
      locale,
    );
    return NextResponse.json(
      { comments },
      // 内容随登录身份而变，且新批注要立刻可见
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return serverErrorResponse("GET /api/public/songs/[id]/comments", error);
  }
};
