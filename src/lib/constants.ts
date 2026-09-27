import type { SongFieldConfig } from "@/lib/types";

export const FILTER_OPTION_ALL = "全部";
export const FILTER_OPTION_UNKNOWN = "未知";
export const MUSIC_LIBRARY_VIEW_MODES = ["grid", "list"] as const;
export type MusicLibraryViewMode = (typeof MUSIC_LIBRARY_VIEW_MODES)[number];
export const DEFAULT_MUSIC_LIBRARY_VIEW_MODE: MusicLibraryViewMode = "grid";
export const MUSIC_LIBRARY_ITEMS_PER_PAGE = 24;

// 歌曲字段配置
export const songFields: SongFieldConfig[] = [
  {
    key: "title",
    label: "标题",
    type: "text",
    required: true,
    minLength: 1,
    maxLength: 100,
  },
  { key: "album", label: "专辑", type: "text", maxLength: 100 },
  { key: "lyricist", label: "作词", type: "array", arrayMaxLength: 30 },
  { key: "composer", label: "作曲", type: "array", arrayMaxLength: 30 },
  { key: "arranger", label: "编曲", type: "array", arrayMaxLength: 30 },
  { key: "artist", label: "演唱", type: "array", arrayMaxLength: 30 },
  { key: "type", label: "类型", type: "array", arrayMaxLength: 30 },
  { key: "genre", label: "流派", type: "array", arrayMaxLength: 30 },
  { key: "length", label: "时长(秒)", type: "number", min: 1 },
  { key: "hascover", label: "封面", type: "boolean" },
  { key: "date", label: "日期", type: "date", maxLength: 30 },
  { key: "albumartist", label: "出品发行", type: "array", arrayMaxLength: 30 },
  { key: "comment", label: "备注", type: "textarea", maxLength: 10000 },
  { key: "lyrics", label: "LRC歌词", type: "textarea", maxLength: 10000 },
  {
    key: "lyrics_start",
    label: "歌词起点",
    type: "text",
    maxLength: 12,
    placeholder: "留空自动识别；识别有误时填正文首句的时间，如 00:23.97",
  },
  { key: "nmn_status", label: "乐谱", type: "boolean" },
  { key: "track", label: "曲号", type: "number", min: 1 },
  { key: "tracktotal", label: "曲总数", type: "number", min: 1 },
  { key: "discnumber", label: "碟号", type: "number", min: 1 },
  { key: "disctotal", label: "碟总数", type: "number", min: 1 },
  {
    key: "kugolink",
    label: "酷狗链接",
    type: "text",
    maxLength: 200,
    isUrl: true,
  },
  {
    key: "nelink",
    label: "网易云链接",
    type: "text",
    maxLength: 200,
    isUrl: true,
  },
  {
    key: "qmlink",
    label: "QQ音乐链接",
    type: "text",
    maxLength: 200,
    isUrl: true,
  },
];

// 类型顺序（用于排序）
export const TYPE_ORDER = [
  "原创",
  "合作",
  "文宣",
  "商业",
  "墨宝",
  "翻唱",
  "参与",
];

// 流派顺序（用于排序）
export const GENRE_ORDER = [
  "古风",
  "流行",
  "摇滚",
  "民谣",
  "电子",
  "说唱",
  "古典",
  "民族",
  "布鲁斯",
  "新世纪",
  "其他",
];

// 类型标签样式映射（标签显示：纯文字样式，无边框无背景）
const typeTagStyleMap: Record<string, string> = {
  原创: "text-purple-500/60 dark:text-purple-400/60",
  合作: "text-amber-500/60 dark:text-amber-400/60",
  文宣: "text-emerald-500/60 dark:text-emerald-400/60",
  商业: "text-orange-500/60 dark:text-orange-400/60",
  墨宝: "text-rose-500/60 dark:text-rose-400/60",
  翻唱: "text-blue-500/60 dark:text-blue-400/60",
  参与: "text-fuchsia-500/60 dark:text-fuchsia-400/60",
};

