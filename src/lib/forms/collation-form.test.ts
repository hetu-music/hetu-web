import { describe, expect, it } from "vitest";
import { collationInputSchema, supplementInputSchema } from "./collation-form";

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
