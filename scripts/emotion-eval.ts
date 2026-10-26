/* eslint-disable no-console */
/**
 * 歌曲基调 AI 预标的评测：对已人工标过基调的歌逐首请模型标一遍，与人工结果对比。
 * 每首歌调用一次模型，会产生费用。
 *
 * 用法：pnpm emotion:eval [--limit N]
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

async function main() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_API;
  if (!url || !key) throw new Error("缺少 SUPABASE_URL / SUPABASE_SECRET_API");
  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const limitArg = process.argv.indexOf("--limit");
  const limit = limitArg > 0 ? Number(process.argv[limitArg + 1]) : Infinity;

  const [emotionsRes, labelsRes] = await Promise.all([
    supabase.from("emotions").select("*").order("sort"),
    supabase
      .from("song_emotions")
      .select("song_id,emotion_id,rank")
      .order("rank"),
  ]);
  if (emotionsRes.error) throw emotionsRes.error;
  if (labelsRes.error) throw labelsRes.error;
  const emotions = emotionsRes.data as Emotion[];
  const nameOf = new Map(emotions.map((e) => [e.id, e.name]));
  const human = new Map<number, number[]>();
  for (const r of labelsRes.data as { song_id: number; emotion_id: number }[]) {
    human.set(r.song_id, [...(human.get(r.song_id) ?? []), r.emotion_id]);
  }
  const songIds = [...human.keys()].slice(0, limit);
  const songsRes = await supabase
    .from("music")
    .select("id,title,lyrics")
    .in("id", songIds);
  if (songsRes.error) throw songsRes.error;
  const songs = songsRes.data as {
    id: number;
    title: string;
    lyrics: string | null;
  }[];

  const system = buildEmotionSystemPrompt(emotions);
  const schema = emotionOutputSchema(emotions);
  const results: Array<{
    title: string;
    human: number[];
    ai: number[] | null;
    reason: string;
  }> = [];
  const queue = [...songs];
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
          const s = parseEmotionOutput(raw, emotions);
          results.push({
            title: song.title,
            human: human.get(song.id) ?? [],
            ai: s.emotionIds,
            reason: s.reason,
          });
        } catch (e) {
          results.push({
            title: song.title,
            human: human.get(song.id) ?? [],
            ai: null,
            reason: (e as Error).message,
          });
        }
      }
    }),
  );

  const names = (ids: number[]) => ids.map((id) => nameOf.get(id)).join("、");
  let mainHit = 0;
  let mainInHuman = 0;
  let jaccard = 0;
  const done = results.filter((r) => r.ai);
  for (const r of results) {
    const ai = r.ai ?? [];
    const sameMain = ai[0] === r.human[0];
    if (sameMain) mainHit++;
    if (r.human.includes(ai[0])) mainInHuman++;
    const union = new Set([...ai, ...r.human]).size;
    const inter = ai.filter((id) => r.human.includes(id)).length;
    if (r.ai) jaccard += union ? inter / union : 0;
    const mark = !r.ai ? "✗" : sameMain ? "✓" : "·";
    console.log(
      `${mark} 《${r.title}》 人工：${names(r.human)} ｜ AI：${r.ai ? names(r.ai) : "失败"} ｜ ${r.reason}`,
    );
  }
  const pct = (n: number) => `${Math.round((n / (done.length || 1)) * 100)}%`;
  console.log(
    `\n${done.length}/${results.length} 首成功；主基调一致 ${pct(mainHit)}；AI 主基调在人工标注里 ${pct(mainInHuman)}；平均重合度 ${pct(jaccard)}`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
