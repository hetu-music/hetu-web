export type SongOption = {
  id: number;
  title: string;
  album?: string | null;
  /** 暂存表中的 LRC 歌词，对照编辑时展示 */
  lyrics?: string | null;
};
