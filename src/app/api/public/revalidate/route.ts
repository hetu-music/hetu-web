import { revalidatePath, revalidateTag } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { locales } from "@/i18n/config";
import { QUIZ_POOL_TAG } from "@/lib/quiz/pool";
import { safeCompareSecret } from "@/lib/server/server-utils";

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

    // 重新验证各语言版本的页面缓存
    for (const locale of locales) {
      revalidatePath(`/${locale}`);
      revalidatePath(`/${locale}/imagery`);
      revalidatePath(`/${locale}/story/qjtx`);
      revalidatePath(`/${locale}/quiz`);
    }

    // 寻曲候选池由意象标注聚合并单独缓存；立即失效，让随后重新生成的
    // /quiz 页面读到最新数据，而不是构建期（占位凭据）留下的空结果
    revalidateTag(QUIZ_POOL_TAG, { expire: 0 });

    // 防范未命中重写路径的缓存，同时也刷新 sitemap
    revalidatePath("/");
    revalidatePath("/imagery");
    revalidatePath("/story/qjtx");
    revalidatePath("/quiz");
    revalidatePath("/sitemap.xml");

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

// 新增: 刷新指定 /song/[id] 页面的 GET 路由
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
      for (const locale of locales) {
        revalidatePath(`/${locale}/song/[id]`, "page");
      }
      revalidatePath("/song/[id]", "page");
      response = `SUCCESS: All song pages revalidated at ${timestamp}`;
    } else {
      for (const locale of locales) {
        revalidatePath(`/${locale}/song/${id}`);
      }
      revalidatePath(`/song/${id}`);
      response = `SUCCESS: Page /song/${id} revalidated at ${timestamp}`;
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
