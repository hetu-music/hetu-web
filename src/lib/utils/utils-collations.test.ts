import { describe, expect, it } from "vitest";
import type { SongCollation } from "@/lib/types";
import {
  collationInputSchema,
  resolveCollations,
  sortSupplements,
  summarizeRevisers,
  supplementInputSchema,
  willSignAsReviser,
} from "./utils-collations";
import { buildFolio } from "./utils-folio";

const { lines } = buildFolio(
  [
    "[00:10.00]我搁苍山一柄剑",
    "[00:14.00]收尽洱海水千叠",
    "[00:40.00]我搁苍山一柄剑",
    "[00:44.00]轻舟拢岸归鄙野",
  ].join("\n"),
);
const ctx = { lines, paragraphs: [] };

function collation(overrides: Partial<SongCollation>): SongCollation {
  return {
    id: 1,
    anchor: "lyrics",
    anchorIndex: 0,
    anchorTime: 10,
    anchorQuote: "我搁苍山一柄剑",
    kind: "slip",
    date: null,
    quote: "苍山",
    sung: "沧山",
    body: "",
    collator: "某某",
    revisers: [],
    ...overrides,
  };
}

describe("resolveCollations", () => {
  it("按行排，同一行按录入先后，找不回原句的排最后", () => {
    const { entries, byLine } = resolveCollations(
      [
        collation({ id: 5, anchorQuote: "已删掉的一句" }),
        collation({
          id: 4,
          anchorIndex: 3,
          anchorTime: 44,
          anchorQuote: "轻舟拢岸归鄙野",
        }),
        collation({
          id: 3,
          anchorIndex: 1,
          anchorTime: 14,
          anchorQuote: "收尽洱海水千叠",
        }),
        collation({
          id: 2,
          anchorIndex: 1,
          anchorTime: 14,
          anchorQuote: "收尽洱海水千叠",
        }),
      ],
      ctx,
    );
    expect(entries.map((e) => [e.collation.id, e.line])).toEqual([
      [2, 1],
      [3, 1],
      [4, 3],
      [5, null],
    ]);
    // 找不回原句的不写到句下
    expect(
      [...byLine].map(([line, list]) => [line, list.map((c) => c.id)]),
    ).toEqual([
      [1, [2, 3]],
      [3, [4]],
    ]);
  });

  it("重复的句子按时间找回原来那一处", () => {
    const { entries } = resolveCollations(
      [collation({ anchorIndex: 0, anchorTime: 40 })],
      ctx,
    );
    expect(entries[0].line).toBe(2);
  });
});

describe("collationInputSchema", () => {
  const base = {
    kind: "slip" as const,
    anchor_index: 0,
    anchor_time: 10,
    anchor_quote: "我搁苍山一柄剑",
  };

  it("空白的原文、实唱存成 null", () => {
    const parsed = collationInputSchema.parse({
      ...base,
      quote: "  ",
      sung: "",
      body: " 现场版 ",
    });
    expect(parsed).toMatchObject({ quote: null, sung: null, body: "现场版" });
  });

  it("有实唱必有原文", () => {
    const result = collationInputSchema.safeParse({
      ...base,
      quote: "",
      sung: "沧山",
      body: "",
    });
    expect(result.success).toBe(false);
  });

  it("实唱与说明至少一项", () => {
    const result = collationInputSchema.safeParse({
      ...base,
      quote: "苍山",
      sung: "",
      body: "",
    });
    expect(result.success).toBe(false);
  });
});

describe("supplementInputSchema", () => {
  it("日期可只到年或年月，空的存成 null", () => {
    for (const date of ["2019", "2019-08", "2019-08-15"]) {
      expect(
        supplementInputSchema.parse({ kind: "release", date, body: "现场版" })
          .date,
      ).toBe(date);
    }
    expect(
      supplementInputSchema.parse({ kind: "draft", date: " ", body: "旧文案" })
        .date,
    ).toBeNull();
  });

  it("日期格式不对、内容为空都不收", () => {
    expect(
      supplementInputSchema.safeParse({
        kind: "release",
        date: "2019/08",
        body: "现场版",
      }).success,
    ).toBe(false);
    expect(
      supplementInputSchema.safeParse({ kind: "note", date: null, body: "  " })
        .success,
    ).toBe(false);
  });
});

describe("sortSupplements", () => {
  it("按日期排，只到年的在该年最前，没有日期的排最后", () => {
    const sorted = sortSupplements([
      collation({ id: 1, anchor: "song", kind: "note", date: null }),
      collation({ id: 2, anchor: "song", kind: "release", date: "2020-03" }),
      collation({ id: 3, anchor: "song", kind: "release", date: "2019-08-15" }),
      collation({ id: 4, anchor: "song", kind: "draft", date: "2019" }),
      collation({ id: 5, anchor: "song", kind: "note", date: null }),
    ]);
    expect(sorted.map((c) => c.id)).toEqual([4, 3, 2, 1, 5]);
  });
});

describe("summarizeRevisers", () => {
  it("三人以内全列，再多只列首尾两人并给总数", () => {
    expect(summarizeRevisers([])).toBeNull();
    expect(summarizeRevisers(["乙", "丙", "丁"])).toEqual({
      names: "乙、丙、丁",
      count: null,
    });
    expect(summarizeRevisers(["乙", "丙", "丁", "戊"])).toEqual({
      names: "乙、戊",
      count: 4,
    });
  });
});

describe("willSignAsReviser", () => {
  it("校者本人、已在名单里的不再提示", () => {
    const c = collation({ collator: "甲", revisers: ["乙"] });
    expect(willSignAsReviser(c, "甲")).toBe(false);
    expect(willSignAsReviser(c, "乙")).toBe(false);
    expect(willSignAsReviser(c, "丙")).toBe(true);
    expect(willSignAsReviser(c, undefined)).toBe(false);
  });
});
