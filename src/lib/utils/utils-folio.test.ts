import { describe, it, expect } from "vitest";
import { buildFolio, markLines, parseNotes, pickExcerpt } from "./utils-folio";

const LRC = [
  "[ti:闲看波澜生]",
  "[00:00.00]闲看波澜生 - 河图",
  "[00:02.55]词：冥凰",
  "[00:05.09]混音/母带：啊鲤",
  "[00:30.62]我搁苍山一柄剑",
  "[00:33.64]收尽洱海水千叠",
  "[00:37.20]飞花纷蝶欲迷眼",
  "[00:40.14]轻舟拢岸归鄙野",
  "[01:05.00]我搁苍山一柄剑",
].join("\n");

describe("buildFolio", () => {
  it("抽走标题行与署名行，正文从第一句歌词开始", () => {
    const folio = buildFolio(LRC);
    expect(folio.credits).toEqual([
      { role: "词", names: "冥凰" },
      { role: "混音/母带", names: "啊鲤" },
    ]);
    expect(folio.lines[0].text).toBe("我搁苍山一柄剑");
    expect(folio.lines).toHaveLength(5);
  });

  it("长间奏处分段，常规行距不分段", () => {
    const folio = buildFolio(LRC);
    expect(folio.lines.map((l) => l.stanzaStart)).toEqual([
      false,
      false,
      false,
      false,
      true,
    ]);
  });

  it("没有时间戳的歌词按空行分段", () => {
    const folio = buildFolio("第一句\n第二句\n\n第三句");
    expect(folio.lines.map((l) => [l.text, l.stanzaStart])).toEqual([
      ["第一句", false],
      ["第二句", false],
      ["第三句", true],
    ]);
    expect(folio.lines[0].time).toBeNull();
  });

  it("正文中间出现的冒号句不当作署名", () => {
    const folio = buildFolio("[00:01.00]春风起\n[00:04.00]他说：归来");
    expect(folio.credits).toEqual([]);
    expect(folio.lines).toHaveLength(2);
  });
});

describe("markLines", () => {
  const { lines } = buildFolio(LRC);

  it("按时间标签定位，并标上同文的重复句", () => {
    const marked = markLines(lines, [
      { id: 1, name: "苍山", timetags: ["00:30.62"] },
    ]);
    expect(marked[0].ids).toEqual([1]);
    expect(marked[4].ids).toEqual([1]);
    expect(marked[1].ids).toEqual([]);
    expect(marked[0].segments).toEqual([
      { text: "我搁", ids: [] },
      { text: "苍山", ids: [1] },
      { text: "一柄剑", ids: [] },
    ]);
  });

  it("意象名不原样出现时取最长的共同子串", () => {
    const marked = markLines(lines, [
      { id: 2, name: "刀剑", timetags: ["00:30.62"] },
    ]);
    expect(marked[0].segments.at(-1)).toEqual({ text: "剑", ids: [2] });
  });

  it("行内找不到对应文字时仍记在行上", () => {
    const marked = markLines(lines, [
      { id: 3, name: "隐逸", timetags: ["00:40.14"] },
    ]);
    expect(marked[3].ids).toEqual([3]);
    expect(marked[3].segments).toEqual([{ text: "轻舟拢岸归鄙野", ids: [] }]);
  });

  it("没有可用时间标签时按意象名搜全文", () => {
    const marked = markLines(lines, [{ id: 4, name: "飞花", timetags: [] }]);
    expect(marked.map((m) => m.ids.length)).toEqual([0, 0, 1, 0, 0]);
  });

  it("同一段文字承载多个意象时合并在一起", () => {
    const marked = markLines(lines, [
      { id: 5, name: "洱海", timetags: ["00:33.64"] },
      { id: 6, name: "海水", timetags: ["00:33.64"] },
    ]);
    expect(marked[1].segments).toEqual([
      { text: "收尽", ids: [] },
      { text: "洱", ids: [5] },
      { text: "海", ids: [5, 6] },
      { text: "水", ids: [6] },
      { text: "千叠", ids: [] },
    ]);
  });
});

describe("pickExcerpt", () => {
  it("取意象最多的一句，同分取靠前者", () => {
    const { lines } = buildFolio(LRC);
    const marked = markLines(lines, [
      { id: 1, name: "飞花", timetags: ["00:37.20"] },
      { id: 2, name: "蝶", timetags: ["00:37.20"] },
      { id: 3, name: "舟", timetags: ["00:40.14"] },
    ]);
    expect(pickExcerpt(lines, marked)).toBe("飞花纷蝶欲迷眼");
  });

  it("没有标注时取第一句长度合适的歌词", () => {
    const { lines } = buildFolio("[00:01.00]啊\n[00:04.00]春风十里");
    expect(pickExcerpt(lines, markLines(lines, []))).toBe("春风十里");
  });
});

describe("parseNotes", () => {
  it("首段短句带落款时作题词", () => {
    const notes = parseNotes(
      "山海为证，青鸟为引，指向瑶宫去\r\n-记《穆天子传》西王母 周穆王\r\n\r\n《说书先生·上》是原创音乐合辑。",
    )!;
    expect(notes.epigraph).toEqual([
      { text: "山海为证，青鸟为引，指向瑶宫去", signature: false },
      { text: "-记《穆天子传》西王母 周穆王", signature: true },
    ]);
    expect(notes.paragraphs).toHaveLength(1);
  });

  it("首段较长时不提题词，段内换行保留", () => {
    const long = "梦里常看到幼时玩耍的那条老酒街，".repeat(4);
    const notes = parseNotes(`${long}\n第二行\n\n——某某`)!;
    expect(notes.epigraph).toBeNull();
    expect(notes.paragraphs[0].map((l) => l.text)).toEqual([long, "第二行"]);
    expect(notes.paragraphs[1]).toEqual([{ text: "——某某", signature: true }]);
  });

  it("只有一段的短备注整段作题词", () => {
    const notes = parseNotes("我要千金散尽赴酒盏 落日流霞烧不完")!;
    expect(notes.epigraph).not.toBeNull();
    expect(notes.paragraphs).toEqual([]);
    expect(notes.length).toBe(0);
  });

  it("空备注返回 null", () => {
    expect(parseNotes("  \r\n ")).toBeNull();
    expect(parseNotes(null)).toBeNull();
  });
});
