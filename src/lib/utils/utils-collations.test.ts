import { describe, expect, it } from "vitest";
import type { SongCollation } from "@/lib/types";
import { collationInputSchema, resolveCollations } from "./utils-collations";
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
    quote: "苍山",
    sung: "沧山",
    body: "",
    collator: "某某",
    reviser: null,
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
    // 一行有两条时，句旁的「校」指向第一条
    expect([...byLine]).toEqual([
      [1, 2],
      [3, 4],
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
