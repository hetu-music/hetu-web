import { describe, expect, it } from "vitest";
import { diffSongFields, publishStatusOf } from "./utils-song-diff";

describe("diffSongFields", () => {
  it("没发布过时不列字段", () => {
    expect(diffSongFields({ title: "a" }, null)).toEqual([]);
  });

  it("空串、空数组与 null 视为相同", () => {
    expect(
      diffSongFields(
        { title: "a", album: "", lyricist: [], comment: null },
        { title: "a", album: null, lyricist: null },
      ),
    ).toEqual([]);
  });

  it("列出不同的字段，按表单顺序", () => {
    expect(
      diffSongFields(
        { title: "b", lyrics: "[00:01.00]x", composer: ["甲", "乙"] },
        { title: "a", lyrics: "[00:01.00]x", composer: ["甲"] },
      ),
    ).toEqual(["title", "composer"]);
  });

  it("布尔值 false 与 null 不同", () => {
    expect(diffSongFields({ hascover: false }, { hascover: null })).toEqual([
      "hascover",
    ]);
  });
});

describe("publishStatusOf", () => {
  it("区分未发布、有改动与已发布", () => {
    expect(publishStatusOf({ title: "a" }, null)).toBe("unpublished");
    expect(publishStatusOf({ title: "a" }, { title: "b" })).toBe("changed");
    expect(publishStatusOf({ title: "a" }, { title: "a" })).toBe("published");
  });
});
