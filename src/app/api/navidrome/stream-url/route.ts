import { NextRequest, NextResponse } from "next/server";
import { withAuth, type AuthenticatedUser } from "@/lib/server/server-auth";
import { createSupabaseServerClient } from "@/lib/db/supabase-auth";
import { getServiceClient, TABLES } from "@/lib/db/supabase-server";
import nodeCrypto from "crypto";
import { fetchWithTimeout } from "@/lib/utils/utils-common";

function md5(input: string): string {
  return nodeCrypto.createHash("md5").update(input, "utf8").digest("hex");
}

export const GET = withAuth(
  async (request: NextRequest, user: AuthenticatedUser) => {
    const { searchParams } = new URL(request.url);
    const songIdStr = searchParams.get("songId")?.trim();
    const timeOffsetStr = searchParams.get("timeOffset");

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

    const supabase = await createSupabaseServerClient();
    const { data: userData, error: userErr } = await supabase
      .from(TABLES.USERS)
      .select("navid_id, navid_pw, endpoint")
      .eq("id", user.id)
      .maybeSingle();

    if (userErr || !userData) {
      return NextResponse.json(
        { error: "Failed to fetch user credentials" },
        { status: 500 },
      );
    }

    const { navid_id, navid_pw, endpoint } = userData as {
      navid_id: string | null;
      navid_pw: string | null;
      endpoint: string | null;
    };

    if (!navid_id || !navid_pw || !endpoint) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const serviceClient = getServiceClient();
    if (!serviceClient) {
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

    const navidSongId = navidRow.navid_id as string;

    const salt = nodeCrypto.randomBytes(8).toString("hex");
    const token = md5(navid_pw + salt);
    const base = endpoint.replace(/\/$/, "");

    // 从 Navidrome getSong 获取准确的 duration（opus 流没有 Content-Length，
    // 浏览器无法从 audio.duration 读取，必须从元数据获取）
    let duration: number | null = null;
    try {
      const songInfoParams = new URLSearchParams({
        u: navid_id,
        t: token,
        s: salt,
        v: "1.16.1",
        c: "hetu-web",
        id: navidSongId,
        f: "json",
      });
      const songInfoRes = await fetchWithTimeout(
        `${base}/rest/getSong?${songInfoParams}`,
        {},
        5000,
      );
      if (songInfoRes.ok) {
        const songInfo = (await songInfoRes.json()) as {
          "subsonic-response"?: { song?: { duration?: number } };
        };
        duration = songInfo?.["subsonic-response"]?.song?.duration ?? null;
      }
    } catch {
      // duration 获取失败不影响播放，降级为 null
    }

    // 构造 stream URL，seek 时带 timeOffset 让 Navidrome 从指定秒数开始返回流
    const streamParams = new URLSearchParams({
      u: navid_id,
      t: token,
      s: salt,
      v: "1.16.1",
      c: "hetu-web",
      id: navidSongId,
      format: "opus",
      maxBitRate: "192",
    });

    if (timeOffsetStr) {
      const timeOffset = parseFloat(timeOffsetStr);
      if (!isNaN(timeOffset) && timeOffset > 0) {
        streamParams.set("timeOffset", String(Math.floor(timeOffset)));
      }
    }

    return NextResponse.json({
      url: `${base}/rest/stream?${streamParams}`,
      duration,
    });
  },
);
