/* eslint-disable no-console */
/**
 * 曲库搜索评测：拿线上曲库数据，对 src/lib/search/eval-cases.ts 里的每一条跑一遍搜索，
 * 按条目和类别报告是否通过。只读，不写数据库。见 docs/LIBRARY.md 阶段 0。
 *
 * 用法：pnpm search:eval [--verbose]
 *   --verbose  通过的条目也列出前几名
 *
 * 有任何一条不通过时以非零状态退出。评测要用线上曲库数据，所以不放进 vitest；
 * 改动 src/lib/search 之后跑一次。
 */
import { createClient } from "@supabase/supabase-js";
import { buildCorpus } from "../src/lib/search/corpus";
import { EVAL_CASES, type EvalCase } from "../src/lib/search/eval-cases";
import { searchSongs } from "../src/lib/search/rank";
import {
  SONG_LIST_VIEW_FIELDS,
  type Song,
  type SongDetail,
} from "../src/lib/types";
import {
  toTraditional,
  toTraditionalArray,
} from "../src/lib/utils/utils-convert";
import { applyCreditAliases } from "../src/lib/utils/utils-credits";
import { buildFolio } from "../src/lib/utils/utils-folio";
import { mapAndSortSongs } from "../src/lib/utils/utils-song";

type Locale = "zh-CN" | "zh-TW";

interface EvalData {
  /** 按页面字形转换过的歌曲列表，和线上首页拿到的一致 */
  songs: Record<Locale, Song[]>;
  /** 每首歌按句切好的简体歌词，和 lyrics-lines 接口（阶段 5）的切法一样 */
  lines: Map<number, string[]>;
}

// ─── 搜索 ─────────────────────────────────────────────────────────────────────

/** 为某种字形的页面准备好搜索函数：歌词数据已就绪，繁体页逐句转繁体 */
function prepareSearch(
  data: EvalData,
  locale: Locale,
): (query: string) => Song[] {
  const songs = data.songs[locale];
  const entries = [...data.lines].map(([id, lines]) => ({
    id,
    lines: locale === "zh-TW" ? lines.map((l) => toTraditional(l) ?? l) : lines,
  }));
  const corpus = buildCorpus(entries);
  return (query) =>
    searchSongs(songs, query, corpus)?.hits.map((h) => h.song) ?? songs;
}

// ─── 数据 ─────────────────────────────────────────────────────────────────────

/** 同 service-songs 的 toTraditionalSongList，只转搜索会用到的字段 */
function toTraditionalSongs(songs: Song[]): Song[] {
  return songs.map((s) => ({
    ...s,
    title: toTraditional(s.title) ?? s.title,
    album: toTraditional(s.album),
    artist: toTraditionalArray(s.artist),
    lyricist: toTraditionalArray(s.lyricist),
    composer: toTraditionalArray(s.composer),
    arranger: toTraditionalArray(s.arranger),
    creditAliases: toTraditionalArray(s.creditAliases) ?? undefined,
  }));
}

async function loadData(): Promise<EvalData> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_API;
  if (!url || !key) throw new Error("缺少 SUPABASE_URL / SUPABASE_SECRET_API");
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const rows: (SongDetail & { lyrics_start: string | null })[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("music")
      .select(`${SONG_LIST_VIEW_FIELDS.join(",")},lyrics,lyrics_start`)
      .order("id", { ascending: true })
      .range(from, from + 999);
    if (error) throw error;
    rows.push(...(data as unknown as typeof rows));
    if (data.length < 1000) break;
  }

  const { data: aliasRows, error } = await supabase
    .from("credit_aliases")
    .select("alias,name");
  if (error) throw error;
  const aliases = new Map(
    (aliasRows as { alias: string; name: string }[]).map((r) => [
      r.alias,
      r.name,
    ]),
  );

  const zhCN: Song[] = mapAndSortSongs(rows).map((s) =>
    applyCreditAliases(s, aliases),
  );
  // 按句切的办法同 lyrics-lines 接口：buildFolio 去掉署名区与说明行
  const lines = new Map<number, string[]>();
  for (const r of rows) {
    if (!r.lyrics) continue;
    const songLines = buildFolio(r.lyrics, {
      title: r.title,
      lyricsStart: r.lyrics_start ?? undefined,
    }).lines.map((l) => l.text);
    if (songLines.length > 0) lines.set(r.id, songLines);
  }

  return {
    songs: { "zh-CN": zhCN, "zh-TW": toTraditionalSongs(zhCN) },
    lines,
  };
}

