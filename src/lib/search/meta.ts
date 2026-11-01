/**
 * 题名、人名、专辑的归一化数据（见 docs/LIBRARY.md 阶段 2「6. 内存结构」）。
 *
 * 按歌曲对象缓存：同一个 Song 对象只归一化一次。曲库页先筛选再搜索，
 * 每次筛选得到的是新数组、但里面还是原来那些 Song 对象，所以不会重建。
 */
import type { Song } from "@/lib/types";
import { normalize } from "./normalize";

export interface SongMeta {
  id: number;
  /** 以下都已归一化 */
  title: string;
  album: string;
  /** 人名按角色分开存，阶段 3 按角色筛选时直接复用 */
  artist: string[];
  lyricist: string[];
  composer: string[];
  arranger: string[];
  /** 别署 creditAliases：已归并到主名的原署名，只供搜索 */
  aliases: string[];
  /** 只供筛选，不参与搜索 */
  genre: string[];
}

const cache = new WeakMap<Song, SongMeta>();

function normalizeAll(values: readonly string[] | null | undefined): string[] {
  if (!values) return [];
  const out: string[] = [];
  for (const v of values) {
    const n = normalize(v);
    if (n && !out.includes(n)) out.push(n);
  }
  return out;
}

export function getSongMeta(song: Song): SongMeta {
  const hit = cache.get(song);
  if (hit) return hit;
  const meta: SongMeta = {
    id: song.id,
    title: normalize(song.title),
    album: song.album ? normalize(song.album) : "",
    artist: normalizeAll(song.artist),
    lyricist: normalizeAll(song.lyricist),
    composer: normalizeAll(song.composer),
    arranger: normalizeAll(song.arranger),
    aliases: normalizeAll(song.creditAliases),
    genre: normalizeAll(song.genre),
  };
  cache.set(song, meta);
  return meta;
}

export function buildSongMeta(songs: readonly Song[]): SongMeta[] {
  return songs.map(getSongMeta);
}

/** 搜索时各角色一起查：演唱、作词、作曲、编曲和别署 */
export function namesOf(meta: SongMeta): string[] {
  return [
    ...meta.artist,
    ...meta.lyricist,
    ...meta.composer,
    ...meta.arranger,
    ...meta.aliases,
  ];
}
