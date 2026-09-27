import { describe, expect, it } from "vitest";
import { normalize, planSync, type DbSong, type NavSong } from "./sync";

function song(id: number, over: Partial<DbSong> = {}): DbSong {
  return {
    id,
    title: `歌${id}`,
    album: "专辑",
    discnumber: 1,
    track: id,
    length: 200,
    has_audio: true,
    ...over,
  };
}

function nav(id: string, over: Partial<NavSong> = {}): NavSong {
  return {
    id,
    title: "",
    album: "专辑",
    discNumber: 1,
    duration: 200,
    ...over,
  };
}

describe("normalize", () => {
  it("忽略全半角、大小写、空白和标点", () => {
    expect(normalize("Which Heaven is Mine")).toBe(
      normalize("which　heaven·is mine"),
    );
    expect(normalize("风起天阑（Live）")).toBe(normalize("风起天阑 (live)"));
    expect(normalize(null)).toBe("");
  });
});

describe("planSync", () => {
  it("按标题+专辑匹配，替换失效的旧 ID", () => {
    const plan = planSync(
      [song(1)],
      [nav("new", { title: "歌1", track: 1 })],
      [{ id: 1, navid_id: "old" }],
    );
    expect(plan.upserts).toEqual([
      expect.objectContaining({
        song: expect.objectContaining({ id: 1 }),
        nav: expect.objectContaining({ id: "new" }),
        previous: "old",
      }),
    ]);
    expect(plan.deletes).toEqual([]);
    expect(plan.hasAudioChanges).toEqual([]);
  });

  it("仍然有效的现有映射保持不动", () => {
    const plan = planSync(
      [song(1)],
      [nav("manual", { title: "别的标题" }), nav("auto", { title: "歌1" })],
      [{ id: 1, navid_id: "manual" }],
    );
    expect(plan.unchanged).toBe(1);
    expect(plan.upserts).toEqual([]);
    expect(plan.unusedNav.map((n) => n.id)).toEqual(["auto"]);
  });

  it("同名曲目分属不同专辑时按专辑区分", () => {
    const plan = planSync(
      [
        song(1, { title: "风起天阑", album: "风起天阑", track: 1 }),
        song(2, { title: "风起天阑", album: "倾尽天下", track: 5 }),
      ],
      [
        nav("a", { title: "风起天阑", album: "倾尽天下", track: 5 }),
        nav("b", { title: "风起天阑", album: "风起天阑", track: 1 }),
      ],
      [],
    );
    const pairs = plan.upserts.map((u) => [u.song.id, u.nav.id]);
    expect(pairs).toEqual([
      [1, "b"],
      [2, "a"],
    ]);
  });

  it("同专辑同名多条时用碟号和曲序区分", () => {
    const plan = planSync(
      [song(1, { title: "歌", discnumber: 2, track: 3 })],
      [
        nav("d1", { title: "歌", discNumber: 1, track: 3 }),
        nav("d2", { title: "歌", discNumber: 2, track: 3 }),
      ],
      [],
    );
    expect(plan.upserts.map((u) => u.nav.id)).toEqual(["d2"]);
  });

  it("同专辑同名多条且无法区分时转人工", () => {
    const plan = planSync(
      [song(1, { title: "歌", track: 9 })],
      [
        nav("x", { title: "歌", track: 1 }),
        nav("y", { title: "歌", track: 2 }),
      ],
      [],
    );
    expect(plan.upserts).toEqual([]);
    expect(plan.review[0].reason).toBe("同专辑内有多首同名曲目");
    expect(plan.review[0].candidates).toHaveLength(2);
  });

  it("时长相差超过容差时转人工", () => {
    const plan = planSync(
      [song(1, { length: 200 })],
      [nav("x", { title: "歌1", duration: 260 })],
      [],
    );
    expect(plan.upserts).toEqual([]);
    expect(plan.review[0].reason).toBe("时长不符");
  });

  it("任一方缺少时长时不做时长校验", () => {
    const plan = planSync(
      [song(1, { length: null })],
      [nav("x", { title: "歌1" })],
      [],
    );
    expect(plan.upserts).toHaveLength(1);
  });

  it("标题不同但专辑和曲序相同时转人工，不自动写入", () => {
    const plan = planSync(
      [song(1, { title: "我们的墨明棋妙", track: 4 })],
      [nav("x", { title: "我们的墨明棋妙（2012版）", track: 4 })],
      [],
    );
    expect(plan.upserts).toEqual([]);
    expect(plan.review[0].reason).toBe("同专辑同曲序，但标题不同");
  });

  it("同名曲目只在其他专辑时转人工", () => {
    const plan = planSync(
      [song(1, { title: "歌", album: "A" })],
      [nav("x", { title: "歌", album: "B" })],
      [],
    );
    expect(plan.review[0].reason).toBe("同名曲目在其他专辑");
  });

  it("多首歌匹配到同一曲目时都转人工", () => {
    const plan = planSync(
      [song(1, { title: "歌", track: 1 }), song(2, { title: "歌", track: 2 })],
      [nav("x", { title: "歌", track: 1 })],
      [],
    );
    expect(plan.upserts).toEqual([]);
    expect(plan.review.map((r) => r.reason)).toEqual([
      "多首歌匹配到同一曲目",
      "多首歌匹配到同一曲目",
    ]);
  });

  it("候选曲目已被保留的映射占用时转人工", () => {
    const plan = planSync(
      [song(1), song(2, { title: "歌1", track: 1 })],
      [nav("x", { title: "歌1", track: 1 })],
      [{ id: 1, navid_id: "x" }],
    );
    expect(plan.unchanged).toBe(1);
    expect(plan.review[0].reason).toBe("候选曲目已被其他歌曲的映射占用");
  });

  it("失效且找不到替代的映射被删除，has_audio 随之更新", () => {
    const plan = planSync(
      [song(1, { has_audio: true })],
      [],
      [{ id: 1, navid_id: "gone" }],
    );
    expect(plan.deletes).toEqual([{ id: 1, navid_id: "gone" }]);
    expect(plan.missing.map((s) => s.id)).toEqual([1]);
    expect(plan.hasAudioChanges).toEqual([
      { song: expect.objectContaining({ id: 1 }), next: false },
    ]);
  });

  it("新匹配到音频的歌曲 has_audio 置为 true", () => {
    const plan = planSync(
      [song(1, { has_audio: false })],
      [nav("x", { title: "歌1" })],
      [],
    );
    expect(plan.hasAudioChanges).toEqual([
      { song: expect.objectContaining({ id: 1 }), next: true },
    ]);
  });
});
