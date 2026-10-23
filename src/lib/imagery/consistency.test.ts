import { describe, expect, it } from "vitest";
import { checkConsistency, linesForWord } from "./consistency";
import { parseLrcLines } from "./suggest";

describe("linesForWord", () => {
  const lines = parseLrcLines(
    "[00:01.00]明月照我\n[00:02.00]岁月如月\n[00:03.00]岁月长\n[00:04.00]Moonlight",
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

  it("没有更长的标注词时，所有字面出现的行都算；英文不分大小写", () => {
    expect(linesForWord(lines, "月", ["月"])).toEqual([
      "00:01.00",
      "00:02.00",
      "00:03.00",
    ]);
    expect(linesForWord(lines, "moonlight", [])).toEqual(["00:04.00"]);
  });
});

describe("checkConsistency", () => {
  const imagery = [
    { id: 1, name: "风雨" },
    { id: 2, name: "白发" },
    { id: 3, name: "孤灯" },
    { id: 4, name: "新词" },
  ];
  const motifs = [
    { imagery_id: 1, category_id: 10, role: "primary" as const },
    { imagery_id: 1, category_id: 11, role: "part" as const },
    { imagery_id: 2, category_id: 20, role: "primary" as const },
    { imagery_id: 3, category_id: 30, role: "primary" as const },
  ];
  const songs = [
    {
      id: 100,
      lyrics:
        "[00:01.00]一身风雨\n[00:02.00]雪吹满鬓发\n[00:03.00]白发三千丈\n[00:04.00]风雨又起",
    },
  ];
  const occ = (
    id: number,
    imagery_id: number,
    category_id: number,
    lyric_timetag: string[],
  ) => ({ id, song_id: 100, imagery_id, category_id, lyric_timetag });

  const report = checkConsistency({
    imagery,
    motifs,
    songs,
    occurrences: [
      // 风雨挂了默认母题却缺并列组成；漏标了第二次出现的行
      occ(1, 1, 10, ["00:01.00"]),
      // 白发：有意标在「雪吹满鬓发」上，另有一个歌词里已不存在的旧标签
      occ(2, 2, 20, ["00:02.00", "00:03.00", "00:09.99"]),
      // 孤灯挂在登记之外的母题上，且歌词里没有
      occ(3, 3, 99, ["00:01.00"]),
    ],
  });

  it("报告没有默认母题的词、登记之外的母题、缺的并列组成", () => {
    expect(report.noPrimary).toEqual([{ id: 4, name: "新词" }]);
    expect(report.offCandidate).toEqual([3]);
    expect(report.missingParts).toEqual([
      { songId: 100, imageryId: 1, categoryId: 11 },
    ]);
  });

  it("修复只补漏标的行、去掉不存在的标签，引申标注保留并单独列出", () => {
    const byId = new Map(report.timetags.map((t) => [t.occurrenceId, t]));
    expect(byId.get(1)).toMatchObject({
      missing: ["00:04.00"],
      stale: [],
      offLine: [],
      fixed: ["00:01.00", "00:04.00"],
      notFound: false,
    });
    expect(byId.get(2)).toMatchObject({
      missing: [],
      stale: ["00:09.99"],
      offLine: ["00:02.00"],
      fixed: ["00:02.00", "00:03.00"],
    });
    expect(byId.get(3)).toMatchObject({
      notFound: true,
      offLine: ["00:01.00"],
    });
  });
});
