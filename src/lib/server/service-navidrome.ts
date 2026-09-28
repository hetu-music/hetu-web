import "server-only";

import { revalidatePath, revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { locales } from "@/i18n/config";
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
import { QUIZ_POOL_TAG } from "@/lib/quiz/pool";
import {
  purgeCloudflareCache,
  purgeEdgeOneCache,
  serverErrorResponse,
} from "@/lib/server/server-utils";

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

/** Cloudflare 单次按 URL 清缓存的上限 */
const CDN_PURGE_BATCH = 30;

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

/**
 * has_audio 只影响曲库列表、歌曲详情和寻曲测验的播放按钮；
 * navid_id 本身在播放时实时查询，替换映射不需要刷新缓存。
 */
async function revalidateAudioPages(songIds: number[]) {
  if (songIds.length === 0) return;

  const nextPaths: string[] = [];
  for (const locale of locales) {
    nextPaths.push(`/${locale}`, `/${locale}/quiz`);
    for (const id of songIds) nextPaths.push(`/${locale}/song/${id}`);
  }
  for (const path of nextPaths) revalidatePath(path);
  revalidateTag(QUIZ_POOL_TAG, { expire: 0 });

  // CDN 还缓存着无前缀的旧 URL（301 响应），一并清掉
  const cdnPaths = [...nextPaths, "/", ...songIds.map((id) => `/song/${id}`)];
  const batches: string[][] = [];
  for (let i = 0; i < cdnPaths.length; i += CDN_PURGE_BATCH) {
    batches.push(cdnPaths.slice(i, i + CDN_PURGE_BATCH));
  }
  await Promise.all(
    batches.flatMap((batch) => [
      purgeCloudflareCache(batch),
      purgeEdgeOneCache(batch),
    ]),
  );
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

/** 服务端重新计算同步计划并执行，不信任客户端预览时的计划 */
export async function runAudioSync(): Promise<ApplyResult> {
  const { supabase, config } = requireDeps();
  const [library, { songs, mappings }] = await Promise.all([
    loadLibrary(config),
    loadSyncState(supabase),
  ]);
  const result = await applySyncPlan(
    supabase,
    planSync(songs, library, mappings),
  );
  await revalidateAudioPages(result.hasAudioChanged);
  return result;
}

/** 手动关联或解除关联（navidId 为 null）单首歌曲 */
export async function updateAudioMapping(
  songId: number,
  navidId: string | null,
): Promise<{ nav: NavSong | null }> {
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

  await setSongMapping(supabase, songId, navidId);
  if (Boolean(song.has_audio) !== (navidId !== null)) {
    await revalidateAudioPages([songId]);
  }
  return { nav };
}
