import { NextRequest, NextResponse } from "next/server";
import { withAuth, type AuthenticatedUser } from "@/lib/server/server-auth";
import {
  deleteEntryHandler,
  entryWriteHandlers,
} from "@/lib/server/collation-routes";
import { getSongCollations, lyricRow } from "@/lib/server/service-collations";
import { collationInputSchema } from "@/lib/utils/utils-collations";

const ROUTE = "/api/admin/collations";

/** 一首歌的校记与补遗：GET /api/admin/collations?song_id= */
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

const write = entryWriteHandlers(ROUTE, collationInputSchema, lyricRow);

/** 新增歌词校记：POST，{ song_id, entry } */
export const POST = write.POST;
/** 修改歌词校记：PUT，{ id, entry } */
export const PUT = write.PUT;
/** 删除一条校记或补遗：DELETE，{ id } */
export const DELETE = deleteEntryHandler(ROUTE);
