import { cache } from "react";
import { unstable_cache } from "next/cache";
import { getServiceClient, fetchAll, TABLES } from "@/lib/db/supabase-server";
import {
  buildModel,
  buildPool,
  decodeAnswers,
  encodeAnswers,
  evaluate,
  getDimension,
  IMAGERY_ALIAS,
  POOL_VERSION,
  QUESTIONS,
  type MatchReason,
  type PoolRows,
  type PoolSong,
  type QuizModel,
} from "@/lib/quiz";
import type { QuizQuestionView, QuizResultView } from "@/lib/quiz/views";
import type { Song } from "@/lib/types";
import { processLyrics } from "@/lib/utils/utils-lyrics";
import { toTraditional } from "@/lib/utils/utils-convert";

// ─── 候选池 ───────────────────────────────────────────────────────────────────

/**
 * 候选池依赖意象标注全表（数千行），结果页又是按 ?a= 动态渲染的，
 * 因此用 unstable_cache 跨请求缓存，2 小时刷新，与意象页 ISR 周期一致。
 */
const loadQuizPool = unstable_cache(
  async (): Promise<PoolSong[]> => {
    const supabase = getServiceClient();
    if (!supabase) return [];
    const [categories, imagery, occurrences, songs] = await Promise.all([
      fetchAll<PoolRows["categories"][number]>(
        supabase,
        TABLES.IMAGERY_CAT,
        "id,name,parent_id,level",
      ),
      fetchAll<PoolRows["imagery"][number]>(
        supabase,
        TABLES.IMAGERY,
        "id,name",
      ),
      fetchAll<PoolRows["occurrences"][number]>(
        supabase,
        TABLES.IMAGERY_OCC,
        "song_id,category_id,imagery_id,lyric_timetag",
      ),
      fetchAll<PoolRows["songs"][number]>(
        supabase,
        TABLES.MUSIC,
        "id,title,artist,album,hascover,has_audio,type",
      ),
    ]);
    return buildPool({ categories, imagery, occurrences, songs });
  },
  [`quiz-pool-v${POOL_VERSION}`],
  { revalidate: 7200, tags: ["quiz-pool"] },
);

const getQuizModel = cache(async (): Promise<QuizModel> => {
  const pool = await loadQuizPool().catch((e) => {
    console.error("[getQuizModel] 加载候选池失败", e);
    return [];
  });
  return buildModel(pool, QUESTIONS);
});

export async function getQuizPoolSize(): Promise<number> {
  return (await getQuizModel()).songs.length;
}

// ─── 题目 ─────────────────────────────────────────────────────────────────────

export function getQuizQuestions(locale: string): QuizQuestionView[] {
  const tr = localizer(locale);
  return QUESTIONS.map((q) => ({
    title: tr(q.title),
    stem: tr(q.stem),
    options: q.options.map((o) => tr(o.text)),
  }));
}

// ─── 结果 ─────────────────────────────────────────────────────────────────────

function localizer(locale: string): (text: string) => string {
  return locale === "zh-TW"
    ? (text) => toTraditional(text) ?? text
    : (text) => text;
}

function timetagToSeconds(tag: string): number | null {
  const m = tag.trim().match(/^(\d{1,2}):(\d{2})(?:\.(\d{2,3}))?$/);
  if (!m) return null;
  const frac = m[3] ? Number(m[3]) / (m[3].length === 2 ? 100 : 1000) : 0;
  return Number(m[1]) * 60 + Number(m[2]) + frac;
}

async function getLyricsByIds(ids: number[]): Promise<Map<number, string>> {
  const supabase = getServiceClient();
  if (!supabase || ids.length === 0) return new Map();
  const { data, error } = await supabase
    .from(TABLES.MUSIC)
    .select("id,lyrics")
    .in("id", ids);
  if (error) {
    console.error("[getLyricsByIds]", error);
    return new Map();
  }
  return new Map(
    (data ?? [])
      .filter((r) => typeof r.lyrics === "string")
      .map((r) => [r.id as number, r.lyrics as string]),
  );
}

/** 按匹配理由的顺序，从歌词里找出含对应意象的句子 */
function pickLines(
  song: PoolSong,
  reasons: MatchReason[],
  lrc: string | undefined,
  limit: number,
): string[] {
  if (!lrc) return [];
  const lyricLines = processLyrics(lrc).lines;
  const lineAt = (tag: string | null) => {
    const t = tag ? timetagToSeconds(tag) : null;
    if (t === null) return null;
    return lyricLines.find((l) => Math.abs(l.time - t) < 0.05)?.text ?? null;
  };

  const picked: string[] = [];
  for (const reason of reasons) {
    const occ = song.occurrences.find((o) => {
      if (!o.timetag) return false;
      return reason.kind === "dimension"
        ? o.dim === reason.key
        : IMAGERY_ALIAS.get(o.imagery) === reason.name;
    });
    const text = lineAt(occ?.timetag ?? null);
    if (text && !picked.includes(text)) picked.push(text);
    if (picked.length >= limit) break;
  }
  return picked;
}

function toSong(song: PoolSong): Song {
  return {
    id: song.id,
    title: song.title,
    album: song.album,
    year: null,
    genre: null,
    lyricist: null,
    composer: null,
    artist: song.artist,
    length: null,
    hascover: song.hascover,
    updated_at: "",
    has_audio: song.hasAudio,
  };
}

/**
 * 根据作答短串计算结果；短串不合法或候选池为空时返回 null。
 */
export async function getQuizResult(
  code: string | undefined,
  locale: string,
): Promise<QuizResultView | null> {
  const answers = decodeAnswers(code, QUESTIONS);
  if (!answers) return null;
  const model = await getQuizModel();
  if (model.songs.length === 0) return null;

  const result = evaluate(model, answers);
  const songById = new Map(model.songs.map((s) => [s.id, s]));
  const lyrics = await getLyricsByIds(result.matches.map((m) => m.songId));
  const tr = localizer(locale);
  const reasonLabel = (r: MatchReason) =>
    tr(r.kind === "dimension" ? getDimension(r.key).label : `「${r.name}」`);

  const [first, second] = result.profile;
  const firstDim = getDimension(first.key);
  const secondDim = second && second.z > 0 ? getDimension(second.key) : null;

  return {
    code: encodeAnswers(answers),
    persona: {
      motto: tr(firstDim.motto),
      label: tr(firstDim.label),
      description: tr(firstDim.description),
    },
    secondary: secondDim
      ? { motto: tr(secondDim.motto), label: tr(secondDim.label) }
      : null,
    profile: result.profile.map((p) => ({
      key: p.key,
      label: tr(getDimension(p.key).label),
      z: Math.round(p.z * 100) / 100,
    })),
    imagery: result.imagery.map(tr),
    matches: result.matches.flatMap((m) => {
      const song = songById.get(m.songId);
      if (!song) return [];
      const view = toSong(song);
      return [
        {
          song: {
            ...view,
            title: tr(view.title),
            album: view.album ? tr(view.album) : null,
            artist: view.artist?.map(tr) ?? null,
          },
          percent: m.percent,
          reasons: m.reasons.map(reasonLabel),
          lines: pickLines(song, m.reasons, lyrics.get(song.id), 2).map(tr),
        },
      ];
    }),
  };
}
