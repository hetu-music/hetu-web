import { NextRequest, NextResponse } from "next/server";
import { withAuth, type AuthenticatedUser } from "@/lib/server/server-auth";
import { createSupabaseServerClient } from "@/lib/db/supabase-auth";
import { getServiceClient, TABLES } from "@/lib/db/supabase-server";
import {
  fetchNavidromeSong,
  navidromeConfigFromEnv,
} from "@/lib/navidrome/client";
import {
  buildStreamUrl,
  streamLinkConfigFromEnv,
  streamModeFor,
  type StreamMode,
} from "@/lib/navidrome/stream-link";

/**
 * 每位用户在滚动窗口内最多能取几首「不同的」歌。拖进度条会带 timeOffset 重新取地址，
 * 同一首歌重复取不算新的一首。正常听歌一小时十几首、一天几百首，这里只拦批量拉取。
 */
const HOURLY_SONG_LIMIT = 60;
const DAILY_SONG_LIMIT = 400;

/** 取时长最多等这么久，超时就不带时长，不耽误起播 */
const DURATION_TIMEOUT_MS = 3000;

/**
 * 登记一次取流并检查额度，返回 true 表示放行。
 * 数据库出错时放行并记日志：用户就那么几个，限流失效比放不了歌好。
 */
async function claimStreamGrant(
  supabase: NonNullable<ReturnType<typeof getServiceClient>>,
  userId: string,
  songId: number,
): Promise<boolean> {
  const { data, error } = await supabase.rpc("claim_stream_grant", {
    p_user_id: userId,
    p_song_id: songId,
    p_hour_limit: HOURLY_SONG_LIMIT,
    p_day_limit: DAILY_SONG_LIMIT,
  });
  if (error) {
    console.error("[stream-url] claim_stream_grant failed:", error);
    return true;
  }
  return data === "ok";
}

export const GET = withAuth(
  async (request: NextRequest, user: AuthenticatedUser) => {
    const { searchParams } = new URL(request.url);
    const songIdStr = searchParams.get("songId")?.trim();
    const timeOffset = Math.max(
      0,
      Math.floor(Number(searchParams.get("timeOffset")) || 0),
    );

    if (!songIdStr) {
      return NextResponse.json(
        { error: "songId is required" },
        { status: 400 },
      );
    }

    const songId = parseInt(songIdStr, 10);
    if (isNaN(songId)) {
      return NextResponse.json({ error: "invalid songId" }, { status: 400 });
    }

    // 有试听权益的用户才能取链接；播放本身走服务账号和签名链接
    const supabase = await createSupabaseServerClient();
    const { data: userData, error: userErr } = await supabase
      .from(TABLES.USERS)
      .select("can_stream")
      .eq("id", user.id)
      .maybeSingle();

    if (userErr || !userData) {
      return NextResponse.json(
        { error: "Failed to fetch user" },
        { status: 500 },
      );
    }

    if ((userData as { can_stream: boolean }).can_stream !== true) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const linkConfig = streamLinkConfigFromEnv();
    const serviceClient = getServiceClient();
    if (!linkConfig || !serviceClient) {
      return NextResponse.json(
        { error: "Service unavailable" },
        { status: 503 },
      );
    }

    const { data: navidRow, error: navidErr } = await serviceClient
      .from(TABLES.NAVID_SONG)
      .select("navid_id")
      .eq("id", songId)
      .maybeSingle();

    if (navidErr) {
      return NextResponse.json(
        { error: "Failed to query navid_song" },
        { status: 500 },
      );
    }

    if (!navidRow?.navid_id) {
      return NextResponse.json(
        { error: "No audio file for this song" },
        { status: 404 },
      );
    }

    if (!(await claimStreamGrant(serviceClient, user.id, songId))) {
      return NextResponse.json({ error: "Too many songs" }, { status: 429 });
    }

    const navidSongId = navidRow.navid_id as string;

    // 曲目元数据：时长（opus 流没有 Content-Length，浏览器读不出 audio.duration，
    // 也用来算链接的过期时间）和格式（有损源直接发原文件）。
    // 取不到时不带时长、按转码处理，不影响播放
    let duration: number | null = null;
    let mode: StreamMode = "transcode";
    const navidrome = navidromeConfigFromEnv();
    if (navidrome) {
      try {
        const song = await fetchNavidromeSong(navidrome, navidSongId, {
          timeoutMs: DURATION_TIMEOUT_MS,
        });
        duration = song?.duration ?? null;
        mode = streamModeFor(song);
      } catch {
        // 降级为转码、无时长
      }
    }

    return NextResponse.json({
      url: buildStreamUrl(linkConfig, {
        navidId: navidSongId,
        userId: user.id,
        duration,
        mode,
        timeOffset,
      }),
      duration,
      // 原文件支持分段请求，浏览器能原生跳转；转码流跳转要带 timeOffset 重新取
      seekable: mode === "original",
    });
  },
);
