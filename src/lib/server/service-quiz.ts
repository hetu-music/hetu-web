import { cache } from "react";
import { unstable_cache } from "next/cache";
import { getServiceClient, TABLES } from "@/lib/db/supabase-server";
import { IMAGERY_INDEX_TAG } from "@/lib/imagery/tags";
import {
  loadImageryIndex,
  type ImageryIndex,
} from "@/lib/server/imagery-index";
import {
  buildModel,
  buildPool,
  decodeAnswers,
  DIMENSIONS,
  encodeAnswers,
  evaluate,
  getDimension,
  POOL_VERSION,
  QUESTIONS,
  SIGNATURE_IMAGERY,
  type MatchReason,
  type PoolRows,
  type PoolSong,
  type QuizModel,
} from "@/lib/quiz";
import type {
  QuizQuestionView,
  QuizResultGlyphs,
  QuizResultView,
} from "@/lib/quiz/views";
import type { Song } from "@/lib/types";
import { processLyrics } from "@/lib/utils/utils-lyrics";
import { toTraditional } from "@/lib/utils/utils-convert";
import { applyCreditAliases } from "@/lib/utils/utils-credits";
import { getCreditAliases } from "@/lib/server/service-credit-aliases";

// ─── 候选池 ───────────────────────────────────────────────────────────────────

/** 共用的意象索引转成候选池要的原始行：标注只留曲库里的歌，基调连上明暗与扬抑 */
function poolRows(index: ImageryIndex): PoolRows {
  const catalog = new Set(index.songs.map((s) => s.id));
  const emotionById = new Map(index.emotions.map((e) => [e.id, e]));
  return {
    categories: index.categories,
    imagery: index.imagery,
    occurrences: index.occurrences.filter((o) => catalog.has(o.song_id)),
    songs: index.songs,
    songEmotions: index.songEmotions.map((r) => {
      const e = emotionById.get(r.emotion_id);
      return {
        song_id: r.song_id,
        rank: r.rank,
        emotions: e ? { tone: e.tone, energy: e.energy } : null,
      };
    }),
  };
}

/**
 * 结果页按 ?a= 动态渲染，每次都从全库标注建候选池太浪费，
 * 建好的候选池跨请求缓存，2 小时刷新，与意象页 ISR 周期一致。
 */
const loadQuizPool = unstable_cache(
  async (): Promise<PoolSong[]> => {
    // 失败时一律抛错而不返回空数组：unstable_cache 不缓存异常，
    // 否则一次查询失败会让残缺的候选池被缓存 2 小时
    const pool = buildPool(poolRows(await loadImageryIndex()));
    if (pool.length === 0) throw new Error("候选池为空");
    return pool;
  },
  [`quiz-pool-v${POOL_VERSION}`, IMAGERY_INDEX_TAG],
  { revalidate: 7200, tags: [IMAGERY_INDEX_TAG] },
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

/**
 * 结果页上随结果变化、但不随曲库变化的字，按所用字体分好：气韵（各维度的题词、名称、描述）
 * 与招牌意象都出自固定的几套。答题页拿去预载字体分片，进结果页就不会再跳字
 */
export function getQuizResultGlyphs(locale: string): QuizResultGlyphs {
  const tr = localizer(locale);
  const imagery = SIGNATURE_IMAGERY.map((s) => tr(s.name)).join("");
  return {
    // 主题词作标题，招牌意象单列
    calligraphy: DIMENSIONS.map((d) => tr(d.motto)).join("") + imagery,
    // 「兼有 · 题词」、倾向的维度名、契合理由（维度名或「意象」）
    serif:
      DIMENSIONS.map((d) => tr(d.motto) + tr(d.label)).join("") +
      imagery +
      "「」",
    kaiti: DIMENSIONS.map((d) => tr(d.description)).join(""),
  };
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
        : o.signature === reason.name;
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
  const [lyrics, aliases] = await Promise.all([
    getLyricsByIds(result.matches.map((m) => m.songId)),
    getCreditAliases(),
  ]);
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
      const view = applyCreditAliases(toSong(song), aliases);
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
