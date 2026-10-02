import { writeFile } from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";

/**
 * 调参面板把场景配置写回仓库。只在开发环境存在：生产环境一律 404。
 * 文件名只允许 scenes/ 下的几种，免得被拿去写任意路径。
 */

const SCENES_DIR = path.join(
  process.cwd(),
  "src",
  "components",
  "story",
  "qjtx",
  "scenes",
);
const ALLOWED = /^(\d+|spine|style)\.json$/;

export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV !== "development") {
    return new NextResponse(null, { status: 404 });
  }
  const origin = request.headers.get("origin");
  if (origin && new URL(origin).host !== request.headers.get("host")) {
    return new NextResponse("cross-origin", { status: 403 });
  }

  const { file, data } = (await request.json()) as {
    file?: string;
    data?: unknown;
  };
  if (!file || !ALLOWED.test(file) || data === undefined) {
    return new NextResponse("bad request", { status: 400 });
  }
  await writeFile(
    path.join(SCENES_DIR, file),
    `${JSON.stringify(data, null, 2)}\n`,
  );
  return NextResponse.json({ ok: true });
}
