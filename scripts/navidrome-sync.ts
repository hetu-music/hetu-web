/* eslint-disable no-console */
/**
 * Navidrome 映射同步：拉取 Navidrome 全部曲目，按元数据与 music 表自动配对，
 * 重建 navid_song 映射并同步 music.has_audio。默认只预览，不写数据库。
 *
 * 用法：pnpm navidrome:sync [--apply]
 *   --apply  执行计划：写入新映射、删除失效映射、更新 has_audio，并刷新页面缓存
 *
 * 需要环境变量：SUPABASE_URL / SUPABASE_SECRET_API，
 *   NAVIDROME_URL / NAVIDROME_USER / NAVIDROME_PASSWORD（用于读取曲库的账号）
 * 可选：NEXT_PUBLIC_SITE_URL + REVALIDATE_SECRET（has_audio 变化后刷新页面缓存）
 *
 * 需要人工确认的歌曲：在 navid_song 里手工写入正确的 navid_id 即可，
 * 之后的同步会保留仍然有效的现有映射，不会覆盖。
 */
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";
import {
  planSync,
  type DbSong,
  type MappingRow,
  type NavSong,
} from "../src/lib/navidrome/sync";

const PAGE_SIZE = 1000;
const NAV_PAGE_SIZE = 500;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`缺少环境变量 ${name}`);
  return value;
}

