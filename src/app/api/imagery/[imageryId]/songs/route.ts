import { NextRequest, NextResponse } from "next/server";
import { getSongsForImagery } from "@/lib/server/service-imagery";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ imageryId: string }> },
) {
  const { imageryId } = await params;
  const id = parseInt(imageryId, 10);
  if (isNaN(id)) {
    return NextResponse.json({ songs: [] }, { status: 400 });
  }

  try {
    const results = await getSongsForImagery(id);
    return NextResponse.json(
      { songs: results },
      {
        headers: {
          // 公开只读数据，与 lyrics-index / songs/:id/lyrics 保持一致：
          // CDN 缓存 6 小时，过期后 30 分钟内先返回旧值再后台刷新
          "Cache-Control":
            "public, s-maxage=21600, stale-while-revalidate=1800",
        },
      },
    );
  } catch (err) {
    console.error("Failed to fetch songs for imagery:", err);
    return NextResponse.json({ songs: [] }, { status: 500 });
  }
}
