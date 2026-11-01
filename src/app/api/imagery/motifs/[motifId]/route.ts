import { NextRequest, NextResponse } from "next/server";
import { PUBLIC_API_CACHE, NO_STORE_HEADERS } from "@/lib/server/cache-headers";
import { localeFromRequest } from "@/lib/server/request-locale";
import { parseRouteId } from "@/lib/server/route-params";
import { getMotifDetail } from "@/lib/server/service-imagery-cloud";

/** 意象词云的面板：一个母题的写法与作品。?locale=zh-TW 时转繁体 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ motifId: string }> },
) {
  const { motifId } = await params;
  const id = parseRouteId(motifId);
  if (id === null) {
    return NextResponse.json(
      { motif: null },
      { status: 400, headers: NO_STORE_HEADERS },
    );
  }
  const locale = localeFromRequest(req);

  try {
    const motif = await getMotifDetail(id, locale);
    if (!motif)
      return NextResponse.json(
        { motif: null },
        { status: 404, headers: NO_STORE_HEADERS },
      );
    return NextResponse.json(
      { motif },
      { headers: { "Cache-Control": PUBLIC_API_CACHE } },
    );
  } catch (err) {
    console.error("Failed to load motif:", err);
    return NextResponse.json(
      { motif: null },
      { status: 500, headers: NO_STORE_HEADERS },
    );
  }
}
