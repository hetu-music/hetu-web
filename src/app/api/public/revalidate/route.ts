import { NextRequest, NextResponse } from "next/server";
import { safeCompareSecret } from "@/lib/server/server-utils";
import {
  refreshAllSongPages,
  refreshPublicPages,
  refreshSongPages,
} from "@/lib/server/server-revalidate";

const SECRET_HEADER = "x-revalidate-secret";

/**
 * 校验刷新密钥。
 *
 * 密钥走请求头而非 query string——query string 会被 Nginx / CDN 的
 * access log 原样记录下来。比较使用常量时间实现。
 */
function isAuthorized(request: NextRequest): boolean {
  return safeCompareSecret(
    request.headers.get(SECRET_HEADER),
    process.env.REVALIDATE_SECRET,
  );
}

export async function POST(request: NextRequest) {
  try {
    if (!isAuthorized(request)) {
      return new NextResponse("ERROR: Invalid secret", {
        status: 401,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }

    // 首页、意象、故事、寻曲、sitemap，以及寻曲候选池与详情页意象索引；
    // 部署后由 start.sh 调用，Next 与 CDN 一起刷新
    await refreshPublicPages();

    const timestamp = new Date().toISOString();

    const response = `SUCCESS: Home page, imagery, story, quiz, and sitemap revalidated at ${timestamp}`;

    return new NextResponse(response, {
      status: 200,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  } catch (error) {
    console.error("Revalidation error:", error);

    return new NextResponse("ERROR: Revalidation failed", {
      status: 500,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
}

// 刷新指定 /song/[id] 页面；id=all 刷新全部详情页（仅 Next）
export async function GET(request: NextRequest) {
  try {
    const id = request.nextUrl.searchParams.get("id");

    if (!isAuthorized(request)) {
      return new NextResponse("ERROR: Invalid secret", {
        status: 401,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }

    if (!id) {
      return new NextResponse("ERROR: Missing id parameter", {
        status: 400,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }

    const timestamp = new Date().toISOString();

    let response: string;

    if (id === "all") {
      refreshAllSongPages();
      response = `SUCCESS: All song pages revalidated at ${timestamp}`;
    } else {
      const songId = Number(id);
      if (!Number.isInteger(songId) || songId < 1) {
        return new NextResponse("ERROR: Invalid id parameter", {
          status: 400,
          headers: { "Content-Type": "text/plain; charset=utf-8" },
        });
      }
      await refreshSongPages([songId]);
      response = `SUCCESS: Page /song/${songId} revalidated at ${timestamp}`;
    }

    return new NextResponse(response, {
      status: 200,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  } catch (error) {
    console.error("Revalidation error:", error);

    return new NextResponse("ERROR: Revalidation failed", {
      status: 500,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
}
