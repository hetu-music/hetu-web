import { DIMENSIONS } from "./dimensions";
import type {
  DimensionKey,
  DimensionScore,
  MatchReason,
  QuizResult,
} from "./types";

/**
 * 一次测验结果的快照：只有键名和数值，不含展示文案。
 * 未保存的结果每次打开时现算一份，保存的记录存的也是它（见 QUIZ-SIGNUP.md「存什么」）。
 */
export interface QuizSnapshot {
  /** 主气韵 */
  persona: DimensionKey;
  /** 兼有的气韵 */
  secondary: DimensionKey | null;
  /** 按 z 分数从高到低 */
  profile: DimensionScore[];
  /** 偏爱的意象 */
  imagery: string[];
  matches: Array<{ songId: number; percent: number; reasons: MatchReason[] }>;
}

/** 保存的记录在库里的样子（quiz_results 表除 id、user_id 等以外的列） */
export interface QuizSnapshotRow {
  persona: string;
  secondary: string | null;
  profile: unknown;
  imagery: string[];
  song_ids: number[];
  percents: number[];
  reasons: unknown;
}

type StoredReason = { dim: string } | { imagery: string };

/** 保存的记录的 id，也就是链接里的 10 位乱码 */
export const RECORD_ID_LENGTH = 10;

export function isRecordId(slug: string): boolean {
  return /^[0-9A-Za-z]+$/.test(slug) && slug.length === RECORD_ID_LENGTH;
}

const DIMENSION_KEYS = new Set<string>(DIMENSIONS.map((d) => d.key));

export function isDimensionKey(key: unknown): key is DimensionKey {
  return typeof key === "string" && DIMENSION_KEYS.has(key);
}

export function toSnapshot(result: QuizResult): QuizSnapshot {
  const [first, second] = result.profile;
  return {
    persona: first.key,
    secondary: second && second.z > 0 ? second.key : null,
    profile: result.profile.map((p) => ({
      key: p.key,
      z: Math.round(p.z * 100) / 100,
    })),
    imagery: result.imagery,
    matches: result.matches.map((m) => ({
      songId: m.songId,
      percent: m.percent,
      reasons: m.reasons,
    })),
  };
}

export function snapshotToRow(snapshot: QuizSnapshot): QuizSnapshotRow {
  return {
    persona: snapshot.persona,
    secondary: snapshot.secondary,
    profile: snapshot.profile,
    imagery: snapshot.imagery,
    song_ids: snapshot.matches.map((m) => m.songId),
    percents: snapshot.matches.map((m) => m.percent),
    reasons: snapshot.matches.map((m) =>
      m.reasons.map((r): StoredReason =>
        r.kind === "dimension" ? { dim: r.key } : { imagery: r.name },
      ),
    ),
  };
}

function toReason(stored: unknown): MatchReason | null {
  if (!stored || typeof stored !== "object") return null;
  const r = stored as Record<string, unknown>;
  if (isDimensionKey(r.dim)) return { kind: "dimension", key: r.dim };
  if (typeof r.imagery === "string")
    return { kind: "imagery", name: r.imagery };
  return null;
}

/**
 * 库里的记录 → 快照。维度改名或删掉后，旧记录里认不出的维度：
 * 主气韵认不出时整条无效，返回 null；其余地方认不出的直接略去。
 */
export function rowToSnapshot(row: QuizSnapshotRow): QuizSnapshot | null {
  if (!isDimensionKey(row.persona)) return null;
  const profile = Array.isArray(row.profile)
    ? row.profile.flatMap((p): DimensionScore[] => {
        const { key, z } = (p ?? {}) as Record<string, unknown>;
        return isDimensionKey(key) && typeof z === "number" ? [{ key, z }] : [];
      })
    : [];
  const reasons = Array.isArray(row.reasons) ? row.reasons : [];
  return {
    persona: row.persona,
    secondary: isDimensionKey(row.secondary) ? row.secondary : null,
    profile,
    imagery: row.imagery ?? [],
    matches: (row.song_ids ?? []).map((songId, i) => ({
      songId,
      percent: row.percents?.[i] ?? 0,
      reasons: Array.isArray(reasons[i])
        ? (reasons[i] as unknown[]).flatMap((r) => toReason(r) ?? [])
        : [],
    })),
  };
}
