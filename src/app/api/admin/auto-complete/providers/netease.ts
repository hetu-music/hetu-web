import type {
  AutoCompleteResponse,
  SearchResponse,
  SearchResultItem,
} from "@/lib/api/api-auto-complete";
import { fetchWithTimeout } from "@/lib/utils/utils-common";
import {
  type MusicProvider,
  msToSeconds,
  parseLyricMetadata,
  timestampToDateString,
} from "./types";

// ============================================
// 常量定义
// ============================================

const HETU_API_BASE = "http://ncmapi:3000";
// ncmapi 自己还要回源到网易云，留出比纯内网调用更宽的余量
const NETEASE_TIMEOUT_MS = 8000;

// ============================================
// 内部辅助函数
// ============================================

/**
 * 获取并解析歌词元数据
 */
async function fetchLyrics(id: number): Promise<{
  lyric: string | null;
  lyricist: string[] | null;
  composer: string[] | null;
  arranger: string[] | null;
}> {
  try {
    const res = await fetchWithTimeout(
      `${HETU_API_BASE}/lyric?id=${id}&randomCNIP=true`,
      {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      },
      NETEASE_TIMEOUT_MS,
    );

    if (!res.ok)
      return { lyric: null, lyricist: null, composer: null, arranger: null };

    const data = await res.json();
    if (data.code !== 200 || !data.lrc?.lyric) {
      return { lyric: null, lyricist: null, composer: null, arranger: null };
    }

    return parseLyricMetadata(data.lrc.lyric as string);
  } catch {
    return { lyric: null, lyricist: null, composer: null, arranger: null };
  }
}

// ============================================
// 网易云音乐提供者
// ============================================

export const neteaseProvider: MusicProvider = {
  name: "netease",

  async searchSongs(
    keywords: string,
    limit: number = 10,
  ): Promise<SearchResponse> {
    const params = new URLSearchParams({
      keywords,
      limit: limit.toString(),
      type: "1", // 单曲搜索
    });

    const res = await fetchWithTimeout(
      `${HETU_API_BASE}/cloudsearch?${params}&randomCNIP=true`,
      {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      },
      NETEASE_TIMEOUT_MS,
    );

    if (!res.ok) throw new Error(`Hetu API 搜索失败: ${res.status}`);

    const data = await res.json();

    if (data.code !== 200 || !data.result?.songs) {
      return { type: "search", results: [], hasMore: false, total: 0 };
    }

    // 映射结果
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const results: SearchResultItem[] = data.result.songs.map((song: any) => {
      // 适配网易云 API 的缩写字段 (ar, al, dt)
      const albumObj = song.album || song.al;
      const artistsArray = song.artists || song.ar || [];

      return {
        id: song.id,
        name: song.name,
        album: albumObj?.name || null,
        // 注意：API 返回的 al 对象中可能没有 artist 字段，这里尝试获取，如果没有则为 null
        albumartist: albumObj?.artist?.name || null,
        artists: artistsArray.map((a: { name: string }) => a.name) || [],
        duration: song.duration || song.dt || null,
        // publishTime 可能在根对象(song.publishTime) 或 专辑对象(song.album.publishTime)
        publishTime: song.publishTime || albumObj?.publishTime || null,
      };
    });

    return {
      type: "search",
      results,
      hasMore: data.result.hasMore || false,
      total: data.result.songCount || results.length,
    };
  },

  async getSongDetail(
    id: number,
    duration: number | null,
    publishTime: number | null,
    album: string | null,
    albumartist: string | null,
  ): Promise<AutoCompleteResponse> {
    // 并行获取补充信息（如果有更多 API 可在此扩展）
    const { lyric, lyricist, composer, arranger } = await fetchLyrics(id);

    return {
      album,
      length: msToSeconds(duration),
      date: timestampToDateString(publishTime),
      lyrics: lyric,
      lyricist,
      composer,
      arranger,
      albumartist: albumartist ? [albumartist] : null,
      genre: null, // 暂无数据源
      type: null, // 暂无数据源
      comment: null,
      nelink: `https://music.163.com/#/song?id=${id}`,
    };
  },
};
