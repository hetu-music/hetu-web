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
  /** 资料争议说明；留空表示无争议。有争议的歌不计入曲库总数 */
  dispute_note?: string | null;
  collectionInfo?: {
    created_at: string;
  };
  /** 已归并到主名的原署名，只供搜索命中（见 utils-credits） */
  creditAliases?: string[];
};

/** 参与别名归并的署名字段 */
export const CREDIT_FIELDS = [
  "lyricist",
  "composer",
  "arranger",
  "artist",
  "albumartist",
] as const;
export type CreditField = (typeof CREDIT_FIELDS)[number];

// Song 类型的数据库字段列表（用于 Supabase 查询）
// 注意：year 不是数据库字段，而是从 date 计算得出的，所以不包含在内
export const SONG_LIST_VIEW_FIELDS = [
  "id,title,album,genre,lyricist,composer,arranger,artist,length,hascover,date,type,has_audio,dispute_note",
] as const;

// 详细歌曲类型（包含更多字段）
export type SongDetail = Song & {
  albumartist?: string[] | null;
  arranger?: string[] | null;
  comment?: string | null;
  discnumber?: number | null;
  disctotal?: number | null;
  lyrics?: string | null;
  /** 歌词从哪个时间标签开始；自动识别署名区出错时由后台指定 */
  lyrics_start?: string | null;
  normalLyrics?: string | null;
  track?: number | null;
  tracktotal?: number | null;
  kugolink?: string | null;
  qmlink?: string | null;
  nelink?: string | null;
  nmn_status?: boolean | null;
  /** 作品上的原署名，版记照录；只在有名字被归并到主名时才有 */
  credited?: Partial<Record<CreditField, string[] | null>>;
  /** 本曲用到的别名 → 主名，版记给原署加注 */
  aliasOf?: Record<string, string>;
};

// 音乐库客户端组件属性
export interface MusicLibraryClientProps {
  initialSongsData: Song[];
  /** 歌词版本号，搜歌词时拉的数据按它区分缓存地址（docs/LIBRARY.md 阶段 5「2.」） */
  lyricsVersion: string;
}

// 歌曲详情客户端组件属性
export interface SongDetailClientProps {
  song: SongDetail;
  imagery: SongImageryView;
  /** 卷首竖排摘句，按空格分列；在服务端挑好，见 pickExcerpt */
  excerpt: string | null;
  collations: SongCollation[];
}

