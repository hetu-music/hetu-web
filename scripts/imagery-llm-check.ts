/* eslint-disable no-console */
/**
 * 意象预标注 LLM 校验的效果评估：在已人工标注的歌上跑一遍「词典匹配 → AI 校验」，
 * 把默认勾选的结果与人工标注对比。每首歌调用一次模型，会产生费用。
 *
 * 用法：pnpm imagery:llm-check [歌曲数，默认 5]
 * 需要 .env.local 中的 SUPABASE_URL / SUPABASE_SECRET_API 与 LLM_API_KEY / LLM_MODEL。
 *
 * 指标：
 * - 精确率：默认勾选的意象中，人工也标注了的比例（越高，需要手动取消的越少）
 * - 召回率：人工标注的意象中，被默认勾选的比例（越高，需要手动补的越少）
 * - 补充命中：AI 补充的意象中，人工也标注了的个数
 */
import { createClient } from "@supabase/supabase-js";
import {
  buildReviewPrompt,
  parseReviewOutput,
  REVIEW_OUTPUT_SCHEMA,
  REVIEW_SYSTEM_PROMPT,
  toLeafCategories,
} from "../src/lib/imagery/review";
import {
  buildPriors,
  parseLrcLines,
  suggestImagery,
} from "../src/lib/imagery/suggest";
import { chatJson, isLlmConfigured } from "../src/lib/server/llm";

const PAGE_SIZE = 1000;

async function main() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_API;
  if (!url || !key) throw new Error("缺少 SUPABASE_URL / SUPABASE_SECRET_API");
  if (!isLlmConfigured()) throw new Error("缺少 LLM_API_KEY / LLM_MODEL");
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  async function fetchAll<T>(table: string, select: string): Promise<T[]> {
    const out: T[] = [];
    for (let from = 0; ; from += PAGE_SIZE) {
      const { data, error } = await supabase
        .from(table)
        .select(select)
        .range(from, from + PAGE_SIZE - 1);
      if (error) throw error;
      out.push(...(data as T[]));
      if (data.length < PAGE_SIZE) return out;
    }
  }

  const [dictionary, occurrences, songs, categoryRows] = await Promise.all([
    fetchAll<{ id: number; name: string }>("imagery", "id,name"),
    fetchAll<{ song_id: number; imagery_id: number; category_id: number }>(
      "imagery_occurrences",
      "song_id,imagery_id,category_id",
    ),
    fetchAll<{ id: number; title: string; lyrics: string | null }>(
      "music",
      "id,title,lyrics",
    ),
    fetchAll<{ id: number; name: string; parent_id: number | null }>(
      "imagery_categories",
      "id,name,parent_id",
    ),
  ]);

  const categories = toLeafCategories(categoryRows);
  const nameById = new Map(dictionary.map((d) => [d.id, d.name]));
  const truthBySong = new Map<number, Set<string>>();
  for (const o of occurrences) {
    const set = truthBySong.get(o.song_id) ?? new Set<string>();
    set.add(nameById.get(o.imagery_id) ?? "");
    truthBySong.set(o.song_id, set);
  }

  // 均匀抽取：按 id 排序后等间隔取，结果可复现
  const labeled = songs
    .filter((s) => truthBySong.has(s.id) && s.lyrics)
    .sort((a, b) => a.id - b.id);
  const count = Math.min(Number(process.argv[2] ?? 5), labeled.length);
  const sample = Array.from(
    { length: count },
    (_, i) => labeled[Math.floor((i * labeled.length) / count)],
  );

  const totals = { truth: 0, before: [0, 0], after: [0, 0], added: [0, 0] };
  for (const song of sample) {
    const truth = truthBySong.get(song.id) ?? new Set<string>();
    const priors = buildPriors({
      dictionary,
      occurrences,
      songs,
      excludeSongId: song.id,
    });
    const suggestions = suggestImagery({
      lyrics: song.lyrics,
      dictionary,
      priors,
    });
    const candidates = suggestions.map((s) => ({
      imageryId: s.imageryId,
      name: s.name,
      rate: s.rate,
      recommended: s.recommended,
    }));
    const lines = parseLrcLines(song.lyrics);

    const t0 = performance.now();
    const raw = await chatJson({
      system: REVIEW_SYSTEM_PROMPT,
      user: buildReviewPrompt({
        title: song.title,
        lines,
        candidates,
        categories,
      }),
      schemaName: "imagery_review",
      schema: REVIEW_OUTPUT_SCHEMA,
    });
    const seconds = ((performance.now() - t0) / 1000).toFixed(1);
    const review = parseReviewOutput(raw, { lines, candidates, categories });

    const verdict = new Map(review.verdicts.map((v) => [v.imageryId, v]));
    const before = suggestions.filter((s) => s.recommended);
    const after = suggestions.filter(
      (s) => verdict.get(s.imageryId)?.keep ?? s.recommended,
    );
    const hits = (list: { name: string }[]) =>
      list.filter((s) => truth.has(s.name)).length;

    totals.truth += truth.size;
    totals.before[0] += hits(before);
    totals.before[1] += before.length;
    totals.after[0] += hits(after);
    totals.after[1] += after.length;
    totals.added[0] += hits(review.additions);
    totals.added[1] += review.additions.length;

    console.log(
      `\n《${song.title}》 人工 ${truth.size} 个 | 规则勾选 ${before.length}（对 ${hits(before)}）→ AI 后 ${after.length}（对 ${hits(after)}）| 补充 ${review.additions.length}（对 ${hits(review.additions)}）| ${seconds}s`,
    );
    for (const s of suggestions) {
      const v = verdict.get(s.imageryId);
      if (!v || v.keep === s.recommended) continue;
      const mark = truth.has(s.name) === v.keep ? "✓" : "✗";
      console.log(
        `  ${mark} ${v.keep ? "补勾" : "取消"} ${s.name}：${v.reason}`,
      );
    }
    for (const a of review.additions) {
      console.log(
        `  ${truth.has(a.name) ? "✓" : "·"} 补充 ${a.name}：${a.reason}`,
      );
    }
  }

  const pct = (a: number, b: number) =>
    b === 0 ? "-" : `${((a / b) * 100).toFixed(0)}%`;
  console.log(`\n共 ${sample.length} 首，人工标注 ${totals.truth} 个`);
  console.log(
    `规则勾选：精确率 ${pct(totals.before[0], totals.before[1])}，召回率 ${pct(totals.before[0], totals.truth)}`,
  );
  console.log(
    `AI 校验后：精确率 ${pct(totals.after[0], totals.after[1])}，召回率 ${pct(totals.after[0], totals.truth)}`,
  );
  console.log(
    `AI 补充：${totals.added[1]} 个，其中人工也标注了 ${totals.added[0]} 个`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
