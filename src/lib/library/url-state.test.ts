import { describe, expect, it } from "vitest";
import { FILTER_OPTION_ALL } from "@/lib/constants";
import { ALL_SELECTED, NO_SELECTION } from "./filters";
import {
  clearFilters,
  parseLibraryUrl,
  writeFacet,
  writePage,
  writeType,
  writeYear,
} from "./url-state";

const parse = (s: string) => parseLibraryUrl(new URLSearchParams(s));

describe("parseLibraryUrl", () => {
  it("什么都不带就是默认状态", () => {
    const state = parse("");
    expect(state).toMatchObject({
      query: "",
      type: FILTER_OPTION_ALL,
      year: null,
      view: "grid",
      page: 1,
      advanced: false,
    });
    expect(
      Object.values(state.facets).every((f) => f.values.length === 0),
    ).toBe(true);
  });

  it("人名按归一化后的简体读：繁体页的链接在简体页一样能用", () => {
    expect(parse("artist=河圖&artist=Finale").facets.artist).toEqual({
      mode: "include",
      values: ["河图", "finale"],
    });
  });

  it("排除用单独的参数名", () => {
    expect(parse("artistNot=河图").facets.artist).toEqual({
      mode: "exclude",
      values: ["河图"],
    });
  });

  it("名字以 ! 或 - 开头时不会被误读", () => {
    expect(parse("artist=!某人&lyricist=-某人").facets).toMatchObject({
      artist: { mode: "include", values: ["某人"] },
      lyricist: { mode: "include", values: ["某人"] },
    });
  });

  it("包含和排除都写了时以包含为准", () => {
    expect(parse("artist=司夏&artistNot=河图").facets.artist).toEqual({
      mode: "include",
      values: ["司夏"],
    });
  });

  it("旧格式不再识别，按不带参数处理", () => {
    const state = parse("yearStart=2&yearEnd=5&artist=*");
    expect(state.year).toBeNull();
    // 「*」归一化后是空串，丢掉
    expect(state.facets.artist).toEqual(NO_SELECTION);
  });

  it("页码不合法时回到第一页", () => {
    expect(parse("page=0").page).toBe(1);
    expect(parse("page=abc").page).toBe(1);
  });
});

describe("写地址栏", () => {
  it("全选和不选都不写", () => {
    const d = new URLSearchParams("artist=河图&page=2");
    writeFacet(d, "artist", ALL_SELECTED);
    expect(d.toString()).toBe("page=2");
    writeFacet(d, "artist", NO_SELECTION);
    expect(d.toString()).toBe("page=2");
  });

  it("包含、排除各写各的参数，互相清掉", () => {
    const d = new URLSearchParams("artistNot=河图");
    writeFacet(d, "artist", { mode: "include", values: ["司夏", "李萌"] });
    expect(d.getAll("artist")).toEqual(["司夏", "李萌"]);
    expect(d.has("artistNot")).toBe(false);
  });

  it("往返不变", () => {
    const d = new URLSearchParams();
    writeType(d, "原创");
    writeYear(d, { from: null, to: 2015 });
    writeFacet(d, "genre", { mode: "include", values: ["古风"] });
    writeFacet(d, "artist", { mode: "exclude", values: ["河图"] });
    writePage(d, 3);
    const state = parseLibraryUrl(new URLSearchParams(d.toString()));
    expect(state).toMatchObject({
      type: "原创",
      year: { from: null, to: 2015 },
      page: 3,
    });
    expect(state.facets.genre).toEqual({ mode: "include", values: ["古风"] });
    expect(state.facets.artist).toEqual({ mode: "exclude", values: ["河图"] });
  });

  it("清空筛选时保留视图", () => {
    const d = new URLSearchParams(
      "q=天下&type=原创&year=-2015&artist=河图&lyricistNot=x&page=2&advanced=1&view=list",
    );
    clearFilters(d);
    expect(d.toString()).toBe("view=list");
  });
});