// 歌曲详情页的意象视图
export interface SongImageryMark {
  id: number;
  name: string;
  /** 这个词在本曲所指的母题，意象词云里按它打开面板 */
  motifId: number;
  /** 一级 → 末级分类名 */
  path: string[];
  /** 一级分类配色 */
  accent: string;
  timetags: string[];
  /** 曲库里写到这个词的作品数（含本曲）；按词不按母题，与意象页一致 */
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

// 意象词云：以母题为单位（见 IMAGERY.md）。palette 是 PALETTE_FULL 的下标，-1 为灰
export interface CloudMotif {
  id: number;
  name: string;
  l1: number;
  l2: number;
  palette: number;
  songCount: number;
  /** 这个母题下有几种写法 */
  wordCount: number;
}

export interface CloudWord {
  id: number;
  name: string;
  /** 写到这个词的作品数，多义词各母题合计 */
  songCount: number;
  /** 作品最多的那个母题：点这个词时打开它的面板 */
  motif: number;
  l1: number;
  l2: number;
  palette: number;
}

export interface CloudMotifGroup {
  /** 二级分类 */
  id: number;
  name: string;
  l1: number;
  palette: number;
  motifs: CloudMotif[];
}

export interface ImageryCloud {
  l1: Array<{ id: number; name: string; palette: number }>;
  groups: CloudMotifGroup[];
  words: CloudWord[];
  motifCount: number;
}

export interface MotifWord {
  id: number;
  name: string;
  songCount: number;
}

export interface MotifWork {
  id: number;
  title: string;
  year: string | null;
  lyricist: string[] | null;
  /** 本曲在这个母题下用到的写法 */
  wordIds: number[];
}

export interface MotifLink {
  id: number;
  name: string;
  palette: number;
  /** 一起写到的作品数 */
  both: number;
  /** 是随机情况的几倍 */
  lift: number;
}

export interface MotifDetail {
  id: number;
  name: string;
  /** 一级、二级分类名 */
  path: string[];
  palette: number;
  description: string | null;
  songCount: number;
  words: MotifWord[];
  works: MotifWork[];
  /** 常与之同写；面板不展示，留给以后的母题关系图 */
  cowritten: MotifLink[];
}

// 评点：详情页上的批注
/** song 总评 / notes 创作手记某段 / lyrics 某句歌词 / score 乐谱 */
export type CommentAnchor = "song" | "notes" | "lyrics" | "score";

export interface SongComment {
  id: number;
  parentId: number | null;
  /** 回复没有自己的位置，跟随所回复的批注 */
  anchor: CommentAnchor | null;
  anchorIndex: number | null;
  anchorTime: number | null;
  /** 被批的原文，用来在原文改动后重新定位 */
  anchorQuote: string | null;
  body: string;
  /** 私批：仅自己可见 */
  private: boolean;
  /** 待审：仅自己可见 */
  pending: boolean;
  /** 已删但仍有回复，只留一个空位 */
  deleted: boolean;
  likeCount: number;
  liked: boolean;
  mine: boolean;
  /** 已删的批注不显示作者 */
  author: string | null;
  createdAt: string;
  editedAt: string | null;
}

// 校记与补遗：管理员写的勘误与资料，署录者之名。同存一表，按位置区分：
// 挂在某句歌词上的是校记，记在整首歌上的是补遗
/** 校记：slip 口误 / sung 异唱 / version 异本 / note 附记 */
export type CollationKind = "slip" | "sung" | "version" | "note";
/** 补遗：release 版本 / draft 旧稿 / note 附记 */
export type SupplementKind = "release" | "draft" | "note";

export interface SongCollation {
  id: number;
  /** 位置的存法与批注相同，歌词改动后按原句找回；补遗为 song */
  anchor: CommentAnchor;
  anchorIndex: number | null;
  anchorTime: number | null;
  anchorQuote: string | null;
  kind: CollationKind | SupplementKind;
  /** 补遗的日期：2019、2019-08 或 2019-08-15 */
  date: string | null;
  /** 句中的哪几个字，实际唱成什么 */
  quote: string | null;
  sung: string | null;
  body: string;
  /** 校者；账号已删为 null */
  collator: string | null;
  /** 订者：校者以外改过的人，按第一次修改的先后；账号已删的不列 */
  revisers: string[];
}

// 个人页「我的批评」：按歌分组
export interface MyComment {
  id: number;
  /** 回复的 anchor 取自所回复的批注 */
  anchor: CommentAnchor;
  anchorQuote: string | null;
  body: string;
  private: boolean;
  pending: boolean;
  likeCount: number;
  createdAt: string;
  editedAt: string | null;
  /** 回复时，所回复的那则批注（已删则为 null） */
  replyTo: { author: string | null; body: string } | null;
  isReply: boolean;
}

export interface MyCommentGroup {
  song: Pick<Song, "id" | "title" | "artist" | "hascover">;
  comments: MyComment[];
}

// 歌曲信息类型
export interface SongInfoRow {
  label: string;
  value: string;
  /** 署名行逐个列出名字，供版记给别名加注 */
  names?: string[];
}

export interface SongInfo {
  creativeInfo: SongInfoRow[];
  basicInfo: SongInfoRow[];
}

// 意象相关类型
export type ImageryCategory = {
  id: number;
  name: string;
  parent_id: number | null;
  level: number | null;
  description: string | null;
};

export type ImageryItem = {
  id: number;
  name: string;
  /** 标注条数，含争议歌曲 */
  count: number;
  /** imagery_motifs 登记的母题（见 IMAGERY.md）：默认母题，没登记过为 null */
  primary: number | null;
  /** 多义词的其他候选，标注时按语境与默认母题二选一 */
  alternatives: number[];
  /** 并列词的其余组成（「风雨」的雨），标注默认母题时一并写入 */
  parts: number[];
};

export type ImageryOccurrence = {
  id: number;
  song_id: number;
  imagery_id: number;
  category_id: number;
  lyric_timetag: string[];
};

/** 歌曲基调词表的一项（见 IMAGERY.md） */
export type Emotion = {
  id: number;
  name: string;
  description: string;
  /** 情绪的冷暖 */
  tone: "明" | "暗";
  /** 情绪的强弱 */
  energy: "扬" | "抑";
  sort: number;
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
  | "dispute_note"
  | "lyrics"
  | "lyrics_start"
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
  /** 输入框提示；缺省为「请输入某某」 */
  placeholder?: string;
};

// 用户记录类型（管理员用户管理面板）
export type UserRecord = {
  id: string;
  name: string;
  display: boolean;
  intro: string | null;
  is_admin: boolean;
  is_super: boolean;
  /** 试听权益：能否在站内播放 */
  can_stream: boolean;
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
  can_stream?: boolean;
};
