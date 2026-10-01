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

/** 现场向 Navidrome 取曲目信息最多等这么久，超时就不带时长、按转码处理 */
const DURATION_TIMEOUT_MS = 3000;

/**
 * navid_song 里还没有格式、时长时（尚未跑过同步回填），现场问 Navidrome。
 * 取不到就不带时长、按转码处理，不影响播放
 */
async function fetchMediaLive(
  navidId: string,
): Promise<{ suffix: string | null; duration: number | null }> {
  const navidrome = navidromeConfigFromEnv();
  if (!navidrome) return { suffix: null, duration: null };
  try {
    const song = await fetchNavidromeSong(navidrome, navidId, {
      timeoutMs: DURATION_TIMEOUT_MS,
    });
    return { suffix: song?.suffix ?? null, duration: song?.duration ?? null };
  } catch {
    return { suffix: null, duration: null };
  }
}

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
      .select("navid_id, suffix, duration")
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

    const row = navidRow as {
      navid_id: string;
      suffix: string | null;
      duration: number | null;
    };
    const navidSongId = row.navid_id;

    // 格式决定发原文件还是转码；时长给进度条用（opus 流没有 Content-Length，
    // 浏览器读不出 audio.duration），也用来算链接的过期时间。
    // 两项都由同步写进 navid_song，缺了才现场取
    const { suffix, duration } =
      row.suffix != null && row.duration != null
        ? row
        : await fetchMediaLive(navidSongId);
    const mode: StreamMode = streamModeFor(suffix);

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
