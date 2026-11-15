export type SongOption = {
  id: number;
  title: string;
  album?: string | null;
  /** 工作版本（有草稿用草稿）的 LRC 歌词，对照编辑时展示 */
  lyrics?: string | null;
};
