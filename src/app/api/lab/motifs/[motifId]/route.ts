import { NextRequest, NextResponse } from "next/server";
import { getMotif } from "@/components/lab/imagery/data";

/** 意象原型的面板内容：一个母题的写法、作品与同写 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ motifId: string }> },
) {
  const { motifId } = await params;
  const id = parseInt(motifId, 10);
  if (isNaN(id)) {
    return NextResponse.json({ motif: null }, { status: 400 });
  }
  try {
    const motif = await getMotif(id);
    return NextResponse.json({ motif }, { status: motif ? 200 : 404 });
  } catch (err) {
    console.error("Failed to load motif:", err);
    return NextResponse.json({ motif: null }, { status: 500 });
  }
}
