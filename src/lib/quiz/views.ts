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

export type QuizMatchView = {
  song: Song;
  percent: number;
  /** 共同偏好，如「天象」「「月」」 */
  reasons: string[];
  /** 印证理由的歌词 */
  lines: string[];
};

export type QuizResultView = {
  code: string;
  persona: { motto: string; label: string; description: string };
  secondary: { motto: string; label: string } | null;
  profile: Array<{ key: DimensionKey; label: string; z: number }>;
  imagery: string[];
  matches: QuizMatchView[];
};
