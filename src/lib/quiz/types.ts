/**
 * 寻曲测验（/quiz）的领域类型。
 *
 * 本目录是纯逻辑层：不依赖 React、Supabase 或浏览器环境，
 * 服务端页面、诊断脚本和单元测试共用同一份实现。
 */

/** 意象维度：由若干意象二级分类合并而成 */
export type DimensionKey =
  | "tianxiang"
  | "shanhe"
  | "caomu"
  | "qiyong"
  | "loutai"
  | "guangyin"
  | "renjian"
  | "qingsi"
  | "diangu";

export interface Dimension {
  key: DimensionKey;
  /** 维度名，如「天象」 */
  label: string;
  /** 合并进该维度的意象二级分类名 */
  categories: readonly string[];
  /** 结果页的称号 */
  motto: string;
  /** 结果页的一句话解读 */
  description: string;
}

/** 招牌意象：高频意象，作为稀疏特征单独参与匹配 */
export interface SignatureImagery {
  /** 展示名，也是特征 key */
  name: string;
  /** 数据库中计入该招牌意象的意象名（如「月」含「明月」「月光」） */
  aliases: readonly string[];
}

export interface QuizOption {
  text: string;
  /** 维度权重，通常主维度 2、副维度 1 */
  dims: Partial<Record<DimensionKey, number>>;
  /** 选中后表示偏爱的招牌意象 */
  imagery?: readonly string[];
}

export interface QuizQuestion {
  title: string;
  stem: string;
  options: readonly QuizOption[];
}

/** 一次作答：每题所选选项的下标（按题目定义顺序，不是展示顺序） */
export type Answers = readonly number[];

/** 候选池中的一首歌，由意象标注聚合而来 */
export interface PoolSong {
  id: number;
  title: string;
  artist: string[] | null;
  album: string | null;
  hascover: boolean | null;
  hasAudio: boolean;
  /** 该歌意象出现总次数 */
  total: number;
  dimCounts: Record<DimensionKey, number>;
  /** 招牌意象出现次数，只记录出现过的 */
  imageryCounts: Record<string, number>;
  /** 用于生成匹配理由的意象出现记录（只保留第一个时间标签） */
  occurrences: PoolOccurrence[];
}

export interface PoolOccurrence {
  dim: DimensionKey | null;
  imagery: string;
  timetag: string | null;
}

/** 匹配理由：来自某个共同偏好的特征 */
export type MatchReason =
  { kind: "dimension"; key: DimensionKey } | { kind: "imagery"; name: string };

export interface SongMatch {
  songId: number;
  /** 余弦相似度，[-1, 1] */
  score: number;
  /** 展示用契合度，0–100 */
  percent: number;
  reasons: MatchReason[];
}

export interface DimensionScore {
  key: DimensionKey;
  /** 相对于均匀作答分布的 z 分数 */
  z: number;
}

export interface QuizResult {
  /** 按 z 分数从高到低排序 */
  profile: DimensionScore[];
  /** 用户选中的招牌意象 */
  imagery: string[];
  matches: SongMatch[];
}
