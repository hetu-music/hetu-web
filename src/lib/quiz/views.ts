import type { Song } from "@/lib/types";
import type { DimensionKey } from "./types";

/**
 * 服务端传给客户端组件的视图数据，均为可序列化的纯数据，文本已按 locale 转换。
 */

export type QuizQuestionView = {
  title: string;
  stem: string;
  options: string[];
};

/** 结果页上固定几套里的字，按所用字体分好，供答题页预载字体分片 */
export type QuizResultGlyphs = {
  calligraphy: string;
  serif: string;
  kaiti: string;
};

export type QuizMatchView = {
  song: Song;
  percent: number;
  /** 共同偏好，如「天象」「「月」」 */
  reasons: string[];
  /** 印证理由的歌词 */
  lines: string[];
};

export type QuizResultView = {
  /** 结果页链接里的乱码：7 位是作答编码，10 位是保存的记录 */
  slug: string;
  /** 保存时间（ISO）；未保存的结果为 null */
  savedAt: string | null;
  persona: { motto: string; label: string; description: string };
  secondary: { motto: string; label: string } | null;
  profile: Array<{ key: DimensionKey; label: string; z: number }>;
  imagery: string[];
  matches: QuizMatchView[];
};

/** 保存的记录的摘要：结果页的保存按钮、个人主页的「往次」用 */
export type QuizRecordSummary = {
  /** 链接里的 10 位乱码 */
  id: string;
  /** 保存时间（ISO） */
  savedAt: string;
  persona: { motto: string; label: string };
  secondary: { motto: string; label: string } | null;
};
