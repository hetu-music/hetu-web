import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createMockSupabaseClient,
  makeQueryBuilder,
} from "@/test/mockSupabase";

vi.mock("@/lib/db/supabase-server", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/db/supabase-server")>();
  return { ...actual, getServiceClient: vi.fn() };
});

import { getServiceClient } from "@/lib/db/supabase-server";
import {
  CommentError,
  createComment,
  createCommentSchema,
  likeComment,
  listSongComments,
} from "./service-comments";

function row(overrides: Record<string, unknown>) {
  return {
    id: 1,
    parent_id: null,
    user_id: "u1",
    anchor: "song",
    anchor_index: null,
    anchor_time: null,
    anchor_quote: null,
    body: "好",
    visibility: 0,
    status: 0,
    like_count: 0,
    created_at: "2026-09-01T00:00:00Z",
    edited_at: null,
    ...overrides,
  };
}

describe("listSongComments", () => {
  beforeEach(() => vi.mocked(getServiceClient).mockReset());

  it("未登录只查公开的，连带作者名；不暴露 user_id", async () => {
    const comments = makeQueryBuilder({
      data: [row({ id: 1, anchor_time: "40.500", anchor: "lyrics" })],
      error: null,
    });
    const users = makeQueryBuilder({
      data: [{ id: "u1", name: "冥凰" }],
      error: null,
    });
    vi.mocked(getServiceClient).mockReturnValue(
      createMockSupabaseClient([comments, users]),
    );

    const list = await listSongComments(7, null);
    expect(comments.eq).toHaveBeenCalledWith("song_id", 7);
    expect(comments.or).toHaveBeenCalledWith(
      "and(visibility.eq.0,status.in.(0,3))",
    );
    expect(list).toEqual([
      expect.objectContaining({
        id: 1,
        anchor: "lyrics",
        anchorTime: 40.5,
        author: "冥凰",
        mine: false,
        liked: false,
      }),
    ]);
    expect(list[0]).not.toHaveProperty("user_id");
  });

  it("登录后另含自己的私批，并标出赞过的", async () => {
    const comments = makeQueryBuilder({
      data: [
        row({ id: 1, user_id: "me", visibility: 1 }),
        row({ id: 2, user_id: "u2" }),
      ],
      error: null,
    });
    const users = makeQueryBuilder({
      data: [
        { id: "me", name: "我" },
        { id: "u2", name: "他" },
      ],
      error: null,
    });
    const likes = makeQueryBuilder({ data: [{ comment_id: 2 }], error: null });
    vi.mocked(getServiceClient).mockReturnValue(
      createMockSupabaseClient([comments, users, likes]),
    );

    const list = await listSongComments(7, "me");
    expect(comments.or).toHaveBeenCalledWith(
      "and(visibility.eq.0,status.in.(0,3)),and(user_id.eq.me,status.in.(0,1))",
    );
    expect(list.map((c) => [c.id, c.private, c.mine, c.liked])).toEqual([
      [1, true, true, false],
      [2, false, false, true],
    ]);
  });

  it("已删的批注只在还有回复时保留，且隐去作者与内容", async () => {
    const comments = makeQueryBuilder({
      data: [
        row({ id: 1, status: 3, body: "" }),
        row({ id: 2, status: 3, body: "" }),
        row({ id: 3, parent_id: 1, anchor: null, user_id: "u2" }),
        // 父批注不可见的回复一并丢掉
        row({ id: 4, parent_id: 99, anchor: null }),
      ],
      error: null,
    });
    const users = makeQueryBuilder({
      data: [{ id: "u2", name: "他" }],
      error: null,
    });
    vi.mocked(getServiceClient).mockReturnValue(
      createMockSupabaseClient([comments, users]),
    );

    const list = await listSongComments(7, null);
    expect(list.map((c) => c.id)).toEqual([1, 3]);
    expect(list[0]).toMatchObject({ deleted: true, author: null, body: "" });
  });
});

describe("createCommentSchema", () => {
  it("顶层批注必须有位置；回复只需父批注", () => {
    expect(
      createCommentSchema.safeParse({ songId: 1, body: "好", private: false })
        .success,
    ).toBe(false);
    expect(
      createCommentSchema.safeParse({ songId: 1, parentId: 2, body: " 好 " })
        .data,
    ).toEqual({ songId: 1, parentId: 2, body: "好" });
  });

  it("空白内容与超长内容不收", () => {
    const base = {
      songId: 1,
      anchor: "song",
      anchorIndex: null,
      anchorTime: null,
      anchorQuote: null,
      private: false,
    };
    expect(createCommentSchema.safeParse({ ...base, body: "  " }).success).toBe(
      false,
    );
    expect(
      createCommentSchema.safeParse({ ...base, body: "字".repeat(1001) })
        .success,
    ).toBe(false);
  });
});

describe("createComment", () => {
  const input = {
    songId: 1,
    anchor: "lyrics" as const,
    anchorIndex: 2,
    anchorTime: 40,
    anchorQuote: "我搁苍山一柄剑",
    body: "好",
    private: true,
  };

  it("写入时带上位置与私批标记", async () => {
    const count = makeQueryBuilder({
      data: null,
      error: null,
      count: 0,
    } as never);
    const insert = makeQueryBuilder({ data: { id: 9 }, error: null });
    const supabase = createMockSupabaseClient([count, insert]);

    expect(await createComment(supabase, "me", input)).toBe(9);
    expect(insert.insert).toHaveBeenCalledWith({
      song_id: 1,
      user_id: "me",
      anchor: "lyrics",
      anchor_index: 2,
      anchor_time: 40,
      anchor_quote: "我搁苍山一柄剑",
      body: "好",
      visibility: 1,
    });
  });

  it("一分钟内写得太多时拒绝", async () => {
    const count = makeQueryBuilder({
      data: null,
      error: null,
      count: 5,
    } as never);
    const supabase = createMockSupabaseClient([count]);
    await expect(createComment(supabase, "me", input)).rejects.toMatchObject({
      status: 429,
    });
  });

  it("回复不可回复的批注时返回 400", async () => {
    const count = makeQueryBuilder({
      data: null,
      error: null,
      count: 0,
    } as never);
    const insert = makeQueryBuilder({
      data: null,
      error: { code: "23514" },
    });
    const supabase = createMockSupabaseClient([count, insert]);
    const err = await createComment(supabase, "me", {
      songId: 1,
      parentId: 3,
      body: "好",
    }).catch((e) => e);
    expect(err).toBeInstanceOf(CommentError);
    expect(err.status).toBe(400);
  });
});

describe("likeComment", () => {
  it("重复点赞视为成功，赞不了的批注返回 404", async () => {
    await expect(
      likeComment(
        createMockSupabaseClient([
          makeQueryBuilder({ data: null, error: { code: "23505" } }),
        ]),
        "me",
        1,
      ),
    ).resolves.toBeUndefined();
    await expect(
      likeComment(
        createMockSupabaseClient([
          makeQueryBuilder({ data: null, error: { code: "42501" } }),
        ]),
        "me",
        1,
      ),
    ).rejects.toMatchObject({ status: 404 });
  });
});
