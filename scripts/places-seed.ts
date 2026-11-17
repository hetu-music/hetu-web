/* eslint-disable no-console */
/**
 * 生成河图志的初始数据迁移（supabase/migrations/20261119120100_places_seed.sql）。
 * 地点取原型 src/components/lab/map/data.ts 的 45 处（id 按其次序），歌与引句取用户投稿的打卡表 map.csv（gitignored），
 * 引句按线上歌词、用详情页的切句方式定位到句。只读数据库，输出 SQL 文件。
 *
 * 迁移上线前若这些歌的歌词改过，迁移的核对会失败，用这个脚本重新生成即可。迁移上线后脚本就没用了，可以删掉。
 *
 * 用法：pnpm exec tsx --env-file=.env.local scripts/places-seed.ts map.csv supabase/migrations/20261119120100_places_seed.sql
 * 需要 .env.local 中的 SUPABASE_URL / SUPABASE_SECRET_API。
 */
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import { STOPS } from "../src/components/lab/map/data";
import { toQuote } from "../src/lib/utils/utils-comments";
import { buildFolio } from "../src/lib/utils/utils-folio";

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

const norm = (s: string) => s.replace(/[^\p{Script=Han}\p{L}\p{N}]/gu, "");
const lit = (v: string | number | null) =>
  v === null
    ? "null"
    : typeof v === "number"
      ? String(v)
      : `'${v.replace(/'/g, "''")}'`;

/** 打卡表里抄错的引句，按线上歌词改正 */
const QUOTE_FIX: Record<string, string> = {
  "我开始疯狂想念，故事里的长安。": "我忽然开始疯狂想念，故事里的长安。",
  "而今山下人如海，学富五车通二酉天下来。":
    "而今山下人如海，学富五车书通二酉天下来。",
  "剑锋所指旌旗漫卷黄沙，八千里征鞍碾过胡杨枝桠。":
    "剑锋所指旌旗漫卷狂沙，八千里征鞍碾过胡杨枝桠。",
  "岳麓巍巍，摘星作烟台，湘江泼墨化云霭。":
    "岳麓巍巍，摘星作砚台，湘江泼墨化云霭。",
};
/** 演出场馆：不引歌词 */
const VENUES = new Set(["niaochao"]);
/** 打卡表里的地点名与原型的短名、全称都对不上的 */
const PLACE_ALIAS: Record<string, string> = { 翁子洞: "wengzi" };

