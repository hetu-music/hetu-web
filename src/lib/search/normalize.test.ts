import { describe, expect, it } from "vitest";
import T2S_PAIRS from "./t2s.json";
import {
  normalize,
  normalizeWithMap,
  splitQuery,
  toOriginalRange,
} from "./normalize";

describe("normalize", () => {
  it("去掉标点、空白和符号", () => {
    expect(normalize("七重纱衣，血溅了白纱！")).toBe("七重纱衣血溅了白纱");
    expect(normalize("雨碎江南·印象")).toBe("雨碎江南印象");
    expect(normalize("  宝宝 宝宝\u3000")).toBe("宝宝宝宝");
    expect(normalize("「如花」——《河图》")).toBe("如花河图");
  });

  it("去掉控制字符，保证 corpus 的分隔符不会出现在正文里", () => {
    expect(normalize("天\u0001下")).toBe("天下");
  });

  it("全角转半角，拉丁字母转小写", () => {
    expect(normalize("ＦＩＮＡＬＥ")).toBe("finale");
    expect(normalize("Finale")).toBe("finale");
    expect(normalize("５分１３秒")).toBe("5分13秒");
  });

  it("繁体逐字转简体", () => {
    expect(normalize("傾盡天下")).toBe("倾尽天下");
    expect(normalize("鴉鬢簪花")).toBe("鸦鬓簪花");
  });

  it("台湾字形也转回简体", () => {
    expect(normalize("啟")).toBe("启");
    expect(normalize("為")).toBe(normalize("爲"));
  });

  it("简体原样不动", () => {
    for (const text of ["什么", "吃饭", "才子", "床前明月光", "山峰"]) {
      expect(normalize(text)).toBe(text);
    }
  });

  it("逐字转换：长度不变", () => {
    const text = "長夜夢我，燈花佐酒";
    expect(normalize(text)).toHaveLength(
      normalize(text.replace(/，/, "")).length,
    );
    expect(normalize("長夜夢我")).toHaveLength(4);
  });

  it("繁转简表转一次就到底：转出来的字不会再被转", () => {
    const chars = [...(T2S_PAIRS as string)];
    const table = new Map<string, string>();
    for (let i = 0; i < chars.length; i += 2) table.set(chars[i], chars[i + 1]);
    for (const value of table.values()) {
      expect(table.has(value) && table.get(value) !== value).toBe(false);
    }
  });
});

describe("normalizeWithMap / toOriginalRange", () => {
  it("每个字对回原文的位置", () => {
    const original = "七重纱衣，血溅了白纱";
    const n = normalizeWithMap(original);
    expect(n.text).toBe("七重纱衣血溅了白纱");
    expect([...n.map]).toEqual([0, 1, 2, 3, 5, 6, 7, 8, 9]);
  });

  it("区间对回原文，中间被去掉的标点包含在内", () => {
    const original = "七重纱衣，血溅了白纱";
    const n = normalizeWithMap(original);
    const start = n.text.indexOf("纱衣血溅");
    const [from, to] = toOriginalRange(original, n, start, start + 4);
    expect(original.slice(from, to)).toBe("纱衣，血溅");
  });

  it("繁体原文：命中区间对回繁体的字", () => {
    const original = "她在燈下把墨研";
    const n = normalizeWithMap(original);
    const start = n.text.indexOf("灯下");
    const [from, to] = toOriginalRange(original, n, start, start + 2);
    expect(original.slice(from, to)).toBe("燈下");
  });

  it("代理对里的字整个对回去", () => {
    const original = "𠀀天下";
    const n = normalizeWithMap(original);
    expect(n.text).toBe("𠀀天下");
    const [from, to] = toOriginalRange(original, n, 0, 2);
    expect(original.slice(from, to)).toBe("𠀀");
  });
});

describe("splitQuery", () => {
  it("按空白分词，各自归一化", () => {
    expect(splitQuery("七重纱衣 血溅了白纱")).toEqual([
      "七重纱衣",
      "血溅了白纱",
    ]);
    expect(splitQuery("傾盡\u3000天下")).toEqual(["倾尽", "天下"]);
  });

  it("标点不分词，只是去掉", () => {
    expect(splitQuery("七重纱衣，血溅了白纱")).toEqual(["七重纱衣血溅了白纱"]);
  });

  it("去掉空的和重复的", () => {
    expect(splitQuery("  ")).toEqual([]);
    expect(splitQuery("，。 ！")).toEqual([]);
    expect(splitQuery("天下 天下 傾盡 倾尽")).toEqual(["天下", "倾尽"]);
  });
});
