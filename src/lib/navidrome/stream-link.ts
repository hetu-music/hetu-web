/**
 * 播放链接签名。浏览器拿到的是中继机上的签名路径，不含任何 Navidrome 凭证：
 *
 *   https://<中继>/stream/<navid_id>?u=<用户ID>&e=<过期时间戳>&s=<签名>&t=<起播秒数>
 *   https://<中继>/file/<navid_id>?u=<用户ID>&e=<过期时间戳>&s=<签名>
 *
 * /stream/ 实时转成 opus；/file/ 直接发原文件，只给浏览器能直接播的有损格式，
 * 免得有损再转一遍有损。原文件带长度、支持分段请求，浏览器能原生跳转，所以不带 t。
 *
 * 中继机的 nginx 用 secure_link 校验签名与过期时间，再补上服务账号、固定格式与码率，
 * 转给本机的 Navidrome（nginx 配置不在仓库里，/stream/ 与 /file/ 各一个 location）。
 * 签名覆盖整个路径（含 /stream/ 或 /file/）、用户与过期时间，不含域名：
 * 同一条链接换中继域名也能验，但不能把一首无损的转码链接改成原文件链接。
 * t 不参与签名：改它只能换起播位置，拿不到别的东西。
 */
import crypto from "crypto";

export type StreamLinkConfig = {
  /** 中继的对外地址，如 https://pre.hetu-music.com */
  baseUrl: string;
  /** 与 nginx secure_link_md5 里的密钥一致 */
  secret: string;
};

/** 读取 STREAM_BASE_URL / STREAM_LINK_SECRET，缺任一项时返回 null */
export function streamLinkConfigFromEnv(
  env: Record<string, string | undefined> = process.env,
): StreamLinkConfig | null {
  const { STREAM_BASE_URL, STREAM_LINK_SECRET } = env;
  if (!STREAM_BASE_URL || !STREAM_LINK_SECRET) return null;
  return {
    baseUrl: STREAM_BASE_URL.replace(/\/$/, ""),
    secret: STREAM_LINK_SECRET,
  };
}

/** 过期时间在音频剩余时长之外再留的余量：暂停一阵再继续，浏览器可能要重连 */
const EXPIRY_MARGIN_S = 3600;
/** 不知道时长时，按这么长的音频算 */
const UNKNOWN_DURATION_S = 3600;

/**
 * 直接发原文件的格式。只收所有浏览器都能播、又一定是有损的格式；
 * m4a 可能是无损的 ALAC，ogg 在旧版 iOS 上播不了，都继续转码
 */
const ORIGINAL_SUFFIXES = new Set(["mp3"]);

export type StreamMode = "transcode" | "original";

/** 按文件扩展名决定；不知道格式时一律转码，转码对任何源都能播 */
export function streamModeFor(suffix: string | null | undefined): StreamMode {
  return suffix && ORIGINAL_SUFFIXES.has(suffix.toLowerCase())
    ? "original"
    : "transcode";
}

/** Navidrome 的曲目 ID 只有字母数字，其余字符一律拒绝，免得拼进路径出问题 */
const NAVID_ID_PATTERN = /^[A-Za-z0-9_-]+$/;

/**
 * 与 nginx 的 `secure_link_md5 "$secure_link_expires$uri$arg_u <secret>"` 对应：
 * md5 的二进制结果转 base64url，去掉末尾的 =
 */
export function signStreamPath(
  path: string,
  userId: string,
  expires: number,
  secret: string,
): string {
  return crypto
    .createHash("md5")
    .update(`${expires}${path}${userId} ${secret}`, "utf8")
    .digest("base64url");
}

export function buildStreamUrl(
  config: StreamLinkConfig,
  {
    navidId,
    userId,
    duration,
    mode = "transcode",
    timeOffset = 0,
    now = Date.now(),
  }: {
    navidId: string;
    userId: string;
    /** 整首时长（秒），未知时为 null */
    duration: number | null;
    mode?: StreamMode;
    /** 只对转码有效；原文件由浏览器自己跳转 */
    timeOffset?: number;
    now?: number;
  },
): string {
  if (!NAVID_ID_PATTERN.test(navidId)) {
    throw new Error(`invalid navid id: ${navidId}`);
  }
  const offset = mode === "transcode" ? Math.max(0, Math.floor(timeOffset)) : 0;
  const remaining =
    duration != null && duration > 0
      ? Math.max(0, duration - offset)
      : UNKNOWN_DURATION_S;
  const expires =
    Math.floor(now / 1000) + Math.ceil(remaining) + EXPIRY_MARGIN_S;

  const path = `/${mode === "original" ? "file" : "stream"}/${navidId}`;
  const query = new URLSearchParams({
    u: userId,
    e: String(expires),
    s: signStreamPath(path, userId, expires, config.secret),
  });
  if (offset > 0) query.set("t", String(offset));
  return `${config.baseUrl}${path}?${query}`;
}