// ─── 检查 ─────────────────────────────────────────────────────────────────────

const strip = (s: string) =>
  s.replace(/[\p{P}\p{S}\p{Z}\s]/gu, "").toLowerCase();

const NAME_FIELDS = ["artist", "lyricist", "composer", "arranger"] as const;

function namesOf(song: Song): string[] {
  return [
    ...NAME_FIELDS.flatMap((f) => song[f] ?? []),
    ...(song.creditAliases ?? []),
  ];
}

/** 题名、专辑、署名或歌词里字面含有搜索词（只去标点空格，不做简繁转换） */
function containsLiterally(
  song: Song,
  query: string,
  lyrics: Map<number, string>,
): boolean {
  const q = strip(query);
  const fields = [
    song.title,
    song.album ?? "",
    ...namesOf(song),
    lyrics.get(song.id) ?? "",
  ];
  return fields.some((f) => strip(f).includes(q));
}

interface CaseResult {
  pass: boolean;
  reasons: string[];
  results: Song[];
}

function check(
  c: EvalCase,
  results: Song[],
  lyrics: Map<number, string>,
): CaseResult {
  const reasons: string[] = [];
  const ids = results.map((s) => s.id);
  const k = c.k ?? 3;

  for (const id of c.top ?? []) {
    const rank = ids.indexOf(id);
    if (rank === -1 || rank >= k) {
      reasons.push(
        `#${id} ${rank === -1 ? "没搜到" : `排第 ${rank + 1}`}，应在前 ${k}`,
      );
    }
  }
  for (const id of c.includes ?? []) {
    if (!ids.includes(id)) reasons.push(`#${id} 没搜到`);
  }
  const credit = c.credit;
  if (credit) {
    const head = results.slice(0, k);
    if (head.length === 0) reasons.push("没有结果");
    const off = head.filter((s) => !namesOf(s).includes(credit));
    if (off.length > 0) {
      reasons.push(`前 ${k} 名里 ${off.length} 首没有署「${credit}」`);
    }
  }
  if (c.literal) {
    const off = results.filter((s) => !containsLiterally(s, c.query, lyrics));
    if (off.length > 0) {
      reasons.push(
        `${results.length} 条结果里 ${off.length} 条不含「${c.query}」`,
      );
    }
  }
  if (c.maxResults !== undefined && results.length > c.maxResults) {
    reasons.push(`${results.length} 条结果，最多应有 ${c.maxResults} 条`);
  }
  for (const id of c.absent ?? []) {
    if (ids.includes(id))
      reasons.push(`#${id} 不应出现（已知局限，若已解除请改评测集）`);
  }
  return { pass: reasons.length === 0, reasons, results };
}

// ─── 主流程 ───────────────────────────────────────────────────────────────────

async function main() {
  const verbose = process.argv.includes("--verbose");

  const data = await loadData();
  const lyricsById = new Map(
    [...data.lines].map(([id, lines]) => [id, lines.join(" ")]),
  );
  console.log(
    `曲库 ${data.songs["zh-CN"].length} 首，有歌词 ${data.lines.size} 首；评测 ${EVAL_CASES.length} 条\n`,
  );

  const search = {
    "zh-CN": prepareSearch(data, "zh-CN"),
    "zh-TW": prepareSearch(data, "zh-TW"),
  };
  const byKind = new Map<string, { pass: number; total: number }>();
  let passed = 0;

  for (const c of EVAL_CASES) {
    const r = check(c, search[c.locale ?? "zh-CN"](c.query), lyricsById);
    const tally = byKind.get(c.kind) ?? { pass: 0, total: 0 };
    tally.total += 1;
    if (r.pass) {
      tally.pass += 1;
      passed += 1;
    }
    byKind.set(c.kind, tally);

    if (!r.pass || verbose) {
      const where = c.locale === "zh-TW" ? "（繁体页）" : "";
      const head = r.results
        .slice(0, 5)
        .map((s) => `${s.title}#${s.id}`)
        .join("、");
      console.log(
        `${r.pass ? "✓" : "✗"} [${c.kind}] 「${c.query}」${where}  共 ${r.results.length} 条`,
      );
      for (const reason of r.reasons) console.log(`    ${reason}`);
      console.log(`    前几名：${head || "（无）"}`);
    }
  }

  console.log(`\n通过 ${passed}/${EVAL_CASES.length}`);
  for (const [kind, t] of byKind) {
    console.log(`  ${kind.padEnd(14)} ${t.pass}/${t.total}`);
  }
  if (passed < EVAL_CASES.length) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
