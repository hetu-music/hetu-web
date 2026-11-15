/* eslint-disable no-console */
/**
 * 意象标注一致性检查（规则见 IMAGERY.md）。只读。
 *
 * 用法：pnpm imagery:check [--strict]
 *   --strict  有需要处理的问题时以退出码 1 结束，供定时任务或 CI 使用
 *
 * 查的是每首歌的工作版本（有草稿用草稿），与后台看到的一致。
 * 时间标签不存、读时按歌词算，所以没有要修的标签；歌词里找不到的词只列出，
 * 要人决定删掉还是改标实际写的词。
 *
 * 需要 .env.local 中的 SUPABASE_URL / SUPABASE_SECRET_API。
 */
import { createClient } from "@supabase/supabase-js";
import {
  checkConsistency,
  type CheckOccurrence,
} from "../src/lib/imagery/consistency";
import type { MotifEntry } from "../src/lib/imagery/suggest";

const PAGE_SIZE = 1000;
const SAMPLE = 15;

async function main() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_API;
  if (!url || !key) throw new Error("缺少 SUPABASE_URL / SUPABASE_SECRET_API");
  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const strict = process.argv.includes("--strict");

  // 分页必须按固定顺序，否则翻页时可能漏行或重复
  async function fetchAll<T>(
    table: string,
    select: string,
    orderBy: string[],
  ): Promise<T[]> {
    const out: T[] = [];
    for (let from = 0; ; from += PAGE_SIZE) {
      let query = supabase.from(table).select(select);
      for (const column of orderBy) query = query.order(column);
      const { data, error } = await query.range(from, from + PAGE_SIZE - 1);
      if (error) throw error;
      out.push(...(data as T[]));
      if (data.length < PAGE_SIZE) return out;
    }
  }

  const [imagery, motifs, occurrences, songs] = await Promise.all([
    fetchAll<{ id: number; name: string }>("imagery", "id,name", ["id"]),
    fetchAll<MotifEntry>("imagery_motifs", "imagery_id,motif_id,role", [
      "imagery_id",
      "motif_id",
    ]),
    fetchAll<CheckOccurrence>(
      "working_song_imagery",
      "id,song_id,imagery_id,motif_id",
      ["song_id", "id"],
    ),
    fetchAll<{ id: number; title: string; lyrics: string | null }>(
      "working_songs",
      "id,title,lyrics",
      ["id"],
    ),
  ]);
  const title = new Map(songs.map((s) => [s.id, s.title]));
  const report = checkConsistency({ imagery, motifs, occurrences, songs });
  const list = <T>(items: T[], line: (item: T) => string) => {
    for (const item of items.slice(0, SAMPLE)) console.log(`  ${line(item)}`);
    if (items.length > SAMPLE) {
      console.log(`  ……另有 ${items.length - SAMPLE} 条`);
    }
  };

  console.log(
    `意象词 ${imagery.length} 个，标注 ${occurrences.length} 条，母题登记 ${motifs.length} 条`,
  );

  console.log(`\n没有默认母题的词：${report.noPrimary.length}`);
  list(report.noPrimary, (i) => i.name);
  console.log(`\n挂在登记之外母题上的标注：${report.offCandidate.length}`);
  list(report.offCandidate, (id) => `#${id}`);
  console.log(
    `\n歌词里找不到该词：${report.notFound.length} 条（删掉，或改标歌词里实际写的词）`,
  );
  list(
    report.notFound,
    (t) => `#${t.occurrenceId}《${title.get(t.songId)}》${t.name}`,
  );

  const problems =
    report.noPrimary.length +
    report.offCandidate.length +
    report.notFound.length;
  if (strict && problems > 0) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
