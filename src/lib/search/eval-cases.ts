/**
 * 曲库搜索评测集（见 docs/LIBRARY.md 阶段 0）。
 *
 * 由 scripts/search-eval.ts（pnpm search:eval）对新旧两套搜索各跑一遍，新方案必须全部通过。
 * 要用线上曲库数据，所以不放进 vitest；搜索内核的单元测试用 test-fixtures.ts 里的小曲库。
 * 每条都取自线上曲库，歌词题目都核对过：所用的句子只出现在预期的那一首里。
 * 凡是按原字搜的条目（题名、人名、专辑、整句与半句歌词）都查 literal：
 * 每一条结果都得字面含有搜索词，用来量模糊匹配带出的噪音。
 * 曲库增删歌曲后，若某条不再成立，改这里，不要放宽检查。
 */

export type EvalKind =
  | "title"
  | "title-partial"
  | "title-typo"
  | "person"
  | "alias"
  | "album"
  | "lyric"
  | "lyric-partial"
  | "lyric-typo"
  | "lyric-missing"
  | "traditional"
  | "noise";

export interface EvalCase {
  query: string;
  kind: EvalKind;
  /** 在哪种字形的页面上搜；默认简体 */
  locale?: "zh-CN" | "zh-TW";
  /** 这些歌必须排在前 `k` 名之内 */
  top?: number[];
  /** `top` 的名次范围，默认 3 */
  k?: number;
  /** 这些歌必须出现在结果里，名次不限（查漏） */
  includes?: number[];
  /** 前 `k` 名必须都署有这个名字（任一署名栏，含别署；查噪音） */
  credit?: string;
  /** 每一条结果都必须在题名、专辑、署名或歌词里字面含有搜索词（查噪音） */
  literal?: boolean;
  /** 结果最多几条（查近似匹配带出的噪音） */
  maxResults?: number;
  /** 这些歌不应出现在结果里：记下已知的局限，局限解除时这条会失败，提醒来改 */
  absent?: number[];
  note?: string;
}