async function main() {
  const [csvPath, outPath] = process.argv.slice(2);
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_API;
  if (!url || !key) throw new Error("缺少 SUPABASE_URL / SUPABASE_SECRET_API");
  if (!csvPath || !outPath) throw new Error("用法见文件开头");
  const db = createClient(url, key, { auth: { persistSession: false } });
  const { data: songs, error } = await db
    .from("published_songs")
    .select("id, title, lyrics, lyrics_start");
  if (error) throw error;
  const songByTitle = new Map(
    (songs ?? []).map((s) => [norm(s.title ?? ""), s]),
  );

  const placeId = new Map(STOPS.map((s, i) => [s.id, i + 1]));
  const rows = parseCsv(fs.readFileSync(csvPath, "utf8").replace(/^\uFEFF/, ""))
    .slice(2)
    .filter((r) => r[4]);

  type Seed = {
    songId: number;
    title: string;
    place: number;
    relation: "setting" | "venue";
    index: number | null;
    time: number | null;
    quote: string | null;
    note: string | null;
  };
  const seeds: Seed[] = [];
  const problems: string[] = [];

  for (const [, , , csvPlace, title, quoteCell] of rows) {
    const stopsOfSong = STOPS.filter((s) =>
      s.entries.some((e) => e.song === title),
    );
    const stop =
      stopsOfSong.length === 1
        ? stopsOfSong[0]
        : stopsOfSong.find(
            (s) =>
              PLACE_ALIAS[csvPlace] === s.id ||
              s.name === csvPlace ||
              s.full === csvPlace ||
              (csvPlace && csvPlace.includes(s.name)),
          );
    if (!stop) {
      problems.push(`认不出地点：${csvPlace}｜${title}`);
      continue;
    }
    const song = songByTitle.get(norm(title));
    if (!song) {
      problems.push(`曲库里没有：${title}`);
      continue;
    }
    const note = stop.entries.find((e) => e.song === title)?.note ?? null;
    const place = placeId.get(stop.id);
    if (place === undefined) throw new Error(`原型里没有 ${stop.id}`);
    const base = { songId: song.id, title: song.title, place };

    if (VENUES.has(stop.id)) {
      seeds.push({
        ...base,
        relation: "venue",
        index: null,
        time: null,
        quote: null,
        note,
      });
      continue;
    }

    const lines = buildFolio(song.lyrics, {
      title: song.title,
      lyricsStart: song.lyrics_start,
    }).lines;
    const quotes = quoteCell
      .split(/\n/)
      .map((q) => q.replace(/[“”"]/g, "").trim())
      .filter(Boolean)
      .map((q) => QUOTE_FIX[q] ?? q);
    let first = true;
    for (const q of quotes) {
      const nq = norm(q);
      let hit: number[] | null = null;
      for (let i = 0; i < lines.length && !hit; i++) {
        let acc = "";
        for (let j = i; j < lines.length && j < i + 4; j++) {
          acc += norm(lines[j].text);
          if (acc.includes(nq)) {
            let start = i;
            while (
              start < j &&
              norm(
                lines
                  .slice(start + 1, j + 1)
                  .map((l) => l.text)
                  .join(""),
              ).includes(nq)
            )
              start++;
            hit = Array.from({ length: j - start + 1 }, (_, k) => start + k);
            break;
          }
        }
      }
      if (!hit) {
        problems.push(`引句找不到：${title}｜${q}`);
        continue;
      }
      for (const i of hit) {
        const quote = toQuote(lines[i].text);
        if (!(song.lyrics ?? "").includes(quote))
          problems.push(`引文不在歌词原文里：${title}｜${quote}`);
        if (
          seeds.some(
            (s) =>
              s.songId === song.id &&
              s.place === base.place &&
              s.quote === quote,
          )
        )
          continue;
        seeds.push({
          ...base,
          relation: "setting",
          index: i,
          time:
            lines[i].time === null
              ? null
              : Math.round(lines[i].time * 1000) / 1000,
          quote,
          // 备注只记在这一处的第一句上
          note: first ? note : null,
        });
        first = false;
      }
    }
  }

  if (problems.length) {
    console.error(problems.join("\n"));
    process.exit(1);
  }

  const placesSql = STOPS.map(
    (s, i) =>
      `  (${i + 1}, ${lit(s.name)}, ${lit(s.full ?? null)}, ${lit(s.region)})`,
  ).join(",\n");
  const seedSql = seeds
    .map(
      (s, i) =>
        `  (${i + 1}, ${s.songId}, ${lit(s.title)}, ${s.place}, ${lit(s.relation)}, ${lit(s.index)}, ${lit(s.time)}, ${lit(s.quote)}, ${lit(s.note)})`,
    )
    .join(",\n");

  const sql = `-- 河图志：迁入用户投稿的打卡表（见 docs/PLACES.md 第六节）
--
-- 打卡表由「正版雨清」整理，共 46 行。地点的短名、全称与地区按原型（/lab/map）核对过，合并成 ${STOPS.length} 处；
-- 引句按线上歌词定位到句（详情页切出的句子），抄错的几处按歌词改正；鸟巢是演出场馆，不引歌词。
-- 本文件由 scripts/places-seed.ts 生成，生成时与线上歌词逐句核对过；歌词改过就重新生成。
--
-- 地点照常写入。歌与地点的对应写进每首歌的线上版本，有草稿的同时写进草稿（id 相同），
-- 否则草稿一发布就把这些行丢了。这张表是新建的，写进已发布的版本等于补数据，
-- 这里临时关掉守卫与审计触发器，写完打开（同 20261116120000_motifs.sql）。
-- 曲库是空的（CI 在空库上重放）时只建地点；不空时逐首核对歌名与引文，对不上就整体回滚。

insert into public.places (id, name, full_name, region) overriding system value values
${placesSql};

select setval(pg_get_serial_sequence('public.places', 'id'), (select max(id) from public.places));

create temp table places_seed (
  id bigint, song_id bigint, title text, place_id bigint, relation text,
  anchor_index integer, anchor_time numeric, anchor_quote text, note text
) on commit drop;

insert into places_seed values
${seedSql};

do $$
declare
  bad text;
begin
  if not exists (select 1 from public.songs) then
    return;
  end if;

  select string_agg(format('%s《%s》', p.song_id, p.title), '、') into bad
  from (select distinct song_id, title from places_seed) p
  left join public.published_songs s on s.id = p.song_id and s.title = p.title
  where s.id is null;
  if bad is not null then
    raise exception '这些歌不在线上或歌名对不上：%', bad;
  end if;

  select string_agg(format('《%s》%s', p.title, p.anchor_quote), '、') into bad
  from places_seed p
  join public.published_songs s on s.id = p.song_id
  where p.anchor_quote is not null and position(p.anchor_quote in s.lyrics) = 0;
  if bad is not null then
    raise exception '这些引文在线上歌词里找不到：%', bad;
  end if;
end $$;

alter table public.song_places disable trigger song_places_guard;
alter table public.song_places disable trigger song_places_audit;

insert into public.song_places (
  version_id, id, place_id, relation, anchor_index, anchor_time, anchor_quote, note, created_by
) overriding system value
select v.id, p.id, p.place_id, p.relation, p.anchor_index, p.anchor_time, p.anchor_quote, p.note, null
from places_seed p
join public.songs s on s.id = p.song_id
join public.song_versions v
  on v.song_id = s.id and (v.id = s.live_version_id or v.published_at is null);

alter table public.song_places enable trigger song_places_guard;
alter table public.song_places enable trigger song_places_audit;

select setval(pg_get_serial_sequence('public.song_places', 'id'), (select count(*) from places_seed));

do $$
declare
  n bigint;
begin
  if not exists (select 1 from public.songs) then
    return;
  end if;
  select count(*) into n from public.published_song_places;
  if n <> (select count(*) from places_seed) then
    raise exception '线上版本写进 % 行，应为 % 行', n, (select count(*) from places_seed);
  end if;
end $$;
`;
  fs.writeFileSync(outPath, sql);
  console.log(
    `${STOPS.length} 处地点，${seeds.length} 行对应（${new Set(seeds.map((s) => s.songId)).size} 首，演出 ${seeds.filter((s) => s.relation === "venue").length} 行）`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
