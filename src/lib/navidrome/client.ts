/**
 * 用于同步的 Navidrome（Subsonic API）只读客户端。
 * 不依赖 Next 运行时，scripts/ 下的命令行脚本和 API 路由共用。
 */
import crypto from "crypto";
import type { NavSong } from "./sync";

export type NavidromeConfig = {
  url: string;
  user: string;
  password: string;
};

const PAGE_SIZE = 500;
const TIMEOUT_MS = 30_000;
/** Subsonic 错误码：请求的资源不存在 */
const ERROR_NOT_FOUND = 70;

export class NavidromeError extends Error {
  constructor(
    message: string,
    readonly code?: number,
  ) {
    super(message);
    this.name = "NavidromeError";
  }
}

/** 读取曲库所用账号，来自 NAVIDROME_URL / NAVIDROME_USER / NAVIDROME_PASSWORD */
export function navidromeConfigFromEnv(
  env: Record<string, string | undefined> = process.env,
): NavidromeConfig | null {
  const { NAVIDROME_URL, NAVIDROME_USER, NAVIDROME_PASSWORD } = env;
  if (!NAVIDROME_URL || !NAVIDROME_USER || !NAVIDROME_PASSWORD) return null;
  return {
    url: NAVIDROME_URL.replace(/\/$/, ""),
    user: NAVIDROME_USER,
    password: NAVIDROME_PASSWORD,
  };
}

type RawSong = {
  id: string;
  title: string;
  album?: string;
  discNumber?: number;
  track?: number;
  duration?: number;
  path?: string;
  suffix?: string;
};

/** 只保留同步、管理页面和播放用得到的字段 */
function toNavSong(raw: RawSong): NavSong {
  return {
    id: raw.id,
    title: raw.title,
    album: raw.album,
    discNumber: raw.discNumber,
    track: raw.track,
    duration: raw.duration,
    path: raw.path,
    suffix: raw.suffix,
  };
}

async function call<T>(
  config: NavidromeConfig,
  endpoint: string,
  params: Record<string, string>,
  timeoutMs = TIMEOUT_MS,
): Promise<T> {
  const salt = crypto.randomBytes(8).toString("hex");
  const query = new URLSearchParams({
    u: config.user,
    t: crypto
      .createHash("md5")
      .update(config.password + salt)
      .digest("hex"),
    s: salt,
    v: "1.16.1",
    c: "hetu-web-sync",
    f: "json",
    ...params,
  });
  const res = await fetch(`${config.url}/rest/${endpoint}?${query}`, {
    signal: AbortSignal.timeout(timeoutMs),
    cache: "no-store",
  });
  if (!res.ok)
    throw new NavidromeError(`Navidrome 请求失败：HTTP ${res.status}`);
  const body = (await res.json())["subsonic-response"];
  if (body?.status !== "ok") {
    throw new NavidromeError(
      `Navidrome 返回错误：${body?.error?.message ?? "未知错误"}`,
      body?.error?.code,
    );
  }
  return body as T;
}

/** 拉取全部曲目。Navidrome 对空查询返回全部曲目 */
export async function fetchNavidromeLibrary(
  config: NavidromeConfig,
): Promise<NavSong[]> {
  const songs: NavSong[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const body = await call<{ searchResult3?: { song?: RawSong[] } }>(
      config,
      "search3",
      {
        query: "",
        artistCount: "0",
        albumCount: "0",
        songCount: String(PAGE_SIZE),
        songOffset: String(offset),
      },
    );
    const page = body.searchResult3?.song ?? [];
    songs.push(...page.map(toNavSong));
    if (page.length < PAGE_SIZE) return songs;
  }
}

/**
 * 查询单个曲目，不存在时返回 null。
 * 播放前取时长时传一个短的 timeoutMs，别让起播等上 30 秒
 */
export async function fetchNavidromeSong(
  config: NavidromeConfig,
  id: string,
  { timeoutMs }: { timeoutMs?: number } = {},
): Promise<NavSong | null> {
  try {
    const body = await call<{ song?: RawSong }>(
      config,
      "getSong",
      { id },
      timeoutMs,
    );
    return body.song ? toNavSong(body.song) : null;
  } catch (error) {
    if (error instanceof NavidromeError && error.code === ERROR_NOT_FOUND) {
      return null;
    }
    throw error;
  }
}
