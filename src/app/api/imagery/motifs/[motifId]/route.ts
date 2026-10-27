import { NextRequest, NextResponse } from "next/server";
import { PUBLIC_AGGREGATE_CACHE } from "@/lib/server/cache-headers";
import { getMotifDetail } from "@/lib/server/service-imagery-cloud";

/** 意象词云的面板：一个母题的写法与作品。?locale=zh-TW 时转繁体 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ motifId: string }> },
) {
  const { motifId } = await params;
  const id = parseInt(motifId, 10);
  if (isNaN(id)) {
    return NextResponse.json({ motif: null }, { status: 400 });
  }
  const locale =
    req.nextUrl.searchParams.get("locale") === "zh-TW" ? "zh-TW" : "zh-CN";

  try {
    const motif = await getMotifDetail(id, locale);
    if (!motif) return NextResponse.json({ motif: null }, { status: 404 });
    return NextResponse.json(
      { motif },
      { headers: { "Cache-Control": PUBLIC_AGGREGATE_CACHE } },
    );
  } catch (err) {
    console.error("Failed to load motif:", err);
    return NextResponse.json({ motif: null }, { status: 500 });
  }
}
