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
  decodeResultSlug,
  DIMENSIONS,
  encodeAnswers,
  encodeResultSlug,
  evaluate,
  getDimension,
  isDimensionKey,
  isRecordId,
  POOL_VERSION,
  QUESTIONS,
  QUIZ_VERSION,
  rowToSnapshot,
  SIGNATURE_IMAGERY,
  snapshotToRow,
  toSnapshot,
  type Answers,
  type DimensionKey,
  type MatchReason,
  type PoolRows,
  type PoolSong,
  type QuizModel,
  type QuizSnapshot,
  type QuizSnapshotRow,
} from "@/lib/quiz";
import type {
  QuizQuestionView,
  QuizRecordSummary,
  QuizResultGlyphs,
  QuizResultView,
} from "@/lib/quiz/views";
import type { Song } from "@/lib/types";
import { processLyrics } from "@/lib/utils/utils-lyrics";
import { toTraditional } from "@/lib/utils/utils-convert";
import { applyCreditAliases } from "@/lib/utils/utils-credits";
import { getCreditAliases } from "@/lib/server/service-credit-aliases";
import { getSongsByIds } from "@/lib/server/service-songs";
import type { SupabaseClient } from "@supabase/supabase-js";

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
 * 结果页按链接动态渲染，每次都从全库标注建候选池太浪费，
 * 建好的候选池跨请求缓存，6 小时刷新，与全站 ISR 周期一致。
 */
