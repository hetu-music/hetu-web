/* eslint-disable no-console */
/**
 * 寻曲测验诊断：用真实意象数据做均匀模拟，检查推荐分布是否健康。
 *
 * 用法：pnpm quiz:diagnose [样本数]
 *
 * 先按 docs/QUIZ.md 的合格线逐项检查，有一项不过就以非零状态退出：
 * - 第一契合的基尼系数与最大占比：过高说明存在「枢纽歌曲」
 * - 曾获第一的歌曲：过少说明部分歌曲在测验中永远不可见
 * - 人格分布：某个人格过多或过少，说明题目在维度上失衡
 */
import { createClient } from "@supabase/supabase-js";
import {
  expandAnnotations,
  type PublishedAnnotation,
} from "../src/lib/imagery/consistency";
import { DIMENSIONS } from "../src/lib/quiz/dimensions";
import { buildPool, type PoolRows } from "../src/lib/quiz/pool";
import { buildModel, evaluate } from "../src/lib/quiz/model";
import { QUESTIONS } from "../src/lib/quiz/questions";
import { gini, simulate } from "../src/lib/quiz/simulate";

const PAGE_SIZE = 1000;

/** 合格线（docs/QUIZ.md「改完之后」） */
const MAX_FIRST_GINI = 0.5;
const MIN_FIRST_COVERAGE = 0.95;
/** 第一契合率最高的单曲，不超过平均值的这么多倍 */
const MAX_FIRST_RATIO = 6;
const PERSONA_RANGE = [0.09, 0.14] as const;

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

  const imagery = await fetchAll<{ id: number; name: string }>(
    "imagery",
    "id,name",
  );
  const rows: PoolRows = {
    categories: await fetchAll("imagery_categories", "id,name"),
    motifs: await fetchAll("motifs", "id,name,category_id"),
    imagery,
    // 与站内的意象索引一样：「同时算进」展开成行，时间标签按歌词算
    occurrences: expandAnnotations(
      await fetchAll<PublishedAnnotation>(
        "published_song_imagery",
        "song_id,version_id,imagery_id,motif_id,part_motif_ids",
      ),
      new Map(
        (
          await fetchAll<{ version_id: number; lyrics: string | null }>(
            "published_songs",
            "version_id,lyrics",
          )
        ).map((l) => [l.version_id, l.lyrics]),
      ),
      new Map(imagery.map((i) => [i.id, i.name])),
    ),
    songs: await fetchAll(
      // 与站内候选池同源：只取计入曲库的歌，资料有争议的不入池
      "catalog",
      "id,title,artist,album,hascover,has_audio,type,date",
    ),
    // 视图上不做关联查询，基调的明暗、扬抑按词表补上
    songEmotions: await (async () => {
      const [rows, emotions] = await Promise.all([
        fetchAll<{ song_id: number; emotion_id: number; rank: number }>(
          "published_song_emotions",
          "song_id,emotion_id,rank",
        ),
        fetchAll<{ id: number; tone: string; energy: string }>(
          "emotions",
          "id,tone,energy",
        ),
      ]);
      const byId = new Map(emotions.map((e) => [e.id, e]));
      return rows.map((r) => ({
        song_id: r.song_id,
        rank: r.rank,
        emotions: byId.get(r.emotion_id) ?? null,
      }));
    })(),
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

  const firstGini = gini(report.firstCount.values());
  const everFirst = first.filter(([, c]) => c > 0).length;
  const maxFirst = first[0]?.[1] ?? 0;
  const meanFirst = samples / pool.length;
  const personas = DIMENSIONS.map((d) => ({
    label: d.label,
    share: (report.personaCount.get(d.key) ?? 0) / samples,
  }));
  const [minShare, maxShare] = PERSONA_RANGE;
  const percent = (x: number) => `${Math.round(x * 100)}%`;

  const checks: Array<[name: string, value: string, ok: boolean]> = [
    [
      "第一契合的基尼系数",
      `${firstGini.toFixed(3)}（不高于 ${MAX_FIRST_GINI}）`,
      firstGini <= MAX_FIRST_GINI,
    ],
    [
      "曾获第一的歌曲",
      `${everFirst} / ${pool.length}（不少于 ${percent(MIN_FIRST_COVERAGE)}）`,
      everFirst >= pool.length * MIN_FIRST_COVERAGE,
    ],
    [
      "第一契合率最高的单曲",
      `${pct(maxFirst)}（不高于平均值 ${pct(meanFirst)} 的 ${MAX_FIRST_RATIO} 倍）`,
      maxFirst <= meanFirst * MAX_FIRST_RATIO,
    ],
    [
      "人格分布",
      `每个在 ${percent(minShare)}–${percent(maxShare)} 之间\n      ` +
        personas
          .map((p) => `${p.label} ${(p.share * 100).toFixed(1)}%`)
          .join("  "),
      personas.every((p) => p.share >= minShare && p.share <= maxShare),
    ],
  ];
  console.log("\n合格线：");
  for (const [name, value, ok] of checks) {
    console.log(`  ${ok ? "✓" : "✗"} ${name}：${value}`);
  }
  const failed = checks.some(([, , ok]) => !ok);

  console.log(
    `\n前五入选 基尼系数：${gini(report.topCount.values()).toFixed(3)}`,
  );
  console.log(
    `曾入前五的歌曲：${top.filter(([, c]) => c > 0).length} / ${pool.length}`,
  );
  console.log(`第一、第二维度并列：${pct(report.ties)}`);

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

  if (failed) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
