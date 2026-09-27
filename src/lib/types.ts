// 基础歌曲类型
export type Song = {
  id: number;
  title: string;
  album: string | null;
  year: number | null;
  genre: string[] | null;
  lyricist: string[] | null;
  composer: string[] | null;
  arranger?: string[] | null;
  artist: string[] | null;
  length: number | null;
  hascover?: boolean | null;
  date?: string | null;
  type?: string[] | null;
  updated_at: string;
  has_audio?: boolean;
  collectionInfo?: {
    created_at: string;
    review: string | null;
    snippet: string | null;
  };
};

// Song 类型的数据库字段列表（用于 Supabase 查询）
// 注意：year 不是数据库字段，而是从 date 计算得出的，所以不包含在内
export const SONG_LIST_VIEW_FIELDS = [
  "id,title,album,genre,lyricist,composer,arranger,artist,length,hascover,date,type,has_audio",
] as const;

// 详细歌曲类型（包含更多字段）
export type SongDetail = Song & {
  albumartist?: string[] | null;
  arranger?: string[] | null;
  comment?: string | null;
  discnumber?: number | null;
  disctotal?: number | null;
  lyrics?: string | null;
  normalLyrics?: string | null;
  track?: number | null;
  tracktotal?: number | null;
  kugolink?: string | null;
  qmlink?: string | null;
  nelink?: string | null;
  nmn_status?: boolean | null;
};

// 音乐库客户端组件属性
export interface MusicLibraryClientProps {
  initialSongsData: Song[];
}

// 歌曲详情客户端组件属性
export interface SongDetailClientProps {
  song: SongDetail;
  imagery: SongImageryView;
}

// 歌曲详情页的意象视图
export interface SongImageryMark {
  id: number;
  name: string;
  /** 一级 → 末级分类名 */
  path: string[];
  /** 一级分类配色 */
  accent: string;
  timetags: string[];
  /** 全库写到该意象的作品数（含本曲） */
  songCount: number;
}

export interface RelatedSong {
  id: number;
  title: string;
  artist: string[] | null;
  hascover: boolean | null;
  /** 共享的意象，越少见越靠前 */
  shared: string[];
}

export interface SongImageryView {
  marks: SongImageryMark[];
  related: RelatedSong[];
}

// 筛选选项类型
export interface FilterOptions {
  allTypes: string[];
  allGenres: string[];
  allYears: (string | number)[];
  allLyricists: string[];
  allComposers: string[];
  allArrangers: string[];
  allArtists: string[];
}

// 歌曲信息类型
export interface SongInfo {
  creativeInfo: Array<{ label: string; value: string }>;
  basicInfo: Array<{ label: string; value: string }>;
}

// 意象相关类型
export type ImageryCategory = {
  id: number;
  name: string;
  parent_id: number | null;
  level: number | null;
  description: string | null;
};

export type ImageryMeaning = {
  id: number;
  label: string;
  description: string | null;
};

export type ImageryItem = {
  id: number;
  name: string;
  count: number;
  categoryIds: number[];
  meaningCount: number;
};

export type ImageryOccurrence = {
  id: number;
  song_id: number;
  imagery_id: number;
  category_id: number;
  meaning_id: number | null;
  lyric_timetag: string[];
};

export type SongRef = {
  id: number;
  title: string;
  lyricist: string[] | null;
};

// 歌曲字段配置类型（用于管理页面表单渲染和校验）
export type SongFormFieldKey =
  | "title"
  | "album"
  | "lyricist"
  | "composer"
  | "arranger"
  | "artist"
  | "type"
  | "genre"
  | "length"
  | "hascover"
  | "date"
  | "albumartist"
  | "comment"
  | "lyrics"
  | "nmn_status"
  | "track"
  | "tracktotal"
  | "discnumber"
  | "disctotal"
  | "kugolink"
  | "nelink"
  | "qmlink";

export type SongFieldConfig = {
  key: SongFormFieldKey;
  label: string;
  type: "text" | "number" | "array" | "boolean" | "date" | "textarea";
  required?: boolean;
  maxLength?: number;
  minLength?: number;
  min?: number;
  isUrl?: boolean;
  arrayMaxLength?: number;
};

// 用户记录类型（管理员用户管理面板）
// navid_pw 为只写字段，不在读取结果中返回
export type UserRecord = {
  id: string;
  name: string;
  display: boolean;
  intro: string | null;
  is_admin: boolean;
  is_super: boolean;
  navid_id: string | null;
  endpoint: string | null;
};

// ─── 用户请求/反馈相关类型 ────────────────────────────────────────────────────

export type RequestType = "song_feedback" | "benefit_apply" | "admin_apply";
export type RequestStatus = "pending" | "replied" | "approved" | "rejected";

export type UserRequest = {
  id: string;
  user_id: string;
  type: RequestType;
  song_id: number | null;
  category: string | null;
  content: string;
  status: RequestStatus;
  reply: string | null;
  replied_by: string | null;
  replied_at: string | null;
  created_at: string;
  updated_at: string;
  // 关联数据（管理员视图）
  user_name?: string | null;
  song_title?: string | null;
};

export type CreateRequestPayload = {
  type: RequestType;
  song_id?: number | null;
  category?: string | null;
  content: string;
};

export type ReplyRequestPayload = {
  id: string;
  reply: string;
  status: RequestStatus;
};

// 用户更新字段类型（超级管理员可编辑的字段）
export type UserUpdatePayload = {
  id: string;
  name?: string;
  display?: boolean;
  intro?: string | null;
  is_admin?: boolean;
  is_super?: boolean;
  navid_id?: string | null;
  navid_pw?: string | null;
  endpoint?: string | null;
};
