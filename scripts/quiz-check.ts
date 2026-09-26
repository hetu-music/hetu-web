/* eslint-disable no-console */
/**
 * 寻曲测验数据覆盖检查：对照数据库检查 src/lib/quiz/dimensions.ts 里手工维护的映射，
 * 并列出还差标注才能进入测验的歌曲。只读，不写数据库。
 *
 * 用法：pnpm quiz:check [--strict]
 *   --strict  发现结构性漂移（未映射/已消失的分类、失效的别名）时以退出码 1 结束，
 *             供定时任务或 CI 使用；待标注歌曲和别名建议只提示，不算失败。
 */
import { createClient } from "@supabase/supabase-js";
import { checkCoverage } from "../src/lib/quiz/coverage";
import { MIN_OCCURRENCES, type PoolRows } from "../src/lib/quiz/pool";

const PAGE_SIZE = 1000;

async function main() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_API;
  if (!url || !key) throw new Error("缺少 SUPABASE_URL / SUPABASE_SECRET_API");
  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const strict = process.argv.includes("--strict");

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

  const [categories, imagery, occurrences, songs] = await Promise.all([
    fetchAll<PoolRows["categories"][number]>(
      "imagery_categories",
      "id,name,parent_id,level",
    ),
    fetchAll<PoolRows["imagery"][number]>("imagery", "id,name"),
    fetchAll<PoolRows["occurrences"][number]>(
      "imagery_occurrences",
      "song_id,category_id,imagery_id,lyric_timetag",
    ),
    fetchAll<PoolRows["songs"][number] & { lyrics: string | null }>(
      "music",
      "id,title,artist,album,hascover,has_audio,type,lyrics",
    ),
  ]);
  const report = checkCoverage({ categories, imagery, occurrences, songs });

  let problems = 0;
  const section = (title: string) => console.log(`\n■ ${title}`);

  section("意象分类与测验维度（dimensions.ts）");
  if (report.unmappedCategories.length === 0) {
    console.log("  ✓ 所有二级分类都已映射到维度");
  }
  for (const c of report.unmappedCategories) {
    problems += 1;
    console.log(
      `  ✗ 「${c.name}」没有映射到任何维度，其下 ${c.occurrences} 条标注在测验中被忽略`,
    );
  }
  for (const name of report.missingCategories) {
    problems += 1;
    console.log(`  ✗ 映射引用的「${name}」已不在数据库中（是否改名了？）`);
  }

  section("招牌意象别名");
  if (report.missingAliases.length === 0) {
    console.log("  ✓ 所有别名都存在于意象表");
  }
  for (const a of report.missingAliases) {
    problems += 1;
    console.log(
      `  ✗ 「${a.signature}」的别名「${a.alias}」不在意象表中，不会命中`,
    );
  }
  if (report.aliasSuggestions.length > 0) {
    console.log(
      `\n  可考虑加入别名（与现有别名同类、出现在多首歌中；修改后记得递增 POOL_VERSION）：`,
    );
    const bySignature = new Map<string, string[]>();
    for (const s of report.aliasSuggestions) {
      const list = bySignature.get(s.signature) ?? [];
      list.push(`${s.name}(${s.songs})`);
      bySignature.set(s.signature, list);
    }
    for (const [signature, names] of bySignature) {
      console.log(`    ${signature}：${names.join(" ")}`);
    }
  }

  section(`待标注歌曲（少于 ${MIN_OCCURRENCES} 个意象，暂不进入测验）`);
  const ready = report.pendingSongs.filter((s) => s.hasLyrics);
  const noLyrics = report.pendingSongs.filter((s) => !s.hasLyrics);
  if (report.pendingSongs.length === 0) console.log("  ✓ 没有");
  for (const s of ready) {
    console.log(`  ${String(s.occurrences).padStart(2)} 个  ${s.title}`);
  }
  if (noLyrics.length > 0) {
    console.log(
      `  另有 ${noLyrics.length} 首没有歌词，需先补歌词：${noLyrics.map((s) => s.title).join("、")}`,
    );
  }

  console.log(
    problems === 0 ? "\n结构检查通过" : `\n发现 ${problems} 处结构性漂移`,
  );
  if (strict && problems > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
