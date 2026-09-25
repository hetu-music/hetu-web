import { NextRequest, NextResponse } from "next/server";
import { withAuth, type AuthenticatedUser } from "@/lib/server/server-auth";
import { fetchWithTimeout } from "@/lib/utils/utils-common";

export const GET = withAuth(
  async (request: NextRequest, _user: AuthenticatedUser) => {
    try {
      // 获取查询参数
      const { searchParams } = new URL(request.url);
      const songId = searchParams.get("songId");
      const fileType = searchParams.get("type"); // 'cover' 或 'score'

      if (!songId || !fileType) {
        return NextResponse.json(
          { error: "Missing songId or type parameter" },
          { status: 400 },
        );
      }

      if (!["cover", "score"].includes(fileType)) {
        return NextResponse.json(
          { error: "Invalid file type. Must be 'cover' or 'score'" },
          { status: 400 },
        );
      }

      // 构建文件URL
      const baseUrl = "https://cover.hetu-music.com";
      const filePath =
        fileType === "cover" ? `cover/${songId}.jpg` : `nmn/${songId}.png`;
      const fileUrl = `${baseUrl}/${filePath}`;

      // 发送HEAD请求检查文件是否存在
      // 只取响应头，正常应在百毫秒级返回；后台编辑时这个请求是同步阻塞的
      const response = await fetchWithTimeout(
        fileUrl,
        { method: "HEAD" },
        5000,
      );

      const exists = response.status === 200;

      return NextResponse.json({
        exists,
        songId: parseInt(songId),
        fileType,
        url: fileUrl,
      });
    } catch (error) {
      console.error("Check file error:", error);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 },
      );
    }
  },
  { requireCSRF: true, requireAdmin: true },
);
