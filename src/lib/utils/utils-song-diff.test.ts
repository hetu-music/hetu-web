import { describe, expect, it } from "vitest";
import {
  diffSongFields,
  isPendingPublish,
  publishStatusOf,
} from "./utils-song-diff";

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
  it("按工作版本上的三个状态列区分四种状态", () => {
    const flags = (is_live: boolean, has_draft: boolean, ever: boolean) => ({
      is_live,
      has_draft,
      ever_published: ever,
    });
    expect(publishStatusOf(flags(false, true, false))).toBe("unpublished");
    expect(publishStatusOf(flags(true, true, true))).toBe("changed");
    expect(publishStatusOf(flags(true, false, true))).toBe("published");
    expect(publishStatusOf(flags(false, false, true))).toBe("withdrawn");
    // 下架后又开了草稿：仍是下架，发布即带着新改动重新上线
    expect(publishStatusOf(flags(false, true, true))).toBe("withdrawn");
  });

  it("等着发布的只有从没发布过的和线上有草稿的", () => {
    expect(isPendingPublish("unpublished")).toBe(true);
    expect(isPendingPublish("changed")).toBe(true);
    expect(isPendingPublish("published")).toBe(false);
    expect(isPendingPublish("withdrawn")).toBe(false);
  });
});
