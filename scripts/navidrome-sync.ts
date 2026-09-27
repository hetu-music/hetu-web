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
import {
  fetchNavidromeLibrary,
  navidromeConfigFromEnv,
} from "../src/lib/navidrome/client";
import { applySyncPlan, loadSyncState } from "../src/lib/navidrome/store";
import { planSync, type DbSong, type NavSong } from "../src/lib/navidrome/sync";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`缺少环境变量 ${name}`);
  return value;
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

  const config = navidromeConfigFromEnv();
  if (!config) {
    throw new Error("缺少 NAVIDROME_URL / NAVIDROME_USER / NAVIDROME_PASSWORD");
  }

  const [navSongs, { songs, mappings: existing }] = await Promise.all([
    fetchNavidromeLibrary(config),
    loadSyncState(supabase),
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
  for (const s of plan.suspicious) {
    console.log(`  ! 时长不符 ${describeSong(s.song)} ↔ ${describeNav(s.nav)}`);
  }

  // 宽松匹配排在最前，方便核对
  const upserts = [...plan.upserts].sort(
    (a, b) => Number(b.loose) - Number(a.loose),
  );
  section(
    `新增/替换映射 ${upserts.length}（其中宽松匹配 ${upserts.filter((u) => u.loose).length}）`,
  );
  for (const u of upserts) {
    console.log(
      `  ${u.loose ? "≈ " : ""}${describeSong(u.song)} → ${u.loose ? describeNav(u.nav) : u.nav.id}${u.previous ? `（原 ${u.previous}）` : ""}`,
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
  const result = await applySyncPlan(supabase, plan);
  console.log(
    `  ✓ 写入映射 ${result.upserted}，删除映射 ${result.deleted}，has_audio 变化 ${result.hasAudioChanged.length}`,
  );
  if (plan.hasAudioChanges.length > 0) await revalidateSite();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
