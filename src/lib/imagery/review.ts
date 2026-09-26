/**
 * 意象预标注的 LLM 校验：构造提示词、定义输出结构、校验模型输出。
 *
 * 纯逻辑层，不发请求。模型输出一律视为不可信数据：候选 id、行号、分类 id
 * 都要对照输入重新校验，对不上的项直接丢弃。
 */
import { z } from "zod";
import type { LrcLine } from "./suggest";

export interface ReviewCandidate {
  imageryId: number;
  name: string;
  /** 其他歌中的历史标注率，null 表示无参考 */
  rate: number | null;
  /** 词典匹配阶段是否默认勾选 */
  recommended: boolean;
}

export interface ReviewCategory {
  id: number;
  /** 完整路径，如「天象 / 星相」 */
  label: string;
}

/** 可挂载意象的叶子分类，标签为从根到叶的完整路径 */
export function toLeafCategories(
  categories: ReadonlyArray<{
    id: number;
    name: string;
    parent_id: number | null;
  }>,
): ReviewCategory[] {
  type Row = (typeof categories)[number];
  const byId = new Map(categories.map((c) => [c.id, c]));
  const parents = new Set(categories.map((c) => c.parent_id));
  const pathOf = (cat: Row): string => {
    const names: string[] = [];
    const visited = new Set<number>();
    for (
      let c: Row | undefined = cat;
      c && !visited.has(c.id);
      c = c.parent_id === null ? undefined : byId.get(c.parent_id)
    ) {
      visited.add(c.id);
      names.unshift(c.name);
    }
    return names.join(" / ");
  };
  return categories
    .filter((c) => !parents.has(c.id))
    .map((c) => ({ id: c.id, label: pathOf(c) }))
    .sort((a, b) => a.label.localeCompare(b.label, "zh-CN"));
}

export interface ReviewVerdict {
  imageryId: number;
  keep: boolean;
  reason: string;
}

export interface ReviewAddition {
  name: string;
  timetags: string[];
  lines: string[];
  categoryId: number | null;
  reason: string;
}

export interface ReviewResult {
  verdicts: ReviewVerdict[];
  additions: ReviewAddition[];
}

/** 单次最多补充的意象数，防止模型把整首歌拆成词表 */
export const MAX_ADDITIONS = 10;

export const REVIEW_SYSTEM_PROMPT = `你是中文歌词意象标注的审校助手，协助整理古风歌手河图作品的意象库。

「意象」指歌词中承载画面或情感的具体事物与概念，分类体系覆盖：天象、地理、地点、植物、动物、器物、饮食、建筑、时间、身体、身份、情感、传说、习俗、文体。

你会收到一首歌的歌词（带行号）和一组由词典匹配得到的候选意象。词典匹配只看字面，所以会有误命中。请完成两件事：

你的判断要贴合这个意象库已有的标注习惯，而不是一般意义上「有没有意境」。每个候选附有历史标注率：在其他歌里，歌词出现这个词时被人工标注的比例。

1. 逐个判断候选，输出保留或剔除。候选分两类，标准不同：
   - 「默认勾选」的候选历史上常被标注。你的主要任务是找出其中的误命中：只是其他词的构词成分（如「风格」里的「风」、「时光」里的「光」）；作虚词、量词或泛指代词（如「一念之差为人作嫁」里的「人」）；出现在人名、歌名等专名里。除此之外一律保留，不要因为觉得不够有意境而剔除。
   - 「默认不勾选」的候选历史上很少被标注，或每次都被更长的意象包含。这个意象库一般不标抽象概念和情绪词（如爱、恨、心、梦、魂、命运、因果、故事、年少、名字），也不重复标已被更长意象包含的字。只有当它在句中独立使用、且是具体物象（可见可触的景物、器物、人物身份等）时才改为保留；拿不准就剔除。
2. 补充候选里没有、但歌词中独立出现的具体物象名词（最多 ${MAX_ADDITIONS} 个，宁缺毋滥）。不要补充抽象概念、情绪词、动词、形容词，也不要补充候选中已有的词。补充项要给出所在行号，并从分类列表中选择最贴切的分类 id。

理由用中文，一句话，不超过 20 字。`;

