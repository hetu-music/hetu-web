import { describe, expect, it } from "vitest";
import {
  checkConsistency,
  expandAnnotations,
  linesForWord,
  songTimetags,
  withTimetags,
} from "./consistency";
import { parseLrcLines } from "./suggest";

describe("linesForWord", () => {
  const lines = parseLrcLines(
    "[00:01.00]明月照我\n[00:02.00]岁月如月\n[00:03.00]岁月长\n[00:04.00]Moonlight\n[00:05.00]到地老 天荒",
  );

  it("跳过只出现在同曲更长标注词里的行", () => {
    // 「岁月长」里的月属于岁月；「岁月如月」还有一个独立的月
    expect(linesForWord(lines, "月", ["月", "岁月"])).toEqual([
      "00:01.00",
      "00:02.00",
    ]);
    // 同曲还标了明月，「明月照我」也不再算
    expect(linesForWord(lines, "月", ["月", "明月", "岁月"])).toEqual([
      "00:02.00",
    ]);
  });

  it("没有更长的标注词时，所有字面出现的行都算；英文不分大小写，行内空白不算", () => {
    expect(linesForWord(lines, "月", ["月"])).toEqual([
      "00:01.00",
      "00:02.00",
      "00:03.00",
    ]);
    expect(linesForWord(lines, "moonlight", [])).toEqual(["00:04.00"]);
    expect(linesForWord(lines, "地老天荒", [])).toEqual(["00:05.00"]);
  });
});

describe("songTimetags", () => {
  it("给出每个词应有的标签；歌词没有时间轴时返回 null", () => {
    expect(
      songTimetags("[00:01.00]岁月如月\n[00:02.00]岁月", ["月", "岁月"]),
    ).toEqual(
      new Map([
        ["月", ["00:01.00"]],
        ["岁月", ["00:01.00", "00:02.00"]],
      ]),
    );
    expect(songTimetags("岁月如月", ["月"])).toBeNull();
    expect(songTimetags(null, ["月"])).toBeNull();
  });
});

describe("withTimetags", () => {
  it("按各自版本的歌词算；被同版本更长词覆盖的行不算，即使只给了部分行", () => {
    const versions = new Map([
      [
        1,
        { lyrics: "[00:01.00]岁月如月\n[00:02.00]岁月", names: ["月", "岁月"] },
      ],
      [2, { lyrics: "[00:01.00]明月", names: ["明月"] }],
    ]);
    const rows = withTimetags(
      [
        { version_id: 1, imagery_name: "月" },
        { version_id: 2, imagery_name: "明月" },
        { version_id: 3, imagery_name: "月" }, // 查不到版本
      ],
      versions,
    );
    expect(rows.map((r) => r.lyric_timetag)).toEqual([
      ["00:01.00"],
      ["00:01.00"],
      [],
    ]);
  });
});

describe("expandAnnotations", () => {
  it("「同时算进」各展开一行，时间标签与主条相同；歌词没有时间轴时为空", () => {
    const occurrences = expandAnnotations(
      [
        {
          song_id: 1,
          version_id: 11,
          imagery_id: 1,
          motif_id: 10,
          part_motif_ids: [20],
        },
        {
          song_id: 2,
          version_id: 12,
          imagery_id: 2,
          motif_id: 30,
          part_motif_ids: null,
        },
      ],
      new Map([
        [11, "[00:01.00]一身风雨\n[00:02.00]晴"],
        [12, "没有时间轴"],
      ]),
      new Map([
        [1, "风雨"],
        [2, "明月"],
      ]),
    );
    expect(occurrences).toEqual([
      { song_id: 1, imagery_id: 1, motif_id: 10, lyric_timetag: ["00:01.00"] },
      { song_id: 1, imagery_id: 1, motif_id: 20, lyric_timetag: ["00:01.00"] },
      { song_id: 2, imagery_id: 2, motif_id: 30, lyric_timetag: [] },
    ]);
  });
});

describe("checkConsistency", () => {
  const imagery = [
    { id: 1, name: "风雨" },
    { id: 2, name: "白发" },
    { id: 3, name: "孤灯" },
    { id: 4, name: "新词" },
    { id: 5, name: "发" },
  ];
  const motifs = [
    { imagery_id: 1, motif_id: 10, role: "primary" as const },
    { imagery_id: 1, motif_id: 11, role: "part" as const },
    { imagery_id: 2, motif_id: 20, role: "primary" as const },
    { imagery_id: 3, motif_id: 30, role: "primary" as const },
    { imagery_id: 5, motif_id: 20, role: "primary" as const },
  ];
  const songs = [
    {
      id: 100,
      lyrics: "[00:01.00]一身风雨\n[00:03.00]白发三千丈\n[00:04.00]风雨又起",
    },
  ];
  const occ = (id: number, imagery_id: number, motif_id: number) => ({
    id,
    song_id: 100,
    imagery_id,
    motif_id,
  });

  const report = checkConsistency({
    imagery,
    motifs,
    songs,
    occurrences: [
      occ(1, 1, 10),
      occ(2, 2, 20),
      // 孤灯挂在登记之外的母题上，且歌词里没有
      occ(3, 3, 99),
      // 「发」只出现在同曲更长的标注词「白发」里
      occ(4, 5, 20),
    ],
  });

  it("报告没有默认母题的词、登记之外的母题", () => {
    expect(report.noPrimary).toEqual([{ id: 4, name: "新词" }]);
    expect(report.offCandidate).toEqual([3]);
  });

  it("报告歌词里找不到的词，含只出现在更长标注词里的", () => {
    expect(report.notFound).toEqual([
      { occurrenceId: 3, songId: 100, name: "孤灯" },
      { occurrenceId: 4, songId: 100, name: "发" },
    ]);
  });
});
