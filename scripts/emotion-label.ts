/* eslint-disable no-console */
/**
 * 歌曲基调批量预标：给工作版本里还没有基调、有歌词的歌请模型标一遍。
 * 已有基调的歌一律不动。每首歌调用一次模型，会产生费用。
 *
 * 写入走后台接口 PUT /api/admin/song-emotions，与 agent 一样写在歌的草稿上，
 * 人在后台看过、发布后才上线（docs/DATABASE.md 原则 5）。不再直接写表。
 *
 * 用法：pnpm emotion:label [--limit N] [--dry-run]
 *   --limit N   最多标 N 首
 *   --dry-run   只打印结果，不写库
 *
 * 需要 .env.local 中的 SUPABASE_URL / SUPABASE_SECRET_API（读数据）、LLM_API_KEY / LLM_MODEL；
 * 写库另需 SITE_URL（如 https://hetu-music.com）与 ADMIN_ACCESS_TOKEN（后台账号的 JWT，
 * 通常用 bot 账号；令牌一小时过期，批量大时分几次跑）。
 */
import { createClient } from "@supabase/supabase-js";
import {
  buildEmotionPrompt,
  buildEmotionSystemPrompt,
  emotionOutputSchema,
  parseEmotionOutput,
} from "../src/lib/imagery/emotion-suggest";
import { chatJson } from "../src/lib/server/llm";
import type { Emotion } from "../src/lib/types";

const CONCURRENCY = 4;
const PAGE_SIZE = 1000;

async function main() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_API;
  if (!url || !key) throw new Error("缺少 SUPABASE_URL / SUPABASE_SECRET_API");
  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const dryRun = process.argv.includes("--dry-run");
  const limitArg = process.argv.indexOf("--limit");
  const limit = limitArg > 0 ? Number(process.argv[limitArg + 1]) : Infinity;

  const siteUrl = process.env.SITE_URL;
  const token = process.env.ADMIN_ACCESS_TOKEN;
  if (!dryRun && (!siteUrl || !token)) {
    throw new Error(
      "写库需要 SITE_URL 与 ADMIN_ACCESS_TOKEN；只看结果加 --dry-run",
    );
  }

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

  const [emotionsRes, songs, labels] = await Promise.all([
    supabase.from("emotions").select("*").order("sort"),
    fetchAll<{
      id: number;
      title: string;
      lyrics: string | null;
      version_id: number;
    }>("working_songs", "id,title,lyrics,version_id"),
    // 只要知道哪些版本已经有基调
    (async () => {
      const out: { version_id: number }[] = [];
      for (let from = 0; ; from += PAGE_SIZE) {
        const { data, error } = await supabase
          .from("song_emotions")
          .select("version_id")
          .order("version_id")
          .order("emotion_id")
          .range(from, from + PAGE_SIZE - 1);
        if (error) throw error;
        out.push(...(data as typeof out));
        if (data.length < PAGE_SIZE) return out;
      }
    })(),
  ]);
  if (emotionsRes.error) throw emotionsRes.error;
  const emotions = emotionsRes.data as Emotion[];
  const nameOf = new Map(emotions.map((e) => [e.id, e.name]));
  const labeled = new Set(labels.map((r) => r.version_id));

  const todo = songs
    .filter((s) => !labeled.has(s.version_id) && s.lyrics?.trim())
    .slice(0, limit);
  console.log(
    `共 ${songs.length} 首，工作版本已有基调 ${songs.length - songs.filter((s) => !labeled.has(s.version_id)).length} 首，本次预标 ${todo.length} 首${dryRun ? "（不写库）" : "（写进草稿）"}`,
  );

  const system = buildEmotionSystemPrompt(emotions);
  const schema = emotionOutputSchema(emotions);
  let written = 0;
  const failed: string[] = [];
  const queue = [...todo];
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      for (let song = queue.shift(); song; song = queue.shift()) {
        try {
          const raw = await chatJson({
            system,
            user: buildEmotionPrompt(song),
            schemaName: "song_emotions",
            schema,
          });
          const { emotionIds, reason } = parseEmotionOutput(raw, emotions);
          console.log(
            `《${song.title}》${emotionIds.map((id) => nameOf.get(id)).join("、")} ｜ ${reason}`,
          );
          if (dryRun) continue;
          const res = await fetch(`${siteUrl}/api/admin/song-emotions`, {
            method: "PUT",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ song_id: song.id, emotion_ids: emotionIds }),
          });
          if (!res.ok) {
            const body = (await res.json().catch(() => ({}))) as {
              error?: string;
            };
            throw new Error(`${res.status} ${body.error ?? res.statusText}`);
          }
          written++;
        } catch (e) {
          failed.push(`《${song.title}》${(e as Error).message}`);
        }
      }
    }),
  );

  console.log(`\n写入 ${written} 首，失败 ${failed.length} 首`);
  for (const f of failed) console.log(`  ${f}`);
  if (failed.length > 0) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
