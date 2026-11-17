import type { FolioLine } from "@/lib/utils/utils-folio";
import { resolveSlot } from "@/lib/utils/utils-comments";
import type { Place, PlaceEntry, PlaceRelation } from "@/lib/places/types";

export interface PlaceRow {
  id: number;
  name: string;
  full_name: string | null;
  region: string;
}

export interface SongPlaceRow {
  song_id: number;
  place_id: number;
  relation: PlaceRelation;
  anchor_index: number | null;
  anchor_time: number | string | null;
  anchor_quote: string | null;
  note: string | null;
}

export interface PlaceSong {
  title: string;
  /** 详情页正文切出的句子（buildFolio），引句按它定位 */
  lines: FolioLine[];
}

/**
 * 把地点、线上版本的对应和歌词拼成页面用的地点列表。
 *
 * 引句与校记、评论同一套定位：先按引文找，同样的句子出现几次时取离原行号（或时间）最近的；
 * 找不到（改词后对不上）就不显示这一句，这首歌仍列在地点下。
 * 没有任何线上歌曲对应的地点不列。tr 用来把文字转成页面的语言，定位在转换之前做。
 */
export function buildPlaces(
  places: PlaceRow[],
  rows: SongPlaceRow[],
  songs: Map<number, PlaceSong>,
  tr: (s: string) => string = (s) => s,
): Place[] {
  const entriesByPlace = new Map<number, PlaceEntry[]>();
  const entryByKey = new Map<string, PlaceEntry>();

  for (const row of rows) {
    const song = songs.get(row.song_id);
    if (!song) continue;
    const key = `${row.place_id}:${row.song_id}:${row.relation}`;
    let entry = entryByKey.get(key);
    if (!entry) {
      entry = {
        songId: row.song_id,
        title: tr(song.title),
        relation: row.relation,
        verses: [],
        note: null,
      };
      entryByKey.set(key, entry);
      const list = entriesByPlace.get(row.place_id) ?? [];
      list.push(entry);
      entriesByPlace.set(row.place_id, list);
    }
    if (row.note && !entry.note) entry.note = tr(row.note);
    if (row.anchor_quote === null) continue;

    const { slot, orphan } = resolveSlot(
      {
        anchor: "lyrics",
        anchorIndex: row.anchor_index,
        anchorTime: row.anchor_time === null ? null : Number(row.anchor_time),
        anchorQuote: row.anchor_quote,
      },
      { lines: song.lines, paragraphs: [] },
    );
    if (orphan || slot.section !== "lyrics") continue;
    if (entry.verses.some((v) => v.index === slot.line)) continue;
    entry.verses.push({
      index: slot.line,
      text: tr(song.lines[slot.line].text),
    });
  }

  for (const entry of entryByKey.values()) {
    entry.verses.sort((a, b) => a.index - b.index);
  }

  return places.flatMap((p) => {
    const entries = entriesByPlace.get(p.id);
    if (!entries) return [];
    return [
      {
        id: p.id,
        name: tr(p.name),
        fullName: p.full_name === null ? null : tr(p.full_name),
        region: tr(p.region),
        entries,
      },
    ];
  });
}
