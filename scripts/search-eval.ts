/* eslint-disable no-console */
/**
 * 曲库搜索评测：拿线上曲库数据，对 src/lib/search/eval-cases.ts 里的每一条跑一遍搜索，
 * 按条目和类别报告是否通过。只读，不写数据库。见 docs/LIBRARY.md 阶段 0。
 *
 * 用法：pnpm search:eval [--engine old] [--verbose]
 *   --engine   要跑的方案，默认全部：old（线上的 Fuse 方案）、new（阶段 2 的搜索内核）
 *   --verbose  通过的条目也列出前几名
 *
 * 新方案有任何一条不通过时以非零状态退出。评测要用线上曲库数据，所以不放进 vitest；
 * 改动 src/lib/search 之后跑一次。
 */
import { createClient } from "@supabase/supabase-js";
import {
  buildFromEntries,
  searchAndFilterSongs,
} from "../src/lib/library/legacy-fuse";
import { FILTER_OPTION_ALL } from "../src/lib/constants";
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
import {
  mapAndSortSongs,
  processLyricsForSearch,
} from "../src/lib/utils/utils-song";

type Locale = "zh-CN" | "zh-TW";

/** 一首歌的原始歌词，新方案按句切分时用 */
interface RawLyrics {
  title: string;
  lyrics: string;
  lyricsStart: string | null;
}

interface EvalData {
  /** 按页面字形转换过的歌曲列表，和线上首页拿到的一致 */
  songs: Record<Locale, Song[]>;
  /** 旧方案用的歌词（原 lyrics-index 接口的格式，接口已删）：只有简体，不分页面字形 */
  lyricsIndex: { id: number; l: string }[];
  rawLyrics: Map<number, RawLyrics>;
}

interface SearchEngine {
  name: string;
  /** 为某种字形的页面准备好搜索函数 */
  prepare(data: EvalData, locale: Locale): (query: string) => Song[];
}

// ─── 方案 ─────────────────────────────────────────────────────────────────────

/** 线上方案：歌词索引已到达之后的 Fuse 搜索 */
const oldEngine: SearchEngine = {
  name: "old",
  prepare(data, locale) {
    const songs = data.songs[locale];
    const { fuse } = buildFromEntries(songs, data.lyricsIndex);
    return (query) =>
      searchAndFilterSongs(
        songs,
        query,
        FILTER_OPTION_ALL,
        FILTER_OPTION_ALL,
        [],
        [],
        [],
        [],
        [],
        fuse,
      ).songs;
  },
};

/**
 * 阶段 2 的搜索内核，歌词数据已就绪。句子按 lyrics-lines 接口（阶段 5）的办法切：
 * buildFolio 去掉署名区与说明行，繁体页逐句转繁体
 */
const newEngine: SearchEngine = {
  name: "new",
  prepare(data, locale) {
    const songs = data.songs[locale];
    const entries = [...data.rawLyrics].map(([id, raw]) => {
      const lines = buildFolio(raw.lyrics, {
        title: raw.title,
        lyricsStart: raw.lyricsStart ?? undefined,
      }).lines.map((l) => l.text);
      return {
        id,
        lines:
          locale === "zh-TW" ? lines.map((l) => toTraditional(l) ?? l) : lines,
      };
    });
    const corpus = buildCorpus(entries.filter((e) => e.lines.length > 0));
    return (query) =>
      searchSongs(songs, query, corpus)?.hits.map((h) => h.song) ?? songs;
  },
};

const ENGINES: SearchEngine[] = [oldEngine, newEngine];

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
  const rawLyrics = new Map<number, RawLyrics>();
  for (const r of rows) {
    if (r.lyrics) {
      rawLyrics.set(r.id, {
        title: r.title,
        lyrics: r.lyrics,
        lyricsStart: r.lyrics_start,
      });
    }
  }
  const lyricsIndex = rows
    .map((r) => ({ id: r.id, l: processLyricsForSearch(r.lyrics ?? null) }))
    .filter((e) => e.l.length > 0);

  return {
    songs: { "zh-CN": zhCN, "zh-TW": toTraditionalSongs(zhCN) },
    lyricsIndex,
    rawLyrics,
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
  const engineArg = process.argv.indexOf("--engine");
  const engines =
    engineArg === -1
      ? ENGINES
      : ENGINES.filter((e) => e.name === process.argv[engineArg + 1]);
  if (engines.length === 0) throw new Error("没有这个方案");

  const data = await loadData();
  const lyricsById = new Map(data.lyricsIndex.map((e) => [e.id, e.l]));
  console.log(
    `曲库 ${data.songs["zh-CN"].length} 首，有歌词 ${data.rawLyrics.size} 首；评测 ${EVAL_CASES.length} 条\n`,
  );

  let newFailed = false;
  for (const engine of engines) {
    const search = {
      "zh-CN": engine.prepare(data, "zh-CN"),
      "zh-TW": engine.prepare(data, "zh-TW"),
    };
    const byKind = new Map<string, { pass: number; total: number }>();
    let passed = 0;

    console.log(`══ 方案 ${engine.name} ══`);
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
    console.log("");
    if (engine.name === "new" && passed < EVAL_CASES.length) newFailed = true;
  }
  if (newFailed) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
