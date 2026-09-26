/**
 * 意象预标注：用意象词典匹配 LRC 歌词，生成待人工审核的标注候选。
 *
 * 纯逻辑层：不依赖 Supabase 或浏览器环境，服务端接口、诊断脚本和单元测试共用。
 *
 * 词典匹配几乎能找全人工标注（歌词里字面出现的意象），但也会命中大量
 * 「人」「心」「天」这类很少被标注的字。因此每个意象附带一个历史先验：
 * 在已标注的歌曲中，歌词出现该意象时它被标注的比例。先验达到阈值的候选默认勾选，
 * 其余放进低置信列表由人决定。
 */

export interface LrcLine {
  /** 原始时间标签，如 "01:26.04"，与 imagery_occurrences.lyric_timetag 格式一致 */
  tag: string;
  text: string;
}

export interface DictionaryEntry {
  id: number;
  name: string;
}

export interface ImageryPrior {
  /** 已标注歌曲中，歌词字面出现该意象的歌曲数 */
  seen: number;
  /** 其中确实标注了该意象的歌曲数 */
  annotated: number;
  /** 历史上使用过的分类，按使用次数从多到少 */
  categoryIds: number[];
}

export interface ImagerySuggestion {
  imageryId: number;
  name: string;
  /** 意象所在歌词行的时间标签，按时间顺序去重 */
  timetags: string[];
  /** 时间标签对应的歌词文本，与 timetags 一一对应 */
  lines: string[];
  /** 可选分类，第一个为默认值；为空表示该意象从未被标注过，需要人工选择 */
  categoryIds: number[];
  seen: number;
  annotated: number;
  /** 历史标注率 annotated / seen；seen 为 0 时为 null */
  rate: number | null;
  /** 是否默认勾选 */
  recommended: boolean;
}

/**
 * 默认勾选的历史标注率门槛。2026-09 用已有标注做 20 折交叉验证：
 * 默认勾选的候选约 64% 与人工标注一致；有历史分类的意象中约八成会被默认勾选，
 * 其余人工标注几乎都能在低置信列表里找到（全部候选的召回率 99.8%）。
 */
export const RECOMMEND_THRESHOLD = 0.25;

