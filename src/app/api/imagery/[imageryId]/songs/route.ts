import { NextRequest, NextResponse } from "next/server";
import { PUBLIC_API_CACHE } from "@/lib/server/cache-headers";
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
        headers: { "Cache-Control": PUBLIC_API_CACHE },
      },
    );
  } catch (err) {
    console.error("Failed to fetch songs for imagery:", err);
    return NextResponse.json({ songs: [] }, { status: 500 });
  }
}