const loadQuizPool = unstable_cache(
  async (): Promise<PoolSong[]> => {
    // 失败时一律抛错而不返回空数组：unstable_cache 不缓存异常，
    // 否则一次查询失败会让残缺的候选池被缓存 6 小时
    const pool = buildPool(poolRows(await loadImageryIndex()));
    if (pool.length === 0) throw new Error("候选池为空");
    return pool;
  },
  [`quiz-pool-v${POOL_VERSION}`, IMAGERY_INDEX_TAG],
  { revalidate: 21600, tags: [IMAGERY_INDEX_TAG] },
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

const OPTION_COUNTS = QUESTIONS.map((q) => q.options.length);

/** 7 位乱码 → 作答；不合法时返回 null */
export function decodeQuizSlug(slug: string): Answers | null {
  return decodeResultSlug(slug, OPTION_COUNTS);
}

/**
 * 作答 → 快照（只有键名和数值）；候选池为空时返回 null。
 * 保存记录时也用它：客户端只交乱码，结果在服务端重算，不信任客户端
 */
export async function computeQuizResult(
  answers: Answers,
): Promise<QuizSnapshot | null> {
  const model = await getQuizModel();
  if (model.songs.length === 0) return null;
  return toSnapshot(evaluate(model, answers));
}

/**
 * 快照 → 结果页的视图：按 locale 翻译，补上歌曲信息和印证的歌词。
 * 歌曲信息先取候选池里的；保存后歌离开了候选池的，到曲库里查，曲库里也删了就略去。
 * 歌词按候选池里的标注挑，歌不在候选池里时不挑
 */
export async function renderQuizResult(
  snapshot: QuizSnapshot,
  meta: Pick<QuizResultView, "slug" | "savedAt">,
  locale: string,
): Promise<QuizResultView> {
  const ids = snapshot.matches.map((m) => m.songId);
  const model = await getQuizModel();
  const poolById = new Map(model.songs.map((s) => [s.id, s]));
  const missing = ids.filter((id) => !poolById.has(id));
  const [lyrics, aliases, fallback] = await Promise.all([
    getLyricsByIds(ids),
    getCreditAliases(),
    missing.length > 0 ? getSongsByIds(missing, locale) : [],
  ]);
  const fallbackById = new Map(fallback.map((s) => [s.id, s]));
  const tr = localizer(locale);
  const reasonLabel = (r: MatchReason) =>
    tr(r.kind === "dimension" ? getDimension(r.key).label : `「${r.name}」`);

  const viewOf = (id: number): Song | null => {
    const song = poolById.get(id);
    if (!song) return fallbackById.get(id) ?? null;
    const view = applyCreditAliases(toSong(song), aliases);
    return {
      ...view,
      title: tr(view.title),
      album: view.album ? tr(view.album) : null,
      artist: view.artist?.map(tr) ?? null,
    };
  };

  const personaDim = getDimension(snapshot.persona);
  const secondaryDim = snapshot.secondary
    ? getDimension(snapshot.secondary)
    : null;

  return {
    ...meta,
    persona: {
      motto: tr(personaDim.motto),
      label: tr(personaDim.label),
      description: tr(personaDim.description),
    },
    secondary: secondaryDim
      ? { motto: tr(secondaryDim.motto), label: tr(secondaryDim.label) }
      : null,
    profile: snapshot.profile.map((p) => ({
      key: p.key,
      label: tr(getDimension(p.key).label),
      z: p.z,
    })),
    imagery: snapshot.imagery.map(tr),
    matches: snapshot.matches.flatMap((m) => {
      const song = viewOf(m.songId);
      if (!song) return [];
      const poolSong = poolById.get(m.songId);
      return [
        {
          song,
          percent: m.percent,
          reasons: m.reasons.map(reasonLabel),
          lines: poolSong
            ? pickLines(poolSong, m.reasons, lyrics.get(m.songId), 2).map(tr)
            : [],
        },
      ];
    }),
  };
}

const RECORD_COLUMNS =
  "id,created_at,persona,secondary,profile,imagery,song_ids,percents,reasons";

/**
 * 按 id 读保存的记录。看记录的不一定是记录的主人，所以用服务端密钥读：
 * 表不对 anon 开放，否则整张表能被列出来
 */
async function getQuizRecord(
  id: string,
): Promise<{ snapshot: QuizSnapshot; createdAt: string } | null> {
  const supabase = getServiceClient();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from(TABLES.QUIZ_RESULTS)
    .select(RECORD_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error) {
    console.error("[getQuizRecord]", error);
    return null;
  }
  if (!data) return null;
  const snapshot = rowToSnapshot(data as QuizSnapshotRow);
  return snapshot ? { snapshot, createdAt: data.created_at as string } : null;
}

/**
 * 结果页链接里的乱码 → 结果。7 位是作答编码，按当前题目和曲库现算；
 * 10 位是保存的记录，按快照渲染。解不出、查不到或候选池为空时返回 null。
 * 元数据和页面各调一次，同一请求里只算一遍
 */
export const getQuizResult = cache(
  async (
    slug: string | undefined,
    locale: string,
  ): Promise<QuizResultView | null> => {
    if (!slug) return null;
    if (isRecordId(slug)) {
      const record = await getQuizRecord(slug);
      if (!record) return null;
      return renderQuizResult(
        record.snapshot,
        { slug, savedAt: record.createdAt },
        locale,
      );
    }
    const answers = decodeQuizSlug(slug);
    if (!answers) return null;
    const snapshot = await computeQuizResult(answers);
    if (!snapshot) return null;
    return renderQuizResult(
      snapshot,
      { slug: encodeResultSlug(answers, OPTION_COUNTS), savedAt: null },
      locale,
    );
  },
);

// ─── 保存的记录 ───────────────────────────────────────────────────────────────
//
// 以下都用用户会话的客户端，RLS 保证只碰得到自己的记录

/** 自己保存的记录，新的在前；主气韵认不出的旧记录略去 */
export async function listQuizRecords(
  supabase: SupabaseClient,
  userId: string,
  locale: string,
): Promise<QuizRecordSummary[]> {
  const { data, error } = await supabase
    .from(TABLES.QUIZ_RESULTS)
    .select("id,created_at,persona,secondary")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  const tr = localizer(locale);
  const brief = (key: DimensionKey) => {
    const dim = getDimension(key);
    return { motto: tr(dim.motto), label: tr(dim.label) };
  };
  return (data ?? []).flatMap((r) =>
    isDimensionKey(r.persona)
      ? [
          {
            id: r.id,
            savedAt: r.created_at,
            persona: brief(r.persona),
            secondary: isDimensionKey(r.secondary) ? brief(r.secondary) : null,
          },
        ]
      : [],
  );
}

/** 这份作答在当前题目版本下存过的那条记录的 id；没存过时为 null */
export async function findQuizRecord(
  supabase: SupabaseClient,
  userId: string,
  answers: Answers,
): Promise<string | null> {
  const { data, error } = await supabase
    .from(TABLES.QUIZ_RESULTS)
    .select("id")
    .eq("user_id", userId)
    .eq("quiz_version", QUIZ_VERSION)
    .eq("code", encodeAnswers(answers))
    .maybeSingle();
  if (error) throw error;
  return data?.id ?? null;
}

/**
 * 保存一份结果，返回记录的 id；候选池为空、算不出结果时返回 null。
 * 同一份作答在同一题目版本下已存过的，不再新建，返回原来那条。
 * 满 5 条时由数据库的触发器删掉最早的一条
 */
export async function saveQuizRecord(
  supabase: SupabaseClient,
  userId: string,
  answers: Answers,
): Promise<string | null> {
  const snapshot = await computeQuizResult(answers);
  if (!snapshot) return null;
  const { data, error } = await supabase
    .from(TABLES.QUIZ_RESULTS)
    .insert({
      user_id: userId,
      quiz_version: QUIZ_VERSION,
      code: encodeAnswers(answers),
      ...snapshotToRow(snapshot),
    })
    .select("id")
    .single();
  if (!error) return data.id;
  if (error.code === "23505") {
    const existing = await findQuizRecord(supabase, userId, answers);
    if (existing) return existing;
  }
  throw error;
}

/** 删除自己的一条记录；本就不存在时也算成功 */
export async function deleteQuizRecord(
  supabase: SupabaseClient,
  userId: string,
  id: string,
): Promise<void> {
  const { error } = await supabase
    .from(TABLES.QUIZ_RESULTS)
    .delete()
    .eq("user_id", userId)
    .eq("id", id);
  if (error) throw error;
}