async function fetchNavidromeSongs(): Promise<NavSong[]> {
  const base = requireEnv("NAVIDROME_URL").replace(/\/$/, "");
  const user = requireEnv("NAVIDROME_USER");
  const password = requireEnv("NAVIDROME_PASSWORD");

  const songs: NavSong[] = [];
  for (let offset = 0; ; offset += NAV_PAGE_SIZE) {
    const salt = crypto.randomBytes(8).toString("hex");
    const params = new URLSearchParams({
      u: user,
      t: crypto
        .createHash("md5")
        .update(password + salt)
        .digest("hex"),
      s: salt,
      v: "1.16.1",
      c: "hetu-web-sync",
      f: "json",
      // Navidrome 对空查询返回全部曲目，用于全量同步
      query: "",
      artistCount: "0",
      albumCount: "0",
      songCount: String(NAV_PAGE_SIZE),
      songOffset: String(offset),
    });
    const res = await fetch(`${base}/rest/search3?${params}`, {
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) throw new Error(`Navidrome 请求失败：HTTP ${res.status}`);
    const body = (await res.json())["subsonic-response"];
    if (body?.status !== "ok") {
      throw new Error(`Navidrome 返回错误：${JSON.stringify(body?.error)}`);
    }
    const page: NavSong[] = body.searchResult3?.song ?? [];
    songs.push(...page);
    if (page.length < NAV_PAGE_SIZE) return songs;
  }
}

function describeSong(s: DbSong): string {
  return `#${s.id} ${s.title}（${s.album ?? "无专辑"} ${s.discnumber ?? 1}-${s.track ?? "?"}，${s.length ?? "?"}s）`;
}

function describeNav(n: NavSong): string {
  return `${n.id} ${n.title}（${n.album ?? "无专辑"} ${n.discNumber ?? 1}-${n.track ?? "?"}，${n.duration ?? "?"}s）${n.path ? ` ${n.path}` : ""}`;
}

async function revalidateSite() {
  const site = process.env.NEXT_PUBLIC_SITE_URL;
  const secret = process.env.REVALIDATE_SECRET;
  if (!site || !secret) {
    console.log(
      "  ! 未配置 NEXT_PUBLIC_SITE_URL / REVALIDATE_SECRET，跳过缓存刷新",
    );
    return;
  }
  const base = `${site.replace(/\/$/, "")}/api/public/revalidate`;
  const headers = { "x-revalidate-secret": secret };
  for (const [method, url] of [
    ["POST", base],
    ["GET", `${base}?id=all`],
  ] as const) {
    try {
      const res = await fetch(url, { method, headers });
      console.log(`  ${res.ok ? "✓" : "✗"} ${method} ${url} → ${res.status}`);
    } catch (error) {
      console.log(`  ✗ ${method} ${url} → ${(error as Error).message}`);
    }
  }
}

async function main() {
  const apply = process.argv.includes("--apply");
  const supabase = createClient(
    requireEnv("SUPABASE_URL"),
    requireEnv("SUPABASE_SECRET_API"),
    { auth: { persistSession: false } },
  );

  async function fetchAll<T>(table: string, select: string): Promise<T[]> {
    const out: T[] = [];
    for (let from = 0; ; from += PAGE_SIZE) {
      const { data, error } = await supabase
        .from(table)
        .select(select)
        .order("id")
        .range(from, from + PAGE_SIZE - 1);
      if (error) throw error;
      out.push(...(data as T[]));
      if (data.length < PAGE_SIZE) return out;
    }
  }

  const [navSongs, songs, existing] = await Promise.all([
    fetchNavidromeSongs(),
    fetchAll<DbSong>(
      "music",
      "id,title,album,discnumber,track,length,has_audio",
    ),
    fetchAll<MappingRow>("navid_song", "id,navid_id"),
  ]);
  // 曲库为空多半是账号或库配置有误；此时执行会把所有映射当作失效删掉
  if (navSongs.length === 0) {
    throw new Error("Navidrome 返回的曲目为空，已中止");
  }

  const plan = planSync(songs, navSongs, existing);
  const section = (title: string) => console.log(`\n■ ${title}`);

  console.log(
    `Navidrome 曲目 ${navSongs.length}，歌曲 ${songs.length}，现有映射 ${existing.length}`,
  );

  section(`保持不变 ${plan.unchanged}`);

  section(`新增/替换映射 ${plan.upserts.length}`);
  for (const u of plan.upserts) {
    console.log(
      `  ${describeSong(u.song)} → ${u.nav.id}${u.previous ? `（原 ${u.previous}）` : ""}`,
    );
  }

  section(`删除失效映射 ${plan.deletes.length}`);
  for (const d of plan.deletes) console.log(`  #${d.id} ${d.navid_id}`);

  section(`需人工确认 ${plan.review.length}`);
  for (const r of plan.review) {
    console.log(`  ${describeSong(r.song)} —— ${r.reason}`);
    for (const c of r.candidates) console.log(`      候选 ${describeNav(c)}`);
  }

  section(`has_audio 变化 ${plan.hasAudioChanges.length}`);
  for (const c of plan.hasAudioChanges) {
    console.log(`  ${describeSong(c.song)} → ${c.next}`);
  }

  section(`Navidrome 中找不到的歌曲 ${plan.missing.length}`);
  for (const s of plan.missing) console.log(`  ${describeSong(s)}`);

  section(`未被使用的 Navidrome 曲目 ${plan.unusedNav.length}`);
  for (const n of plan.unusedNav) console.log(`  ${describeNav(n)}`);

  if (!apply) {
    console.log("\n预览模式，未写入。确认无误后加 --apply 执行。");
    return;
  }

  section("执行");
  if (plan.upserts.length > 0) {
    const { error } = await supabase.from("navid_song").upsert(
      plan.upserts.map((u) => ({ id: u.song.id, navid_id: u.nav.id })),
      { onConflict: "id" },
    );
    if (error) throw error;
    console.log(`  ✓ 写入映射 ${plan.upserts.length}`);
  }
  if (plan.deletes.length > 0) {
    const { error } = await supabase
      .from("navid_song")
      .delete()
      .in(
        "id",
        plan.deletes.map((d) => d.id),
      );
    if (error) throw error;
    console.log(`  ✓ 删除映射 ${plan.deletes.length}`);
  }
  for (const next of [true, false]) {
    const ids = plan.hasAudioChanges
      .filter((c) => c.next === next)
      .map((c) => c.song.id);
    if (ids.length === 0) continue;
    const { error } = await supabase
      .from("music")
      .update({ has_audio: next })
      .in("id", ids);
    if (error) throw error;
    console.log(`  ✓ has_audio → ${next}：${ids.length}`);
  }
  if (plan.hasAudioChanges.length > 0) await revalidateSite();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
