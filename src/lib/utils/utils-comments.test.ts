import { describe, expect, it } from "vitest";
import type { SongComment } from "@/lib/types";
import {
  anchorForSlot,
  countThreads,
  groupComments,
  lyricsSlot,
  notesSlot,
  resolveSlot,
  SCORE_SLOT,
  SONG_SLOT,
  toQuote,
} from "./utils-comments";
import { buildFolio, parseNotes } from "./utils-folio";

/** parseNotes 的非空版本：用例里的备注都不为空 */
function notesOf(text: string) {
  const notes = parseNotes(text);
  if (!notes) throw new Error("parseNotes 意外返回 null");
  return notes;
}

const { lines } = buildFolio(
  [
    "[00:10.00]我搁苍山一柄剑",
    "[00:14.00]收尽洱海水千叠",
    "[00:40.00]我搁苍山一柄剑",
    "[00:44.00]轻舟拢岸归鄙野",
  ].join("\n"),
);
const notes = notesOf("第一段\n——某某\n\n第二段");
const ctx = { lines, paragraphs: notes.paragraphs };

function comment(overrides: Partial<SongComment>): SongComment {
  return {
    id: 1,
    parentId: null,
    anchor: "song",
    anchorIndex: null,
    anchorTime: null,
    anchorQuote: null,
    body: "好",
    private: false,
    pending: false,
    deleted: false,
    likeCount: 0,
    liked: false,
    mine: false,
    author: "某某",
    createdAt: "2026-09-01T00:00:00Z",
    editedAt: null,
    ...overrides,
  };
}

describe("resolveSlot", () => {
  it("按原文找回那一句，重复句用时间戳取最近的一处", () => {
    const base = { anchor: "lyrics" as const, anchorQuote: "我搁苍山一柄剑" };
    expect(
      resolveSlot({ ...base, anchorIndex: 0, anchorTime: 41 }, ctx).slot,
    ).toEqual(lyricsSlot(2));
    expect(
      resolveSlot({ ...base, anchorIndex: 2, anchorTime: 10 }, ctx).slot,
    ).toEqual(lyricsSlot(0));
  });

  it("歌词改过、序号错位时仍按原文定位", () => {
    const { slot } = resolveSlot(
      {
        anchor: "lyrics",
        anchorIndex: 0,
        anchorTime: 99,
        anchorQuote: "轻舟拢岸归鄙野",
      },
      ctx,
    );
    expect(slot).toEqual(lyricsSlot(3));
  });

  it("原文找不到时降级为总评", () => {
    expect(
      resolveSlot(
        {
          anchor: "lyrics",
          anchorIndex: 1,
          anchorTime: 14,
          anchorQuote: "已经删掉的一句",
        },
        ctx,
      ),
    ).toEqual({ slot: SONG_SLOT, orphan: true });
  });

  it("手记按段落原文定位，乐谱与总评直接归位", () => {
    const quote = "第二段";
    expect(
      resolveSlot(
        {
          anchor: "notes",
          anchorIndex: 0,
          anchorTime: null,
          anchorQuote: quote,
        },
        ctx,
      ).slot,
    ).toEqual(notesSlot(1));
    expect(
      resolveSlot(
        {
          anchor: "score",
          anchorIndex: null,
          anchorTime: null,
          anchorQuote: null,
        },
        ctx,
      ).slot,
    ).toEqual(SCORE_SLOT);
  });
});

describe("anchorForSlot", () => {
  it("记下序号、时间戳与原文，且能被 resolveSlot 找回", () => {
    const anchor = anchorForSlot(lyricsSlot(2), ctx);
    expect(anchor).toEqual({
      anchor: "lyrics",
      anchorIndex: 2,
      anchorTime: 40,
      anchorQuote: "我搁苍山一柄剑",
    });
    expect(resolveSlot(anchor, ctx).slot).toEqual(lyricsSlot(2));

    const para = anchorForSlot(notesSlot(0), ctx);
    expect(para.anchorQuote).toBe("第一段\n——某某");
    expect(resolveSlot(para, ctx).slot).toEqual(notesSlot(0));
  });

  it("原文按字截到上限", () => {
    expect(Array.from(toQuote("字".repeat(300))).length).toBe(200);
  });
});

