import "server-only";

import { NextResponse } from "next/server";
import { getServiceClient, TABLES } from "@/lib/db/supabase-server";
import {
  fetchNavidromeLibrary,
  fetchNavidromeSong,
  navidromeConfigFromEnv,
  NavidromeError,
  type NavidromeConfig,
} from "@/lib/navidrome/client";
import {
  applySyncPlan,
  loadSyncState,
  MappingConflictError,
  setSongMapping,
  type ApplyResult,
} from "@/lib/navidrome/store";
import {
  planSync,
  type DbSong,
  type MappingRow,
  type NavSong,
  type SyncPlan,
} from "@/lib/navidrome/sync";
import {
  refreshAudio,
  type PurgeReport,
} from "@/lib/server/server-revalidate";
import { serverErrorResponse } from "@/lib/server/server-utils";

/** 缺少数据库或 Navidrome 配置，对应 503 */
export class AudioServiceUnavailableError extends Error {}
/** 请求的歌曲或曲目不存在，对应 404 */
export class AudioNotFoundError extends Error {}

/** 把音频服务的错误映射成 HTTP 响应；这些接口只对超级管理员开放，可以透出原因 */
export function audioErrorResponse(scope: string, error: unknown) {
  if (error instanceof AudioServiceUnavailableError) {
    return NextResponse.json({ error: error.message }, { status: 503 });
  }
  if (error instanceof AudioNotFoundError) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }
  if (error instanceof MappingConflictError) {
    return NextResponse.json({ error: error.message }, { status: 409 });
  }
  if (error instanceof NavidromeError) {
    return serverErrorResponse(scope, error, error.message, 502);
  }
  return serverErrorResponse(scope, error);
}

export type AudioOverview = {
  library: NavSong[];
  songs: DbSong[];
  mappings: MappingRow[];
  plan: SyncPlan;
};

function requireDeps() {
  const supabase = getServiceClient();
  if (!supabase) throw new AudioServiceUnavailableError("数据库服务暂不可用");
  const config = navidromeConfigFromEnv();
  if (!config) {
    throw new AudioServiceUnavailableError(
      "未配置 NAVIDROME_URL / NAVIDROME_USER / NAVIDROME_PASSWORD",
    );
  }
  return { supabase, config };
}

async function loadLibrary(config: NavidromeConfig): Promise<NavSong[]> {
  const library = await fetchNavidromeLibrary(config);
  // 曲库为空多半是账号或库配置有误；此时同步会把所有映射当作失效删掉
  if (library.length === 0) {
    throw new AudioServiceUnavailableError("Navidrome 返回的曲目为空");
  }
  return library;
}

export async function getAudioOverview(): Promise<AudioOverview> {
  const { supabase, config } = requireDeps();
  const [library, { songs, mappings }] = await Promise.all([
    loadLibrary(config),
    loadSyncState(supabase),
  ]);
  return {
    library,
    songs,
    mappings,
    plan: planSync(songs, library, mappings),
  };
}

/**
 * 服务端重新计算同步计划并执行，不信任客户端预览时的计划。
 * purge 是清 CDN 的结果，由路由写进响应头，不放进响应体。
 */
export async function runAudioSync(): Promise<
  ApplyResult & { purge: PurgeReport }
> {
  const { supabase, config } = requireDeps();
  const [library, { songs, mappings }] = await Promise.all([
    loadLibrary(config),
    loadSyncState(supabase),
  ]);
  const result = await applySyncPlan(
    supabase,
    planSync(songs, library, mappings),
  );
  const purge = await refreshAudio(result.hasAudioChanged);
  return { ...result, purge };
}

/** 手动关联或解除关联（navidId 为 null）单首歌曲 */
export async function updateAudioMapping(
  songId: number,
  navidId: string | null,
): Promise<{ nav: NavSong | null; purge: PurgeReport }> {
  const { supabase, config } = requireDeps();

  const { data: song, error } = await supabase
    .from(TABLES.MUSIC)
    .select("id,has_audio")
    .eq("id", songId)
    .maybeSingle();
  if (error) throw error;
  if (!song) throw new AudioNotFoundError("歌曲不存在");

  let nav: NavSong | null = null;
  if (navidId !== null) {
    nav = await fetchNavidromeSong(config, navidId);
    if (!nav) throw new AudioNotFoundError("Navidrome 中不存在该曲目");
  }

  await setSongMapping(supabase, songId, nav);
  const purge =
    Boolean(song.has_audio) !== (navidId !== null)
      ? await refreshAudio([songId])
      : { failed: [] };
  return { nav, purge };
}