export const EVAL_CASES: EvalCase[] = [
  // ─── 题名 ──────────────────────────────────────────────────────────────
  { query: "倾尽天下", kind: "title", literal: true, top: [9], k: 1 },
  {
    query: "如花",
    kind: "title",
    literal: true,
    top: [23],
    k: 1,
    note: "两个字，歌词里也常见",
  },
  { query: "明月如霜", kind: "title", literal: true, top: [141], k: 1 },
  { query: "越人歌", kind: "title", literal: true, top: [5], k: 1 },
  {
    query: "雨碎江南",
    kind: "title",
    literal: true,
    top: [40, 27],
    k: 2,
    note: "完全相同的排第一，「雨碎江南·印象」紧随其后",
  },

  // ─── 部分题名 ──────────────────────────────────────────────────────────
  { query: "尽天下", kind: "title-partial", literal: true, top: [9] },
  {
    query: "江南",
    kind: "title-partial",
    literal: true,
    top: [40, 27, 46],
    k: 5,
  },
  { query: "龙图", kind: "title-partial", literal: true, top: [71, 72], k: 2 },
  { query: "卫玠", kind: "title-partial", literal: true, top: [96, 97], k: 2 },

  // ─── 题名：打错字（阶段 2「5. 题名近似」；拼音搜索不做，原来的 4 条拼音用例已删）
  {
    query: "倾尽天夏",
    kind: "title-typo",
    top: [9],
    k: 1,
    maxResults: 1,
    note: "下→夏",
  },
  {
    query: "明月如双",
    kind: "title-typo",
    top: [141],
    k: 1,
    maxResults: 1,
    note: "霜→双",
  },
  {
    query: "雨碎江男",
    kind: "title-typo",
    top: [40, 27],
    k: 2,
    maxResults: 2,
    note: "南→男",
  },
  {
    query: "朝忆梨花暮忆血",
    kind: "title-typo",
    top: [65],
    k: 1,
    note: "雪→血",
  },
  {
    query: "朝忆梨花忆雪",
    kind: "title-typo",
    top: [65],
    k: 1,
    note: "少「暮」",
  },
  {
    query: "倾尽了天下",
    kind: "title-typo",
    top: [9],
    k: 1,
    note: "多「了」",
  },
  {
    query: "江山夜此",
    kind: "title-typo",
    top: [14],
    k: 1,
    note: "两字颠倒",
  },
  {
    query: "傾盡天夏",
    kind: "title-typo",
    locale: "zh-TW",
    top: [9],
    k: 1,
    note: "繁体页上打错字",
  },
  {
    query: "越人哥",
    kind: "title-typo",
    absent: [5],
    note: "已知局限：三个字以内的题名打错字搜不到",
  },

  // ─── 人名 ──────────────────────────────────────────────────────────────
  {
    query: "司夏",
    kind: "person",
    literal: true,
    includes: [19, 96, 97, 125, 131, 132, 230, 306, 307],
    note: "演唱，共 9 首",
  },
  {
    query: "Finale",
    kind: "person",
    literal: true,
    credit: "Finale",
    k: 10,
    note: "作词 76 首",
  },
  {
    query: "李萌",
    kind: "person",
    literal: true,
    credit: "李萌",
    k: 10,
    note: "编曲 40 首",
  },
  { query: "汐音社", kind: "person", literal: true, credit: "汐音社", k: 10 },

  // ─── 别署 ──────────────────────────────────────────────────────────────
  {
    query: "萧忆情",
    kind: "alias",
    literal: true,
    includes: [349, 212, 230],
    note: "349 原署别名「萧忆情」，212、230 署主名「萧忆情Alex」",
  },
  {
    query: "恒瞾",
    kind: "alias",
    literal: true,
    includes: [155],
    note: "别名，主名「恒曌」；列表里显示主名",
  },
  {
    query: "枫宸",
    kind: "alias",
    literal: true,
    includes: [64],
    note: "别名，主名「宸枫」",
  },

  // ─── 专辑 ──────────────────────────────────────────────────────────────
  { query: "漱愿记", kind: "album", literal: true, includes: [306, 307, 308] },

  // ─── 歌词：整句 ────────────────────────────────────────────────────────
  {
    query: "七重纱衣 血溅了白纱",
    kind: "lyric",
    literal: true,
    top: [9],
    k: 1,
  },
  { query: "谁知儿郎客梦里", kind: "lyric", literal: true, top: [141], k: 1 },
  {
    query: "长梦是永夜冥河彼岸花谢那刻",
    kind: "lyric",
    literal: true,
    top: [5],
    k: 1,
  },
  {
    query: "平一场戡乱 顾半世纷繁",
    kind: "lyric",
    literal: true,
    top: [46],
    k: 1,
  },
  {
    query: "风吹过重门深庭院幽冷",
    kind: "lyric",
    literal: true,
    top: [45],
    k: 1,
  },

  // ─── 歌词：半句 ────────────────────────────────────────────────────────
  { query: "六军不发", kind: "lyric-partial", literal: true, top: [9], k: 1 },
  { query: "鸦鬓簪花", kind: "lyric-partial", literal: true, top: [13], k: 1 },
  {
    query: "她在灯下把墨研",
    kind: "lyric-partial",
    literal: true,
    top: [23],
    k: 1,
  },

  // ─── 歌词：记错一个字 ──────────────────────────────────────────────────
  { query: "七重纱衣 血溅了白沙", kind: "lyric-typo", top: [9], note: "纱→沙" },
  { query: "谁知儿郎客梦理", kind: "lyric-typo", top: [141], note: "里→理" },
  {
    query: "一纸红笺约下累世缘份",
    kind: "lyric-typo",
    top: [45],
    note: "分→份",
  },
  {
    query: "临风提酒自斟自饮自许风雅",
    kind: "lyric-typo",
    top: [2],
    note: "诩→许",
  },

  // ─── 歌词：少记一个字 ──────────────────────────────────────────────────
  {
    query: "转头十年见王城破",
    kind: "lyric-missing",
    top: [13],
    note: "少「眼」",
  },
  {
    query: "庭树知故事 殷记今朝",
    kind: "lyric-missing",
    top: [17],
    note: "少一个「殷」",
  },

  // ─── 简繁 ──────────────────────────────────────────────────────────────
  { query: "傾盡天下", kind: "traditional", locale: "zh-TW", top: [9], k: 1 },
  {
    query: "七重紗衣 血濺了白紗",
    kind: "traditional",
    locale: "zh-TW",
    top: [9],
    k: 1,
  },
  {
    query: "她在燈下把墨研",
    kind: "traditional",
    locale: "zh-TW",
    top: [23],
    k: 1,
  },
  {
    query: "她在灯下把墨研",
    kind: "traditional",
    locale: "zh-TW",
    top: [23],
    k: 1,
    note: "繁体页上用简体输入",
  },
  {
    query: "如梦",
    kind: "traditional",
    locale: "zh-TW",
    top: [3],
    k: 1,
    note: "繁体页上用简体输入短题名（页面上的题名是「如夢」）",
  },
  {
    query: "如夢",
    kind: "traditional",
    top: [3],
    k: 1,
    note: "简体页上用繁体输入短题名",
  },
  {
    query: "六軍不發",
    kind: "traditional",
    locale: "zh-TW",
    top: [9],
    k: 1,
    note: "繁体页上的半句歌词，四个字里两个繁简不同",
  },
  {
    query: "鴉鬢簪花",
    kind: "traditional",
    top: [13],
    k: 1,
    note: "简体页上用繁体输入半句歌词",
  },
  {
    query: "華胥引",
    kind: "traditional",
    top: [45],
    k: 1,
    note: "简体页上用繁体输入",
  },

  // ─── 噪音 ──────────────────────────────────────────────────────────────
  {
    query: "不知道",
    kind: "noise",
    literal: true,
    note: "曲库里只有 3 首含这三个字",
  },
  { query: "天下", kind: "noise", literal: true },
  { query: "明月", kind: "noise", literal: true },
];