// 类型标签强调样式映射（用于详情页等需要突出显示的场景）
const typeTagEmphasizedStyleMap: Record<string, string> = {
  原创: "bg-white dark:bg-slate-800/50 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-500/30",
  合作: "bg-white dark:bg-slate-800/50 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-500/30",
  文宣: "bg-white dark:bg-slate-800/50 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30",
  商业: "bg-white dark:bg-slate-800/50 text-orange-600 dark:text-orange-400 border-orange-200 dark:border-orange-500/30",
  墨宝: "bg-white dark:bg-slate-800/50 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-500/30",
  翻唱: "bg-white dark:bg-slate-800/50 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-500/30",
  参与: "bg-white dark:bg-slate-800/50 text-fuchsia-600 dark:text-fuchsia-400 border-fuchsia-200 dark:border-fuchsia-500/30",
};

// 类型标签Subtle样式映射 (与Genre tags一致，透明背景 + 边框)
const typeTagSubtleStyleMap: Record<string, string> = {
  原创: "bg-transparent text-purple-500/60 dark:text-purple-400/60 border-purple-200/50 dark:border-purple-500/20",
  合作: "bg-transparent text-amber-500/60 dark:text-amber-400/60 border-amber-200/50 dark:border-amber-500/20",
  文宣: "bg-transparent text-emerald-500/60 dark:text-emerald-400/60 border-emerald-200/50 dark:border-emerald-500/20",
  商业: "bg-transparent text-orange-500/60 dark:text-orange-400/60 border-orange-200/50 dark:border-orange-500/20",
  墨宝: "bg-transparent text-rose-500/60 dark:text-rose-400/60 border-rose-200/50 dark:border-rose-500/20",
  翻唱: "bg-transparent text-blue-500/60 dark:text-blue-400/60 border-blue-200/50 dark:border-blue-500/20",
  参与: "bg-transparent text-fuchsia-500/60 dark:text-fuchsia-400/60 border-fuchsia-200/50 dark:border-fuchsia-500/20",
};

// 类型标签卡片样式映射（卡片背景：浅色背景）
const typeCardStyleMap: Record<string, string> = {
  原创: "bg-purple-50 dark:bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-500/20",
  合作: "bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-500/20",
  文宣: "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/20",
  商业: "bg-orange-50 dark:bg-orange-500/10 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-500/20",
  墨宝: "bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-500/20",
  翻唱: "bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-500/20",
  参与: "bg-fuchsia-50 dark:bg-fuchsia-500/10 text-fuchsia-700 dark:text-fuchsia-300 border-fuchsia-200 dark:border-fuchsia-500/20",
};

// 流派标签样式映射（标签显示：subtle样式，与强调颜色匹配但更淡）
const genreTagStyleMap: Record<string, string> = {
  流行: "bg-transparent text-rose-500/60 dark:text-rose-400/60 border-rose-200/50 dark:border-rose-500/20",
  古风: "bg-transparent text-blue-500/60 dark:text-blue-400/60 border-blue-200/50 dark:border-blue-500/20",
  摇滚: "bg-transparent text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700",
  民谣: "bg-transparent text-emerald-500/60 dark:text-emerald-400/60 border-emerald-200/50 dark:border-emerald-500/20",
  电子: "bg-transparent text-purple-500/60 dark:text-purple-400/60 border-purple-200/50 dark:border-purple-500/20",
  说唱: "bg-transparent text-orange-500/60 dark:text-orange-400/60 border-orange-200/50 dark:border-orange-500/20",
  民族: "bg-transparent text-amber-500/60 dark:text-amber-400/60 border-amber-200/50 dark:border-amber-500/20",
  古典: "bg-transparent text-indigo-500/60 dark:text-indigo-400/60 border-indigo-200/50 dark:border-indigo-500/20",
  其他: "bg-transparent text-fuchsia-500/60 dark:text-fuchsia-400/60 border-fuchsia-200/50 dark:border-fuchsia-500/20",
  布鲁斯:
    "bg-transparent text-cyan-500/60 dark:text-cyan-400/60 border-cyan-200/50 dark:border-cyan-500/20",
  新世纪:
    "bg-transparent text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700",
};