const TIMETAG = /\[(\d{1,2}:\d{2}(?:\.\d{2,3})?)\]/g;
const METADATA = /^\[(?:ti|ar|al|by|offset|re|ve):/i;

/**
 * 制作名单行的角色关键词。「公子羽：……」「女：……」这类对白和对唱行
 * 本身是歌词、会被标注，所以只有冒号前每一段都是制作角色时才跳过。
 */
const CREDIT_ROLES =
  /词|曲|编|唱|混|和声|合声|制作|出品|监制|策划|企划|统筹|发行|宣传|母带|录音|人声|后期|剪辑|吉他|贝斯|鼓|键盘|钢琴|提琴|弦|二胡|琵琶|古筝|笛|箫|封面|海报|题字|美工|美术|设计|绘|视频|字幕|文案|人设|故事|鸣谢|感谢|协力|op|sp|pv|mv/i;
const CREDIT_LINE = /^([^：:]{1,15})[：:]/;
/** 「歌名 - 河图」式的标题行 */
const TITLE_LINE = /\S\s+-\s+\S/;

function isCreditLine(text: string): boolean {
  if (TITLE_LINE.test(text)) return true;
  const m = text.match(CREDIT_LINE);
  if (!m) return false;
  return m[1]
    .split(/[/、&,，\s]+/)
    .filter(Boolean)
    .every((part) => CREDIT_ROLES.test(part));
}

/**
 * 解析 LRC，保留原始时间标签字符串；跳过元数据、空行和制作名单行。
 * 一行多个时间标签（副歌复用）时展开为多行。
 */
export function parseLrcLines(lrc: string | null | undefined): LrcLine[] {
  if (!lrc) return [];
  const out: LrcLine[] = [];
  for (const raw of lrc.split("\n")) {
    const line = raw.trim();
    if (!line || METADATA.test(line)) continue;
    const tags = [...line.matchAll(TIMETAG)].map((m) => m[1]);
    const text = line.replace(TIMETAG, "").trim();
    if (tags.length === 0 || !text || isCreditLine(text)) continue;
    for (const tag of tags) out.push({ tag, text });
  }
  return out.sort((a, b) => tagToSeconds(a.tag) - tagToSeconds(b.tag));
}

function tagToSeconds(tag: string): number {
  const [m, s] = tag.split(":");
  return Number(m) * 60 + Number(s);
}

const ASCII_WORD = /^[a-z0-9]+$/;
const ASCII_CHAR = /[a-z0-9]/;

/**
 * 构造词典匹配器。意象名只有 1–7 个字，因此枚举每个位置起长度不超过最长词的子串
 * 去查表：耗时只与歌词长度成正比，与词典大小无关。
 * 英文意象大小写不敏感，并要求整词匹配，避免 god 命中 goddess。
 */
export function createMatcher(dictionary: readonly DictionaryEntry[]) {
  const byName = new Map<string, number>();
  let maxLen = 0;
  for (const entry of dictionary) {
    const name = entry.name.trim().toLowerCase();
    if (!name) continue;
    byName.set(name, entry.id);
    maxLen = Math.max(maxLen, name.length);
  }

  /** 返回 意象 id → 命中的歌词行（按输入顺序，同一时间标签只记一次） */
  return function match(lines: readonly LrcLine[]): Map<number, LrcLine[]> {
    const found = new Map<number, LrcLine[]>();
    for (const line of lines) {
      const text = line.text.toLowerCase();
      const hitsInLine = new Set<number>();
      for (let i = 0; i < text.length; i++) {
        const limit = Math.min(maxLen, text.length - i);
        for (let len = 1; len <= limit; len++) {
          const word = text.slice(i, i + len);
          const id = byName.get(word);
          if (id === undefined) continue;
          if (
            ASCII_WORD.test(word) &&
            (ASCII_CHAR.test(text[i - 1] ?? "") ||
              ASCII_CHAR.test(text[i + len] ?? ""))
          ) {
            continue;
          }
          hitsInLine.add(id);
        }
      }
      for (const id of hitsInLine) {
        const list = found.get(id);
        if (!list) found.set(id, [line]);
        else if (!list.some((l) => l.tag === line.tag)) list.push(line);
      }
    }
    return found;
  };
}

/**
 * 从已有标注计算每个意象的历史先验。
 *
 * 只统计至少有一条标注的歌曲——尚未标注的歌会把「出现但未标注」的次数虚增。
 * excludeSongId 用于排除当前正在标注的歌，使它已有的部分标注不影响自身的候选排序。
 */
export function buildPriors(input: {
  dictionary: readonly DictionaryEntry[];
  occurrences: ReadonlyArray<{
    song_id: number;
    imagery_id: number;
    category_id: number;
  }>;
  songs: ReadonlyArray<{ id: number; lyrics: string | null }>;
  excludeSongId?: number;
}): Map<number, ImageryPrior> {
  const annotatedBySong = new Map<number, Set<number>>();
  const categoryCounts = new Map<number, Map<number, number>>();
  for (const occ of input.occurrences) {
    let set = annotatedBySong.get(occ.song_id);
    if (!set) annotatedBySong.set(occ.song_id, (set = new Set()));
    set.add(occ.imagery_id);

    let counts = categoryCounts.get(occ.imagery_id);
    if (!counts) categoryCounts.set(occ.imagery_id, (counts = new Map()));
    counts.set(occ.category_id, (counts.get(occ.category_id) ?? 0) + 1);
  }

  const match = createMatcher(input.dictionary);
  const seen = new Map<number, number>();
  const annotated = new Map<number, number>();
  for (const song of input.songs) {
    if (song.id === input.excludeSongId) continue;
    const labels = annotatedBySong.get(song.id);
    if (!labels) continue;
    for (const id of match(parseLrcLines(song.lyrics)).keys()) {
      seen.set(id, (seen.get(id) ?? 0) + 1);
      if (labels.has(id)) annotated.set(id, (annotated.get(id) ?? 0) + 1);
    }
  }

  const priors = new Map<number, ImageryPrior>();
  for (const entry of input.dictionary) {
    const counts = categoryCounts.get(entry.id);
    priors.set(entry.id, {
      seen: seen.get(entry.id) ?? 0,
      annotated: annotated.get(entry.id) ?? 0,
      categoryIds: counts
        ? [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id)
        : [],
    });
  }
  return priors;
}

/** 该意象在每一行里的每次出现，是否都被同一首歌中命中的更长意象覆盖 */
function isCoveredByLongerWord(
  target: ImagerySuggestion,
  all: readonly ImagerySuggestion[],
): boolean {
  const name = target.name.toLowerCase();
  const longer = all
    .map((s) => s.name.toLowerCase())
    .filter((n) => n.length > name.length && n.includes(name))
    .sort((a, b) => b.length - a.length);
  if (longer.length === 0) return false;
  return target.lines.every((line) => {
    let rest = line.toLowerCase();
    for (const word of longer) rest = rest.split(word).join("\u0000");
    return !rest.includes(name);
  });
}

/**
 * 为一首歌生成标注候选。已标注过的意象（existingImageryIds）不再重复给出。
 *
 * 排序：默认勾选的在前、按首次出现的时间；低置信的在后、按历史标注率从高到低。
 */
export function suggestImagery(input: {
  lyrics: string | null | undefined;
  dictionary: readonly DictionaryEntry[];
  priors: ReadonlyMap<number, ImageryPrior>;
  existingImageryIds?: ReadonlySet<number>;
  threshold?: number;
}): ImagerySuggestion[] {
  const threshold = input.threshold ?? RECOMMEND_THRESHOLD;
  const nameById = new Map(input.dictionary.map((e) => [e.id, e.name]));
  const lines = parseLrcLines(input.lyrics);
  const found = createMatcher(input.dictionary)(lines);

  const suggestions: ImagerySuggestion[] = [];
  for (const [imageryId, hits] of found) {
    if (input.existingImageryIds?.has(imageryId)) continue;
    const prior = input.priors.get(imageryId);
    const seen = prior?.seen ?? 0;
    const annotated = prior?.annotated ?? 0;
    const categoryIds = prior?.categoryIds ?? [];
    const rate = seen > 0 ? annotated / seen : null;
    suggestions.push({
      imageryId,
      name: nameById.get(imageryId) ?? "",
      timetags: hits.map((l) => l.tag),
      lines: hits.map((l) => l.text),
      categoryIds,
      seen,
      annotated,
      rate,
      // 从未在其他歌里出现过、但已标注过的意象（只在个别歌里用过的专名等）也默认勾选
      recommended:
        categoryIds.length > 0 && (rate === null || rate >= threshold),
    });
  }

  // 「月」每次出现都在「岁月」「明月」里时，多半只该标长词：不默认勾选
  for (const s of suggestions) {
    if (s.recommended && isCoveredByLongerWord(s, suggestions)) {
      s.recommended = false;
    }
  }

  const firstTime = (s: ImagerySuggestion) => tagToSeconds(s.timetags[0]);
  return suggestions.sort((a, b) => {
    if (a.recommended !== b.recommended) return a.recommended ? -1 : 1;
    if (a.recommended) return firstTime(a) - firstTime(b);
    return (b.rate ?? 0) - (a.rate ?? 0) || firstTime(a) - firstTime(b);
  });
}
