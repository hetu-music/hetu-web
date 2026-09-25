import type {
  AutoCompleteResponse,
  SearchResponse,
  SearchResultItem,
} from "@/lib/api/api-auto-complete";
import { fetchWithTimeout } from "@/lib/utils/utils-common";
import { type MusicProvider, parseLyricMetadata } from "./types";

// ============================================
// 常量定义
// ============================================

const KUGOU_API_BASE = "http://kgmapi:3000";
// kgmapi 自己还要回源到酷狗，留出比纯内网调用更宽的余量
const KUGOU_TIMEOUT_MS = 8000;

// ============================================
// 内部辅助函数
// ============================================

/**
 * 获取酷狗歌词
 * 1. 先通过 hash 搜索歌词，获取 id 和 accesskey
 * 2. 再通过 id 和 accesskey 获取解码后的歌词
 */
async function fetchLyrics(hash: string): Promise<string | null> {
  try {
    // 第一步：搜索歌词获取 candidates
    const searchRes = await fetchWithTimeout(
      `${KUGOU_API_BASE}/search/lyric?hash=${hash}`,
      {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      },
      KUGOU_TIMEOUT_MS,
    );

    if (!searchRes.ok) return null;

    const searchData = await searchRes.json();

    // 获取第一个歌词候选
    const candidates = searchData.candidates;
    if (!candidates || !Array.isArray(candidates) || candidates.length === 0) {
      return null;
    }

    const { id, accesskey } = candidates[0];
    if (!id || !accesskey) return null;

    // 第二步：获取解码后的歌词
    const lyricRes = await fetchWithTimeout(
      `${KUGOU_API_BASE}/lyric?id=${id}&accesskey=${accesskey}&decode=true&fmt=lrc`,
      {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      },
      KUGOU_TIMEOUT_MS,
    );

    if (!lyricRes.ok) return null;

    const lyricData = await lyricRes.json();
    return lyricData.decodeContent || null;
  } catch {
    return null;
  }
}

// ============================================
// 酷狗音乐提供者
// ============================================

export const kugouProvider: MusicProvider = {
  name: "kugou",

  async searchSongs(
    keywords: string,
    limit: number = 10,
  ): Promise<SearchResponse> {
    const params = new URLSearchParams({
      keywords,
      pagesize: limit.toString(),
    });

    const res = await fetchWithTimeout(
      `${KUGOU_API_BASE}/search?${params}`,
      {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      },
      KUGOU_TIMEOUT_MS,
    );

    if (!res.ok) throw new Error(`酷狗 API 搜索失败: ${res.status}`);

    const data = await res.json();

    // 酷狗 API 返回结构：{ data: { lists: [...], total: number } }
    if (!data.data?.lists || !Array.isArray(data.data.lists)) {
      return { type: "search", results: [], hasMore: false, total: 0 };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const results: SearchResultItem[] = data.data.lists.map((song: any) => {
      // 处理歌手数组：song.Singers 是 [{name: "xxx", id: xxx}, ...] 格式
      const singers: Array<{ name: string; id: number }> = song.Singers || [];
      const artistNames = singers.map((s) => s.name);
      const firstArtist = artistNames.length > 0 ? artistNames[0] : null;

      return {
        id: song.FileHash, // 酷狗使用 FileHash 作为 ID
        name: song.OriSongName || song.FileName?.split(" - ").pop() || "",
        album: song.AlbumName || null,
        albumartist: firstArtist,
        artists: artistNames,
        duration: song.Duration || null, // 酷狗返回秒
        publishTime: song.PublishDate || null, // 酷狗返回日期字符串如 "2026-01-16"
      };
    });

    return {
      type: "search",
      results,
      hasMore: results.length < (data.data.total || 0),
      total: data.data.total || results.length,
    };
  },

  async getSongDetail(
    id: number | string,
    duration: number | null,
    publishTime: number | string | null,
    album: string | null,
    albumartist: string | null,
  ): Promise<AutoCompleteResponse> {
    // 获取歌词（id 就是 FileHash）
    const rawLyrics = await fetchLyrics(id.toString());

    // 解析歌词元数据
    const lyricData = rawLyrics ? parseLyricMetadata(rawLyrics) : null;

    return {
      album,
      length: duration, // 酷狗已经是秒，无需转换
      date: typeof publishTime === "string" ? publishTime : null,
      lyrics: lyricData?.lyric || null,
      lyricist: lyricData?.lyricist || null,
      composer: lyricData?.composer || null,
      arranger: lyricData?.arranger || null,
      albumartist: albumartist ? [albumartist] : null,
      genre: null,
      type: null,
      comment: null,
      // kglink: 格式待确定
    };
  },
};