// 流派标签强调样式映射（用于详情页等需要突出显示的场景）
const genreTagEmphasizedStyleMap: Record<string, string> = {
  流行: "bg-white dark:bg-slate-800/50 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-500/30",
  古风: "bg-white dark:bg-slate-800/50 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-500/30",
  摇滚: "bg-white dark:bg-slate-800/50 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700",
  民谣: "bg-white dark:bg-slate-800/50 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30",
  电子: "bg-white dark:bg-slate-800/50 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-500/30",
  说唱: "bg-white dark:bg-slate-800/50 text-orange-600 dark:text-orange-400 border-orange-200 dark:border-orange-500/30",
  民族: "bg-white dark:bg-slate-800/50 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-500/30",
  古典: "bg-white dark:bg-slate-800/50 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-500/30",
  其他: "bg-white dark:bg-slate-800/50 text-fuchsia-600 dark:text-fuchsia-400 border-fuchsia-200 dark:border-fuchsia-500/30",
  布鲁斯:
    "bg-white dark:bg-slate-800/50 text-cyan-600 dark:text-cyan-400 border-cyan-200 dark:border-cyan-500/30",
  新世纪:
    "bg-white dark:bg-slate-800/50 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700",
};

// 默认标签样式
const defaultTagStyle =
  "bg-white dark:bg-slate-800/50 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700";

/**
 * 获取类型标签的样式类名
 * @param type 类型名称
 * @param variant 样式变体：'tag' 用于标签显示（默认，纯文字），'card' 用于卡片背景，'emphasized' 用于强调显示，'subtle' 用于列表显示（透明带框）
 * @returns Tailwind CSS 类名字符串
 */
export function getTypeTagStyle(
  type: string,
  variant: "tag" | "card" | "emphasized" | "subtle" | "glass" = "tag",
): string {
  if (variant === "card") {
    return typeCardStyleMap[type] || defaultTagStyle;
  }
  if (variant === "emphasized") {
    return typeTagEmphasizedStyleMap[type] || defaultTagStyle;
  }
  if (variant === "subtle") {
    return typeTagSubtleStyleMap[type] || defaultTagStyle;
  }
  if (variant === "glass") {
    const base = typeTagSubtleStyleMap[type] || defaultTagStyle;
    return base.replace(
      "bg-transparent",
      "bg-[#FAFAFA]/95 dark:bg-[#0B0F19]/95 backdrop-blur-md",
    );
  }
  return typeTagStyleMap[type] || defaultTagStyle;
}

/**
 * 获取流派标签的样式类名
 * @param genre 流派名称
 * @param variant 样式变体：'tag' 用于标签显示（默认，subtle样式），'emphasized' 用于强调显示
 * @returns Tailwind CSS 类名字符串
 */
export function getGenreTagStyle(
  genre: string,
  variant: "tag" | "emphasized" | "glass" = "tag",
): string {
  if (variant === "emphasized") {
    return genreTagEmphasizedStyleMap[genre] || defaultTagStyle;
  }
  if (variant === "glass") {
    const base = genreTagStyleMap[genre] || defaultTagStyle;
    return base.replace(
      "bg-transparent",
      "bg-[#FAFAFA]/95 dark:bg-[#0B0F19]/95 backdrop-blur-md",
    );
  }
  return genreTagStyleMap[genre] || defaultTagStyle;
}

export const typeColorMap = typeTagSubtleStyleMap;
export const genreColorMap = genreTagStyleMap;
