import "server-only";

import { cache } from "react";
import { getServiceClient, TABLES } from "@/lib/db/supabase-server";
import {
  buildPlaces,
  type PlaceRow,
  type PlaceSong,
  type SongPlaceRow,
} from "@/lib/places/build";
import type { Place } from "@/lib/places/types";
import { toTraditional } from "@/lib/utils/utils-convert";
import { buildFolio } from "@/lib/utils/utils-folio";

/**
 * 河图志的地点列表（docs/PLACES.md）：地点、线上版本的对应，以及这些歌的歌词。
 * 词句不另存，按引文在线上歌词里定位，与详情页切出的句子一致。
 *
 * 页面 ISR 6 小时；发布歌曲时 refreshSongs 连带失效 /places。
 * cache()：同一次渲染里页面信息（generateMetadata）与页面各要一次，只查一次。
 */
export const getPlaces = cache(async (locale: string): Promise<Place[]> => {
  const db = getServiceClient();
  if (!db) return [];

  const [placesRes, rowsRes] = await Promise.all([
    db.from(TABLES.PLACES).select("id, name, full_name, region").order("id"),
    db
      .from(TABLES.PUBLISHED_SONG_PLACES)
      .select(
        "song_id, place_id, relation, anchor_index, anchor_time, anchor_quote, note",
      )
      .order("id"),
  ]);
  if (placesRes.error) throw placesRes.error;
  if (rowsRes.error) throw rowsRes.error;
  const rows = rowsRes.data as SongPlaceRow[];

  const songIds = [...new Set(rows.map((r) => r.song_id))];
  const songs = new Map<number, PlaceSong>();
  if (songIds.length > 0) {
    const { data, error } = await db
      .from(TABLES.PUBLISHED_SONGS)
      .select("id, title, lyrics, lyrics_start")
      .in("id", songIds);
    if (error) throw error;
    for (const s of data as {
      id: number;
      title: string;
      lyrics: string | null;
      lyrics_start: string | null;
    }[]) {
      songs.set(s.id, {
        title: s.title,
        lines: buildFolio(s.lyrics, {
          title: s.title,
          lyricsStart: s.lyrics_start,
        }).lines,
      });
    }
  }

  const tr =
    locale === "zh-TW"
      ? (s: string) => toTraditional(s) ?? s
      : (s: string) => s;
  return buildPlaces(placesRes.data as PlaceRow[], rows, songs, tr);
});
