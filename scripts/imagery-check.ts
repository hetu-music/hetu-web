/* eslint-disable no-console */
/**
 * 意象标注一致性检查（规则见 IMAGERY.md）。默认只读。
 *
 * 用法：pnpm imagery:check [--fix] [--strict]
 *   --fix     修复时间标签：改成词在歌词里字面出现的行（补漏标的、去掉多出的）。
 *             歌词里找不到该词的标注只报告不改，要人决定删掉还是改标实际写的词。
 *             只能改草稿里的；已发布的版本冻结了，发布时会按歌词自动重算
 *
 * 查的是每首歌的工作版本（有草稿用草稿），与后台看到的一致。
 *   --strict  有需要处理的问题时以退出码 1 结束，供定时任务或 CI 使用
 *
 * 需要 .env.local 中的 SUPABASE_URL / SUPABASE_SECRET_API。
 */
import { createClient } from "@supabase/supabase-js";
import {
  checkConsistency,
  type CheckOccurrence,
  type TimetagIssue,
} from "../src/lib/imagery/consistency";
import type { MotifEntry } from "../src/lib/imagery/suggest";

const PAGE_SIZE = 1000;
const SAMPLE = 15;
const FIX_CONCURRENCY = 20;

async function main() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_API;
  if (!url || !key) throw new Error("缺少 SUPABASE_URL / SUPABASE_SECRET_API");
  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const fix = process.argv.includes("--fix");
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
    fetchAll<MotifEntry>("imagery_motifs", "imagery_id,category_id,role", [
      "imagery_id",
      "category_id",
    ]),
    fetchAll<CheckOccurrence>(
      "working_song_imagery",
      "id,song_id,imagery_id,category_id,lyric_timetag",
      ["song_id", "id"],
    ),
    fetchAll<{
      id: number;
      title: string;
      lyrics: string | null;
      version_id: number;
      has_draft: boolean;
    }>("working_songs", "id,title,lyrics,version_id,has_draft", ["id"]),
  ]);
  const title = new Map(songs.map((s) => [s.id, s.title]));
  const draftOf = new Map(
    songs.filter((s) => s.has_draft).map((s) => [s.id, s.version_id]),
  );
  const report = checkConsistency({ imagery, motifs, occurrences, songs });
  const where = (t: TimetagIssue) =>
    `#${t.occurrenceId}《${title.get(t.songId)}》${t.name}`;
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
  console.log(`\n并列词缺的组成：${report.missingParts.length}`);
  list(
    report.missingParts,
    (p) =>
      `《${title.get(p.songId)}》意象 #${p.imageryId} 缺母题 #${p.categoryId}`,
  );

  const fixable = report.timetags.filter(
    (t) => !t.notFound && draftOf.has(t.songId),
  );
  const frozen = report.timetags.filter(
    (t) => !t.notFound && !draftOf.has(t.songId),
  );
  const notFound = report.timetags.filter((t) => t.notFound);

  console.log(
    `\n时间标签可修复：${fixable.length} 条（改成词在歌词里字面出现的行）`,
  );
  list(
    fixable,
    (t) => `${where(t)}：[${t.current.join(" ")}] → [${t.fixed.join(" ")}]`,
  );
  console.log(
    `\n时间标签不对、但在已发布的版本里：${frozen.length} 条（冻结了改不了；开草稿后发布即自动重算）`,
  );
  list(frozen, where);
  console.log(
    `\n歌词里找不到该词：${notFound.length} 条（删掉，或改标歌词里实际写的词）`,
  );
  list(notFound, where);

  if (fix && fixable.length > 0) {
    // 每条一次请求；整批重标后有上万条，串行要十几分钟，分组并发
    for (let i = 0; i < fixable.length; i += FIX_CONCURRENCY) {
      await Promise.all(
        fixable.slice(i, i + FIX_CONCURRENCY).map(async (t) => {
          const { error } = await supabase
            .from("song_imagery")
            .update({ lyric_timetag: t.fixed })
            .eq("version_id", draftOf.get(t.songId) as number)
            .eq("id", t.occurrenceId);
          if (error) throw error;
        }),
      );
    }
    console.log(`\n已修复 ${fixable.length} 条时间标签`);
  } else if (fixable.length > 0) {
    console.log("\n加 --fix 修复上面可修复的时间标签");
  }

  const problems =
    report.noPrimary.length +
    report.offCandidate.length +
    report.missingParts.length +
    notFound.length +
    (fix ? 0 : fixable.length);
  if (strict && problems > 0) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
