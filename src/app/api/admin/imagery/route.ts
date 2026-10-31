import { NextRequest, NextResponse } from "next/server";
import { withAuth, type AuthenticatedUser } from "@/lib/server/server-auth";
import { getImageryWithCounts } from "@/lib/server/service-imagery";

/**
 * 后台词典：GET /api/admin/imagery。
 * 词不单独新建或改名：标注时按歌词原文创建，见 occurrences/batch
 */
export const GET = withAuth(
  async (_request: NextRequest, _user: AuthenticatedUser) => {
    try {
      // 后台要看到全部词，包括只在争议歌曲里出现、或已没有标注的
      const items = await getImageryWithCounts();
      return NextResponse.json(items);
    } catch (e) {
      console.error("[GET /api/admin/imagery]", e);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 },
      );
    }
  },
  { requireAdmin: true },
);
