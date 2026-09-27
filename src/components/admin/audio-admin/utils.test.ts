import { describe, expect, it } from "vitest";
import type { DbSong, NavSong } from "@/lib/navidrome/sync";
import {
  buildRows,
  filterRows,
  formatDiff,
  formatDuration,
  needsAttention,
  rankCandidates,
} from "./utils";

function song(id: number, over: Partial<DbSong> = {}): DbSong {
  return {
    id,
    title: `歌${id}`,
    album: "专辑",
    discnumber: 1,
    track: 1,
    length: 200,
    has_audio: true,
    ...over,
  };
}

function nav(id: string, over: Partial<NavSong> = {}): NavSong {
  return { id, title: id, album: "合集", duration: 200, ...over };
}

describe("buildRows / needsAttention", () => {
  const library = [nav("a", { duration: 205 }), nav("b", { duration: 200 })];
  const rows = buildRows(
    [
      song(1),
      song(2, { length: 200 }),
      song(3, { has_audio: false }),
      song(4),
      song(5, { has_audio: false }),
    ],
    [
      { id: 1, navid_id: "b" },
      { id: 2, navid_id: "a" },
      { id: 4, navid_id: "gone" },
    ],
    library,
  );

  it("解析映射指向的曲目和时长差", () => {
    expect(rows[0]).toMatchObject({ navidId: "b", durationDiff: 0 });
    expect(rows[1]).toMatchObject({ navidId: "a", durationDiff: 5 });
    expect(rows[3]).toMatchObject({ navidId: "gone", nav: null });
  });

  it("标出需要处理的歌曲", () => {
    expect(rows.map(needsAttention)).toEqual([
      false, // 正常
      true, // 时长差 5s
      false, // 未关联且 has_audio=false，一致
      true, // 映射失效
      false,
    ]);
  });

  it("has_audio 与映射状态不一致也需要处理", () => {
    const [row] = buildRows([song(1, { has_audio: true })], [], library);
    expect(needsAttention(row)).toBe(true);
  });

  it("按状态筛选并支持按 ID、标题、路径搜索", () => {
    expect(filterRows(rows, "linked", "").map((r) => r.song.id)).toEqual([
      1, 2,
    ]);
    expect(filterRows(rows, "unlinked", "").map((r) => r.song.id)).toEqual([
      3, 4, 5,
    ]);
    expect(filterRows(rows, "all", "#3").map((r) => r.song.id)).toEqual([3]);
    expect(filterRows(rows, "all", "歌 5").map((r) => r.song.id)).toEqual([5]);
  });
});

describe("rankCandidates", () => {
  const library = [
    nav("pure", { title: "卫玠辞", duration: 231 }),
    nav("story", { title: "卫玠辞（剧情版）", duration: 439 }),
    nav("other", { title: "别的歌", duration: 441, path: "河图/x/别的歌.mp3" }),
    nav("far", { title: "无关", duration: 100 }),
    nav("unknown", { title: "卫玠辞（伴奏）" }),
  ];

  it("无搜索词时列出标题相近或时长吻合的曲目，标题相近优先", () => {
    const result = rankCandidates(
      song(1, { title: "卫玠辞", length: 440 }),
      library,
      new Map(),
      "",
    );
    expect(result.map((c) => c.nav.id)).toEqual([
      "story",
      "pure",
      "unknown",
      "other",
    ]);
    expect(result[0].durationDiff).toBe(-1);
  });

  it("有搜索词时按标题、专辑、路径搜索", () => {
    const result = rankCandidates(song(1), library, new Map(), "河图/x");
    expect(result.map((c) => c.nav.id)).toEqual(["other"]);
  });

  it("标出已被其他歌曲关联的曲目", () => {
    const owner = song(9);
    const result = rankCandidates(
      song(1, { title: "卫玠辞", length: 231 }),
      library,
      new Map([["pure", owner]]),
      "",
    );
    expect(result.find((c) => c.nav.id === "pure")?.owner).toBe(owner);
  });
});

describe("formatDuration / formatDiff", () => {
  it("格式化时长和时长差", () => {
    expect(formatDuration(65)).toBe("1:05");
    expect(formatDuration(null)).toBe("--:--");
    expect(formatDiff(3)).toBe("+3s");
    expect(formatDiff(-2)).toBe("-2s");
    expect(formatDiff(0)).toBeNull();
    expect(formatDiff(null)).toBeNull();
  });
});
