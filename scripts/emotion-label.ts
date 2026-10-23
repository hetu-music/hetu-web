/* eslint-disable no-console */
/**
 * 歌曲基调批量预标：给还没有基调、有歌词的歌请模型标一遍，来源记为 ai（待人确认）。
 * 已有基调的歌（不论人工还是 AI）一律不动。每首歌调用一次模型，会产生费用。
 *
 * 用法：pnpm emotion:label [--limit N] [--dry-run]
 *   --limit N   最多标 N 首
 *   --dry-run   只打印结果，不写库
 *
 * 需要 .env.local 中的 SUPABASE_URL / SUPABASE_SECRET_API / LLM_API_KEY / LLM_MODEL。
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

  const [emotionsRes, labelsRes] = await Promise.all([
    supabase.from("emotions").select("*").order("sort"),
    supabase.from("song_emotions").select("song_id"),
  ]);
  if (emotionsRes.error) throw emotionsRes.error;
  if (labelsRes.error) throw labelsRes.error;
  const emotions = emotionsRes.data as Emotion[];
  const nameOf = new Map(emotions.map((e) => [e.id, e.name]));
  const labeled = new Set(
    (labelsRes.data as { song_id: number }[]).map((r) => r.song_id),
  );

  const songs: { id: number; title: string; lyrics: string | null }[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("music")
      .select("id,title,lyrics")
      .order("id")
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    songs.push(...(data as typeof songs));
    if (data.length < PAGE_SIZE) break;
  }
  const todo = songs
    .filter((s) => !labeled.has(s.id) && s.lyrics?.trim())
    .slice(0, limit);
  console.log(
    `曲库 ${songs.length} 首，已有基调 ${labeled.size} 首，本次预标 ${todo.length} 首${dryRun ? "（不写库）" : ""}`,
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
          const { error } = await supabase.from("song_emotions").insert(
            emotionIds.map((emotion_id, i) => ({
              song_id: song.id,
              emotion_id,
              rank: i + 1,
              source: "ai",
            })),
          );
          // 并发期间有人在后台标了这首歌：主键或 rank 冲突，留人工的
          if (error?.code === "23505") {
            console.log(`  已有人工基调，跳过《${song.title}》`);
            continue;
          }
          if (error) throw error;
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
