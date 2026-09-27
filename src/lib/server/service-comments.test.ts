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
import { NextRequest } from "next/server";
import {
  CommentError,
  commentIdFromUrl,
  createComment,
  createCommentSchema,
  deleteComment,
  editComment,
  likeComment,
  listMyComments,
  listSongComments,
  unlikeComment,
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

describe("listSongComments 边界", () => {
  beforeEach(() => vi.mocked(getServiceClient).mockReset());

  it("Supabase 未配置时返回空列表", async () => {
    vi.mocked(getServiceClient).mockReturnValue(null);
    expect(await listSongComments(7, null)).toEqual([]);
  });

  it("查询出错时抛出", async () => {
    vi.mocked(getServiceClient).mockReturnValue(
      createMockSupabaseClient([
        makeQueryBuilder({ data: null, error: { message: "boom" } }),
      ]),
    );
    await expect(listSongComments(7, null)).rejects.toMatchObject({
      message: "boom",
    });
  });

  it("只剩已删且无回复的批注时直接返回空，不再查作者", async () => {
    const comments = makeQueryBuilder({
      data: [row({ id: 1, status: 3, body: "" })],
      error: null,
    });
    const client = createMockSupabaseClient([comments]);
    vi.mocked(getServiceClient).mockReturnValue(client);

    expect(await listSongComments(7, "me")).toEqual([]);
    expect(client.from).toHaveBeenCalledTimes(1);
  });

  it("作者或点赞查询出错时抛出", async () => {
    const comments = () =>
      makeQueryBuilder({ data: [row({ id: 1 })], error: null });
    const ok = makeQueryBuilder({ data: [], error: null });
    const bad = makeQueryBuilder({ data: null, error: { message: "bad" } });

    vi.mocked(getServiceClient).mockReturnValue(
      createMockSupabaseClient([comments(), bad, ok]),
    );
    await expect(listSongComments(7, "me")).rejects.toMatchObject({
      message: "bad",
    });

    vi.mocked(getServiceClient).mockReturnValue(
      createMockSupabaseClient([comments(), ok, bad]),
    );
    await expect(listSongComments(7, "me")).rejects.toMatchObject({
      message: "bad",
    });
  });
});

describe("commentIdFromUrl", () => {
  it("取 /comments/ 后面的正整数，否则为 null", () => {
    const at = (path: string) =>
      commentIdFromUrl(new NextRequest(`http://localhost${path}`));
    expect(at("/api/public/comments/12")).toBe(12);
    expect(at("/api/public/comments/12/like")).toBe(12);
    expect(at("/api/public/comments/abc")).toBeNull();
    expect(at("/api/public/comments/0")).toBeNull();
    expect(at("/api/public/comments/1.5")).toBeNull();
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

describe("createComment 边界", () => {
  const counted = () =>
    makeQueryBuilder({ data: null, error: null, count: 0 } as never);

  it("回复只写父批注与内容，不带位置与私批", async () => {
    const insert = makeQueryBuilder({ data: { id: 11 }, error: null });
    const supabase = createMockSupabaseClient([counted(), insert]);

    expect(
      await createComment(supabase, "me", {
        songId: 1,
        parentId: 3,
        body: "同感",
      }),
    ).toBe(11);
    expect(insert.insert).toHaveBeenCalledWith({
      song_id: 1,
      user_id: "me",
      parent_id: 3,
      body: "同感",
    });
  });

  it("计数出错或写入出现其他错误时原样抛出", async () => {
    const input = { songId: 1, parentId: 3, body: "好" };
    const countFailed = makeQueryBuilder({
      data: null,
      error: { message: "count" },
    });
    await expect(
      createComment(createMockSupabaseClient([countFailed]), "me", input),
    ).rejects.toMatchObject({ message: "count" });

    const insertFailed = makeQueryBuilder({
      data: null,
      error: { code: "XX000", message: "insert" },
    });
    const err = await createComment(
      createMockSupabaseClient([counted(), insertFailed]),
      "me",
      input,
    ).catch((e) => e);
    expect(err).not.toBeInstanceOf(CommentError);
    expect(err).toMatchObject({ message: "insert" });
  });
});

describe("editComment / deleteComment", () => {
  function rpcClient(error: unknown) {
    const rpc = vi.fn().mockResolvedValue({ error });
    return { rpc, client: { rpc } as never };
  }

  it("调用对应的 RPC", async () => {
    const edit = rpcClient(null);
    await editComment(edit.client, 5, "改过");
    expect(edit.rpc).toHaveBeenCalledWith("edit_comment", {
      p_id: 5,
      p_body: "改过",
    });

    const del = rpcClient(null);
    await deleteComment(del.client, 5);
    expect(del.rpc).toHaveBeenCalledWith("delete_comment", { p_id: 5 });
  });

  it("不存在返回 404，内容不合要求返回 400，其余原样抛出", async () => {
    await expect(
      editComment(rpcClient({ code: "P0002" }).client, 5, "x"),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      editComment(rpcClient({ code: "23514" }).client, 5, "x"),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      deleteComment(rpcClient({ code: "P0002" }).client, 5),
    ).rejects.toBeInstanceOf(CommentError);

    const err = await deleteComment(
      rpcClient({ code: "XX000", message: "rpc" }).client,
      5,
    ).catch((e) => e);
    expect(err).not.toBeInstanceOf(CommentError);
    expect(err).toMatchObject({ message: "rpc" });
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

describe("likeComment 边界", () => {
  it("写入成功；批注不存在返回 404；其余错误原样抛出", async () => {
    const insert = makeQueryBuilder({ data: null, error: null });
    await likeComment(createMockSupabaseClient([insert]), "me", 3);
    expect(insert.insert).toHaveBeenCalledWith({
      comment_id: 3,
      user_id: "me",
    });

    await expect(
      likeComment(
        createMockSupabaseClient([
          makeQueryBuilder({ data: null, error: { code: "23503" } }),
        ]),
        "me",
        3,
      ),
    ).rejects.toMatchObject({ status: 404 });

    const err = await likeComment(
      createMockSupabaseClient([
        makeQueryBuilder({ data: null, error: { code: "XX000" } }),
      ]),
      "me",
      3,
    ).catch((e) => e);
    expect(err).not.toBeInstanceOf(CommentError);
  });
});

describe("unlikeComment", () => {
  it("只删自己对这则批注的赞，出错时抛出", async () => {
    const del = makeQueryBuilder({ data: null, error: null });
    await unlikeComment(createMockSupabaseClient([del]), "me", 3);
    expect(del.delete).toHaveBeenCalled();
    expect(del.eq).toHaveBeenCalledWith("comment_id", 3);
    expect(del.eq).toHaveBeenCalledWith("user_id", "me");

    await expect(
      unlikeComment(
        createMockSupabaseClient([
          makeQueryBuilder({ data: null, error: { message: "gone" } }),
        ]),
        "me",
        3,
      ),
    ).rejects.toMatchObject({ message: "gone" });
  });
});

describe("listMyComments", () => {
  beforeEach(() => vi.mocked(getServiceClient).mockReset());

  it("按歌分组，回复带上所回复的批注；原批注已删时为 null", async () => {
    const mine = makeQueryBuilder({
      data: [
        row({ id: 5, song_id: 2, parent_id: 1, anchor: null, user_id: "me" }),
        row({
          id: 4,
          song_id: 3,
          anchor: "lyrics",
          anchor_quote: "我搁苍山一柄剑",
          visibility: 1,
          user_id: "me",
        }),
        row({ id: 3, song_id: 2, parent_id: 9, anchor: null, user_id: "me" }),
      ],
      error: null,
    });
    const parents = makeQueryBuilder({
      data: [
        {
          id: 1,
          user_id: "u2",
          body: "原批",
          status: 0,
          anchor: "notes",
          anchor_quote: "第一段",
        },
        {
          id: 9,
          user_id: "u2",
          body: "",
          status: 3,
          anchor: "song",
          anchor_quote: null,
        },
      ],
      error: null,
    });
    const users = makeQueryBuilder({
      data: [{ id: "u2", name: "他" }],
      error: null,
    });
    const songs = makeQueryBuilder({
      data: [
        { id: 2, title: "甲", artist: ["河图"], hascover: true },
        { id: 3, title: "乙", artist: null, hascover: false },
      ],
      error: null,
    });
    vi.mocked(getServiceClient).mockReturnValue(
      createMockSupabaseClient([songs, parents, users]),
    );

    const groups = await listMyComments(
      createMockSupabaseClient([mine]),
      "me",
      "zh-CN",
    );
    expect(mine.eq).toHaveBeenCalledWith("user_id", "me");
    expect(groups.map((g) => [g.song.id, g.comments.map((c) => c.id)])).toEqual(
      [
        [2, [5, 3]],
        [3, [4]],
      ],
    );
    expect(groups[0].comments[0]).toMatchObject({
      isReply: true,
      anchor: "notes",
      anchorQuote: "第一段",
      replyTo: { author: "他", body: "原批" },
    });
    expect(groups[0].comments[1].replyTo).toBeNull();
    expect(groups[1].comments[0]).toMatchObject({
      isReply: false,
      anchor: "lyrics",
      private: true,
    });
  });
});

describe("listMyComments 边界", () => {
  beforeEach(() => vi.mocked(getServiceClient).mockReset());

  it("没有批注时直接返回空；查询出错时抛出", async () => {
    expect(
      await listMyComments(
        createMockSupabaseClient([makeQueryBuilder({ data: [], error: null })]),
        "me",
        "zh-CN",
      ),
    ).toEqual([]);

    await expect(
      listMyComments(
        createMockSupabaseClient([
          makeQueryBuilder({ data: null, error: { message: "mine" } }),
        ]),
        "me",
        "zh-CN",
      ),
    ).rejects.toMatchObject({ message: "mine" });
  });

  it("所回复的批注或其作者查询出错时抛出", async () => {
    const mine = () =>
      makeQueryBuilder({
        data: [row({ id: 5, song_id: 2, parent_id: 1, user_id: "me" })],
        error: null,
      });
    const songs = () =>
      makeQueryBuilder({
        data: [{ id: 2, title: "甲", artist: null, hascover: false }],
        error: null,
      });
    const parents = makeQueryBuilder({
      data: [
        {
          id: 1,
          user_id: "u2",
          body: "原批",
          status: 0,
          anchor: "song",
          anchor_quote: null,
        },
      ],
      error: null,
    });
    const bad = makeQueryBuilder({ data: null, error: { message: "bad" } });

    vi.mocked(getServiceClient).mockReturnValue(
      createMockSupabaseClient([songs(), bad]),
    );
    await expect(
      listMyComments(createMockSupabaseClient([mine()]), "me", "zh-CN"),
    ).rejects.toMatchObject({ message: "bad" });

    vi.mocked(getServiceClient).mockReturnValue(
      createMockSupabaseClient([songs(), parents, bad]),
    );
    await expect(
      listMyComments(createMockSupabaseClient([mine()]), "me", "zh-CN"),
    ).rejects.toMatchObject({ message: "bad" });
  });

  it("歌曲已不存在的批注略去", async () => {
    const mine = makeQueryBuilder({
      data: [row({ id: 4, song_id: 404, anchor: "song", user_id: "me" })],
      error: null,
    });
    vi.mocked(getServiceClient).mockReturnValue(
      createMockSupabaseClient([makeQueryBuilder({ data: [], error: null })]),
    );
    expect(
      await listMyComments(createMockSupabaseClient([mine]), "me", "zh-CN"),
    ).toEqual([]);
  });
});
