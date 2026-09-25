/* eslint-disable no-console */
/**
 * 寻曲测验诊断：用真实意象数据做均匀模拟，检查推荐分布是否健康。
 *
 * 用法：pnpm quiz:diagnose [样本数]
 *
 * 关注指标：
 * - 第一契合的基尼系数与最大占比：过高说明存在「枢纽歌曲」
 * - 从未进入前五的歌曲数：过多说明部分歌曲在测验中永远不可见
 */
import { createClient } from "@supabase/supabase-js";
import { buildPool, type PoolRows } from "../src/lib/quiz/pool";
import { buildModel, evaluate } from "../src/lib/quiz/model";
import { QUESTIONS } from "../src/lib/quiz/questions";
import { gini, simulate } from "../src/lib/quiz/simulate";

const PAGE_SIZE = 1000;

async function main() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_API;
  if (!url || !key) throw new Error("缺少 SUPABASE_URL / SUPABASE_SECRET_API");
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

  const rows: PoolRows = {
    categories: await fetchAll("imagery_categories", "id,name,parent_id,level"),
    imagery: await fetchAll("imagery", "id,name"),
    occurrences: await fetchAll(
      "imagery_occurrences",
      "song_id,category_id,imagery_id,lyric_timetag",
    ),
    songs: await fetchAll(
      "music",
      "id,title,artist,album,hascover,has_audio,type",
    ),
  };

  const pool = buildPool(rows);
  const model = buildModel(pool, QUESTIONS);
  const title = new Map(pool.map((s) => [s.id, s.title]));
  const samples = Number(process.argv[2] ?? 20000);

  console.log(`候选池：${pool.length} 首`);
  const matchedImagery = new Set(
    pool.flatMap((s) => Object.keys(s.imageryCounts)),
  );
  console.log(`招牌意象命中：${[...matchedImagery].join(" ")}`);

  const t0 = performance.now();
  const report = simulate(model, samples);
  const ms = performance.now() - t0;
  console.log(`\n均匀模拟 ${samples} 次，耗时 ${ms.toFixed(0)}ms`);

  const first = [...report.firstCount.entries()].sort((a, b) => b[1] - a[1]);
  const top = [...report.topCount.entries()].sort((a, b) => b[1] - a[1]);
  const pct = (n: number) => ((n / samples) * 100).toFixed(2) + "%";

  console.log(
    `第一契合 基尼系数：${gini(report.firstCount.values()).toFixed(3)}`,
  );
  console.log(
    `前五入选 基尼系数：${gini(report.topCount.values()).toFixed(3)}`,
  );
  console.log(
    `曾获第一的歌曲：${first.filter(([, c]) => c > 0).length} / ${pool.length}`,
  );
  console.log(
    `曾入前五的歌曲：${top.filter(([, c]) => c > 0).length} / ${pool.length}`,
  );
  console.log(`均匀分布下每首歌的期望第一率：${pct(samples / pool.length)}`);

  console.log("\n第一契合率最高的 10 首：");
  for (const [id, c] of first.slice(0, 10)) {
    console.log(`  ${pct(c).padStart(7)}  ${title.get(id)}`);
  }
  console.log("\n前五入选率最高的 10 首：");
  for (const [id, c] of top.slice(0, 10)) {
    console.log(`  ${pct(c).padStart(7)}  ${title.get(id)}`);
  }

  // 几种典型作答：每题都选同一个位置，便于人工检查结果是否合理
  console.log("\n典型作答：");
  for (const choice of [0, 1, 2, 3]) {
    const answers = QUESTIONS.map(() => choice);
    const result = evaluate(model, answers);
    const persona = result.profile
      .slice(0, 3)
      .map((p) => `${p.key}(${p.z.toFixed(1)})`)
      .join(" ");
    const songs = result.matches
      .map((m) => `${title.get(m.songId)}${m.percent}%`)
      .join("、");
    console.log(`  全选 ${"ABCD"[choice]}：${persona}\n    → ${songs}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
