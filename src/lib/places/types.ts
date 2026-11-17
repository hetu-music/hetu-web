/** 河图志的公开数据（见 docs/PLACES.md）。服务端拼好，页面直接用 */

export type PlaceRelation = "setting" | "venue";

/** 挂在一句歌词上的词句；index 是详情页正文的第几句 */
export interface PlaceVerse {
  index: number;
  text: string;
}

/** 一处地点下的一首歌 */
export interface PlaceEntry {
  songId: number;
  title: string;
  /** setting：歌里的地方；venue：演出场馆，不引歌词 */
  relation: PlaceRelation;
  /** 按正文次序；挂在整首歌上、或引句在歌词里找不到时为空 */
  verses: PlaceVerse[];
  note: string | null;
}

export interface Place {
  id: number;
  /** 图上的短名 */
  name: string;
  /** 全称，与短名相同时为空 */
  fullName: string | null;
  /** 「湖南 · 长沙 · 岳麓」 */
  region: string;
  entries: PlaceEntry[];
}
