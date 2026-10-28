import { describe, expect, it } from "vitest";
import { QUESTIONS } from "./questions";
import { resultSlugLength } from "./codec";
import {
  isRecordId,
  RECORD_ID_LENGTH,
  rowToSnapshot,
  snapshotToRow,
  toSnapshot,
  type QuizSnapshot,
} from "./snapshot";

const snapshot: QuizSnapshot = {
  persona: "tianxiang",
  secondary: "shanhe",
  profile: [
    { key: "tianxiang", z: 1.5 },
    { key: "shanhe", z: 0.25 },
  ],
  imagery: ["月"],
  matches: [
    {
      songId: 7,
      percent: 92,
      reasons: [
        { kind: "dimension", key: "tianxiang" },
        { kind: "imagery", name: "月" },
      ],
    },
    { songId: 9, percent: 80, reasons: [] },
  ],
};

describe("toSnapshot", () => {
  it("取前两个维度作主气韵与兼有，z 分数保留两位小数", () => {
    const s = toSnapshot({
      profile: [
        { key: "caomu", z: 1.23456 },
        { key: "loutai", z: 0.5 },
      ],
      imagery: [],
      matches: [{ songId: 1, score: 0.9, percent: 95, reasons: [] }],
    });
    expect(s.persona).toBe("caomu");
    expect(s.secondary).toBe("loutai");
    expect(s.profile[0].z).toBe(1.23);
    expect(s.matches).toEqual([{ songId: 1, percent: 95, reasons: [] }]);
  });

  it("第二个维度不为正时没有兼有", () => {
    const s = toSnapshot({
      profile: [
        { key: "caomu", z: 1 },
        { key: "loutai", z: 0 },
      ],
      imagery: [],
      matches: [],
    });
    expect(s.secondary).toBeNull();
  });
});

describe("snapshotToRow / rowToSnapshot", () => {
  it("理由只存键名，读回来与原快照一致", () => {
    const row = snapshotToRow(snapshot);
    expect(row.song_ids).toEqual([7, 9]);
    expect(row.percents).toEqual([92, 80]);
    expect(row.reasons).toEqual([
      [{ dim: "tianxiang" }, { imagery: "月" }],
      [],
    ]);
    expect(rowToSnapshot(JSON.parse(JSON.stringify(row)))).toEqual(snapshot);
  });

  it("认不出的维度：主气韵认不出整条无效，其余地方略去", () => {
    const row = snapshotToRow(snapshot);
    expect(rowToSnapshot({ ...row, persona: "gone" })).toBeNull();

    const read = rowToSnapshot({
      ...row,
      secondary: "gone",
      profile: [{ key: "gone", z: 1 }, ...(row.profile as unknown[])],
      reasons: [[{ dim: "gone" }, { imagery: "月" }], "坏数据"],
    });
    expect(read?.secondary).toBeNull();
    expect(read?.profile).toEqual(snapshot.profile);
    expect(read?.matches[0].reasons).toEqual([{ kind: "imagery", name: "月" }]);
    expect(read?.matches[1].reasons).toEqual([]);
  });
});

describe("isRecordId", () => {
  it("只认 10 位 base62", () => {
    expect(isRecordId("aB3dE6gH9k")).toBe(true);
    expect(isRecordId("aB3dE6gH9")).toBe(false);
    expect(isRecordId("aB3dE6gH9-")).toBe(false);
  });

  it("与作答编码的乱码长度不同，靠长度区分两种链接", () => {
    expect(resultSlugLength(QUESTIONS.map((q) => q.options.length))).not.toBe(
      RECORD_ID_LENGTH,
    );
  });
});
