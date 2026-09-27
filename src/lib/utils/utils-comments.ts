import type { CommentAnchor, SongComment } from "@/lib/types";
import type { FolioLine, Notes } from "@/lib/utils/utils-folio";

/**
 * 评点：把批注按位置归到页面上的各处。
 *
 * 批注记下了被批的原文与歌词时间戳，而不只是序号——歌词或手记改过之后，
 * 序号会错位，原文却还能找回。找不回的批注降级为总评，连同原文一起显示。
 */

export const COMMENT_BODY_MAX = 1000;
export const COMMENT_QUOTE_MAX = 200;

/** 被批原文的存法：截到上限，按字（码点）计 */
export function toQuote(text: string): string {
  return Array.from(text.trim()).slice(0, COMMENT_QUOTE_MAX).join("");
}

/** 手记一段的原文：各行以换行相连 */
export function paragraphQuote(lines: Notes["paragraphs"][number]): string {
  return toQuote(lines.map((l) => l.text).join("\n"));
}

/** 批注在页面上的去处；key 用于 Map 与 DOM 上的 data-comment-slot */
export type CommentSlot =
  | { section: "song"; key: "song" }
  | { section: "score"; key: "score" }
  | { section: "lyrics"; key: `lyrics:${number}`; line: number }
  | { section: "notes"; key: `notes:${number}`; paragraph: number };

export const SONG_SLOT: CommentSlot = { section: "song", key: "song" };
export const SCORE_SLOT: CommentSlot = { section: "score", key: "score" };
export const lyricsSlot = (line: number): CommentSlot => ({
  section: "lyrics",
  key: `lyrics:${line}`,
  line,
});
export const notesSlot = (paragraph: number): CommentSlot => ({
  section: "notes",
  key: `notes:${paragraph}`,
  paragraph,
});

export interface CommentThread {
  comment: SongComment;
  replies: SongComment[];
  /** 原位置已找不到、降级到总评的批注，显示当时引用的原文 */
  orphanQuote: string | null;
}

export interface AnchorContext {
  lines: FolioLine[];
  paragraphs: Notes["paragraphs"];
}

/** 在候选位置里取离参考值最近的一个 */
function nearest(candidates: number[], score: (i: number) => number): number {
  return candidates.reduce((best, i) => (score(i) < score(best) ? i : best));
}

export function resolveSlot(
  comment: Pick<
    SongComment,
    "anchor" | "anchorIndex" | "anchorTime" | "anchorQuote"
  >,
  ctx: AnchorContext,
): { slot: CommentSlot; orphan: boolean } {
  const { anchor, anchorIndex, anchorTime, anchorQuote } = comment;

  if (anchor === "lyrics" && anchorQuote) {
    const candidates = ctx.lines
      .map((l, i) => (toQuote(l.text) === anchorQuote ? i : -1))
      .filter((i) => i >= 0);
    if (candidates.length > 0) {
      const line =
        anchorTime !== null &&
        candidates.some((i) => ctx.lines[i].time !== null)
          ? nearest(candidates, (i) =>
              Math.abs((ctx.lines[i].time ?? Infinity) - anchorTime),
            )
          : nearest(candidates, (i) => Math.abs(i - (anchorIndex ?? 0)));
      return { slot: lyricsSlot(line), orphan: false };
    }
    return { slot: SONG_SLOT, orphan: true };
  }

  if (anchor === "notes" && anchorQuote) {
    const candidates = ctx.paragraphs
      .map((p, i) => (paragraphQuote(p) === anchorQuote ? i : -1))
      .filter((i) => i >= 0);
    if (candidates.length > 0) {
      const paragraph = nearest(candidates, (i) =>
        Math.abs(i - (anchorIndex ?? 0)),
      );
      return { slot: notesSlot(paragraph), orphan: false };
    }
    return { slot: SONG_SLOT, orphan: true };
  }

  if (anchor === "score") return { slot: SCORE_SLOT, orphan: false };
  return { slot: SONG_SLOT, orphan: false };
}

/**
 * 同一处的批注排序：自己的在前，其余按时间，新的在前。
 * 回复按时间顺排。已删且没有回复的批注不显示（服务端通常已滤掉）。
 */
export function groupComments(
  comments: SongComment[],
  ctx: AnchorContext,
): Map<string, CommentThread[]> {
  const replies = new Map<number, SongComment[]>();
  for (const c of comments) {
    if (c.parentId === null) continue;
    const list = replies.get(c.parentId) ?? [];
    list.push(c);
    replies.set(c.parentId, list);
  }

  const bySlot = new Map<string, CommentThread[]>();
  for (const c of comments) {
    if (c.parentId !== null) continue;
    const threadReplies = (replies.get(c.id) ?? []).sort((a, b) =>
      a.createdAt.localeCompare(b.createdAt),
    );
    if (c.deleted && threadReplies.length === 0) continue;
    const { slot, orphan } = resolveSlot(c, ctx);
    const list = bySlot.get(slot.key) ?? [];
    list.push({
      comment: c,
      replies: threadReplies,
      orphanQuote: orphan ? c.anchorQuote : null,
    });
    bySlot.set(slot.key, list);
  }

  for (const list of bySlot.values()) {
    list.sort(
      (a, b) =>
        Number(b.comment.mine) - Number(a.comment.mine) ||
        b.comment.createdAt.localeCompare(a.comment.createdAt),
    );
  }
  return bySlot;
}

/** 某处的批注条数（含回复），用于行尾标记 */
export function countThreads(threads: CommentThread[] | undefined): number {
  if (!threads) return 0;
  return threads.reduce(
    (n, t) => n + (t.comment.deleted ? 0 : 1) + t.replies.length,
    0,
  );
}

export type NewCommentAnchor = {
  anchor: CommentAnchor;
  anchorIndex: number | null;
  anchorTime: number | null;
  anchorQuote: string | null;
};

/** 在某处新写批注时要记下的位置信息 */
export function anchorForSlot(
  slot: CommentSlot,
  ctx: AnchorContext,
): NewCommentAnchor {
  switch (slot.section) {
    case "lyrics": {
      const line = ctx.lines[slot.line];
      return {
        anchor: "lyrics",
        anchorIndex: slot.line,
        anchorTime: line?.time ?? null,
        anchorQuote: line ? toQuote(line.text) : null,
      };
    }
    case "notes": {
      const paragraph = ctx.paragraphs[slot.paragraph];
      return {
        anchor: "notes",
        anchorIndex: slot.paragraph,
        anchorTime: null,
        anchorQuote: paragraph ? paragraphQuote(paragraph) : null,
      };
    }
    case "score":
      return {
        anchor: "score",
        anchorIndex: null,
        anchorTime: null,
        anchorQuote: null,
      };
    default:
      return {
        anchor: "song",
        anchorIndex: null,
        anchorTime: null,
        anchorQuote: null,
      };
  }
}