/** 模型输出的 JSON Schema（OpenAI 兼容接口的 response_format.json_schema.schema） */
export const REVIEW_OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    verdicts: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "integer", description: "候选编号" },
          keep: { type: "boolean" },
          reason: { type: "string" },
        },
        required: ["id", "keep", "reason"],
        additionalProperties: false,
      },
    },
    additions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string", description: "意象名，须是歌词原文中的词" },
          lines: {
            type: "array",
            items: { type: "integer" },
            description: "出现的行号",
          },
          categoryId: { type: "integer", description: "分类列表中的 id" },
          reason: { type: "string" },
        },
        required: ["name", "lines", "categoryId", "reason"],
        additionalProperties: false,
      },
    },
  },
  required: ["verdicts", "additions"],
  additionalProperties: false,
} as const;

const outputSchema = z.object({
  verdicts: z.array(
    z.object({
      id: z.number().int(),
      keep: z.boolean(),
      reason: z.string(),
    }),
  ),
  additions: z.array(
    z.object({
      name: z.string(),
      lines: z.array(z.number().int()),
      categoryId: z.number().int(),
      reason: z.string(),
    }),
  ),
});

/** 同一句歌词可能对应多个时间标签（副歌复用），提示词里按文本去重编号 */
function numberLines(lines: readonly LrcLine[]) {
  const texts: string[] = [];
  const tagsByText = new Map<string, string[]>();
  for (const line of lines) {
    const tags = tagsByText.get(line.text);
    if (tags) tags.push(line.tag);
    else {
      tagsByText.set(line.text, [line.tag]);
      texts.push(line.text);
    }
  }
  return { texts, tagsByText };
}

export function buildReviewPrompt(input: {
  title: string;
  lines: readonly LrcLine[];
  candidates: readonly ReviewCandidate[];
  categories: readonly ReviewCategory[];
}): string {
  const { texts } = numberLines(input.lines);
  const lyrics = texts.map((t, i) => `${i + 1}. ${t}`).join("\n");
  const candidates = input.candidates
    .map((c, i) => {
      const rate = c.rate === null ? "无参考" : `${Math.round(c.rate * 100)}%`;
      const state = c.recommended ? "默认勾选" : "默认不勾选";
      return `${i + 1}. ${c.name}（${state}，历史标注率 ${rate}）`;
    })
    .join("\n");
  const categories = input.categories
    .map((c) => `${c.id}: ${c.label}`)
    .join("\n");

  return `歌名：${input.title}

## 歌词
${lyrics}

## 候选意象（编号: 名称）
${candidates}

## 分类列表（id: 路径），仅补充意象时使用
${categories}`;
}

/**
 * 校验并还原模型输出：候选编号映射回意象 id、行号映射回时间标签。
 * 结构不符时抛错；个别项对不上时丢弃该项。
 */
export function parseReviewOutput(
  raw: unknown,
  input: {
    lines: readonly LrcLine[];
    candidates: readonly ReviewCandidate[];
    categories: readonly ReviewCategory[];
  },
): ReviewResult {
  const parsed = outputSchema.parse(raw);
  const { texts, tagsByText } = numberLines(input.lines);
  const leafIds = new Set(input.categories.map((c) => c.id));
  const candidateNames = new Set(input.candidates.map((c) => c.name));

  const seen = new Set<number>();
  const verdicts: ReviewVerdict[] = [];
  for (const v of parsed.verdicts) {
    const candidate = input.candidates[v.id - 1];
    if (!candidate || seen.has(candidate.imageryId)) continue;
    seen.add(candidate.imageryId);
    verdicts.push({
      imageryId: candidate.imageryId,
      keep: v.keep,
      reason: v.reason.trim().slice(0, 60),
    });
  }

  const additions: ReviewAddition[] = [];
  const addedNames = new Set<string>();
  for (const a of parsed.additions) {
    const name = a.name.trim();
    if (!name || name.length > 50) continue;
    if (candidateNames.has(name) || addedNames.has(name)) continue;
    const lineTexts = [...new Set(a.lines)]
      .map((n) => texts[n - 1])
      .filter((t): t is string => t !== undefined && t.includes(name));
    if (lineTexts.length === 0) continue;
    const pairs = lineTexts.flatMap((text) =>
      (tagsByText.get(text) ?? []).map((tag) => ({ tag, text })),
    );
    addedNames.add(name);
    additions.push({
      name,
      timetags: pairs.map((p) => p.tag),
      lines: pairs.map((p) => p.text),
      categoryId: leafIds.has(a.categoryId) ? a.categoryId : null,
      reason: a.reason.trim().slice(0, 60),
    });
    if (additions.length >= MAX_ADDITIONS) break;
  }

  return { verdicts, additions };
}
