import { describe, expect, it } from "vitest";
import {
  readArray,
  readFlag,
  readInt,
  toSearchString,
  readLiteral,
  readString,
  writeArray,
  writeFlag,
  writeInt,
  writeString,
} from "./url-params";

const p = (s: string) => new URLSearchParams(s);

describe("toSearchString", () => {
  it("服务端页面的 searchParams 转成查询串，数组按重复参数", () => {
    expect(toSearchString({})).toBe("");
    expect(toSearchString({ tab: undefined })).toBe("");
    const search = toSearchString({ q: "明月 心", artist: ["司夏", "河图"] });
    expect(search.startsWith("?")).toBe(true);
    const back = p(search);
    expect(back.get("q")).toBe("明月 心");
    expect(back.getAll("artist")).toEqual(["司夏", "河图"]);
  });
});

describe("url-params", () => {
  it("字符串：读不到用默认值，等于默认值时不写", () => {
    expect(readString(p(""), "q")).toBe("");
    expect(readString(p("type=原创"), "type", "全部")).toBe("原创");
    const d = p("type=原创");
    writeString(d, "type", "全部", "全部");
    expect(d.has("type")).toBe(false);
  });

  it("整数：不合法时用默认值", () => {
    expect(readInt(p("page=3"), "page", 1)).toBe(3);
    expect(readInt(p("page=abc"), "page", 1)).toBe(1);
    expect(readInt(p("page=2.5"), "page", 1)).toBe(1);
    const d = p("page=3");
    writeInt(d, "page", 1, 1);
    expect(d.toString()).toBe("");
  });

  it("固定取值：不在范围内时用默认值", () => {
    const views = ["grid", "list"] as const;
    expect(readLiteral(p("view=list"), "view", views, "grid")).toBe("list");
    expect(readLiteral(p("view=table"), "view", views, "grid")).toBe("grid");
  });

  it("布尔值存成 1", () => {
    const d = p("");
    writeFlag(d, "advanced", true);
    expect(d.toString()).toBe("advanced=1");
    expect(readFlag(d, "advanced")).toBe(true);
    writeFlag(d, "advanced", false);
    expect(d.toString()).toBe("");
  });

  it("字符串数组按重复参数存，名字里的逗号、&、= 都不会切错", () => {
    const d = p("");
    writeArray(d, "artist", ["司夏", "A,B", "甲&乙=丙", "司夏", ""]);
    expect(d.getAll("artist")).toEqual(["司夏", "A,B", "甲&乙=丙"]);
    const roundTrip = p(d.toString());
    expect(readArray(roundTrip, "artist")).toEqual(["司夏", "A,B", "甲&乙=丙"]);
  });

  it("写空数组就是去掉这个参数", () => {
    const d = p("artist=司夏&artist=李萌&q=x");
    writeArray(d, "artist", []);
    expect(d.toString()).toBe("q=x");
  });
});