describe("groupComments", () => {
  it("回复挂到批注下并按时间顺排；同处自己的在前，其余赞多的在前", () => {
    const grouped = groupComments(
      [
        comment({ id: 1, likeCount: 9, createdAt: "2026-09-01T00:00:00Z" }),
        comment({ id: 2, mine: true, createdAt: "2026-09-02T00:00:00Z" }),
        comment({ id: 3, likeCount: 0, createdAt: "2026-09-03T00:00:00Z" }),
        comment({
          id: 4,
          parentId: 1,
          anchor: null,
          createdAt: "2026-09-05T00:00:00Z",
        }),
        comment({
          id: 5,
          parentId: 1,
          anchor: null,
          createdAt: "2026-09-04T00:00:00Z",
        }),
      ],
      ctx,
    );
    const song = grouped.get("song") ?? [];
    expect(song.map((t) => t.comment.id)).toEqual([2, 1, 3]);
    expect(song[1].replies.map((r) => r.id)).toEqual([5, 4]);
    expect(countThreads(song)).toBe(5);
  });

  it("自己的只按时间排，不看赞；赞一样时新的在前", () => {
    const grouped = groupComments(
      [
        comment({
          id: 1,
          mine: true,
          likeCount: 5,
          createdAt: "2026-09-01T00:00:00Z",
        }),
        comment({
          id: 2,
          mine: true,
          likeCount: 0,
          createdAt: "2026-09-02T00:00:00Z",
        }),
        comment({ id: 3, likeCount: 2, createdAt: "2026-09-03T00:00:00Z" }),
        comment({ id: 4, likeCount: 2, createdAt: "2026-09-04T00:00:00Z" }),
        comment({ id: 5, likeCount: 7, createdAt: "2026-09-05T00:00:00Z" }),
      ],
      ctx,
    );
    expect((grouped.get("song") ?? []).map((t) => t.comment.id)).toEqual([
      2, 1, 5, 4, 3,
    ]);
  });

  it("按调用方给的赞数排；已删的占位按 0 赞算", () => {
    const grouped = groupComments(
      [
        comment({ id: 1, likeCount: 3, createdAt: "2026-09-01T00:00:00Z" }),
        // 刚在页面上点了赞，本地已是 4，但排序仍按进页时的 0
        comment({ id: 2, likeCount: 4, createdAt: "2026-09-02T00:00:00Z" }),
        comment({
          id: 3,
          deleted: true,
          likeCount: 9,
          createdAt: "2026-09-03T00:00:00Z",
        }),
        comment({ id: 4, parentId: 3, anchor: null }),
      ],
      ctx,
      (c) => (c.id === 2 ? 0 : c.likeCount),
    );
    expect((grouped.get("song") ?? []).map((t) => t.comment.id)).toEqual([
      1, 3, 2,
    ]);
  });

  it("已删的批注只在有回复时保留，且不计数", () => {
    const grouped = groupComments(
      [
        comment({ id: 1, deleted: true, body: "" }),
        comment({ id: 2, deleted: true, body: "" }),
        comment({ id: 3, parentId: 2, anchor: null }),
      ],
      ctx,
    );
    const song = grouped.get("song") ?? [];
    expect(song.map((t) => t.comment.id)).toEqual([2]);
    expect(countThreads(song)).toBe(1);
  });

  it("找不回位置的批注落到总评，带上原文", () => {
    const grouped = groupComments(
      [
        comment({
          id: 1,
          anchor: "lyrics",
          anchorIndex: 0,
          anchorQuote: "旧句",
        }),
      ],
      ctx,
    );
    expect((grouped.get("song") ?? [])[0].orphanQuote).toBe("旧句");
  });
});
