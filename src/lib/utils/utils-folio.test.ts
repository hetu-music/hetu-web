import { describe, it, expect } from "vitest";
import { buildFolio, markLines, parseNotes, pickExcerpt } from "./utils-folio";

/** parseNotes 的非空版本：用例里的备注都不为空 */
function notesOf(text: string) {
  const notes = parseNotes(text);
  if (!notes) throw new Error("parseNotes 意外返回 null");
  return notes;
}

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

  it("以歌名开头的标题行（横杠无空格、只有歌名、全半角括号不同）", () => {
    for (const [first, title] of [
      ["偷个闲-河图", "偷个闲"],
      ["陌上花早", "陌上花早"],
      ["偷个闲(DJ 版)-河图", "偷个闲（DJ版）"],
      ["which heaven is mine", "Which Heaven is Mine"],
    ]) {
      const folio = buildFolio(
        `[00:00.00]${first}\n[00:02.00]作词：某某\n[00:20.00]第一句`,
        { title },
      );
      expect(folio.credits).toEqual([{ role: "作词", names: "某某" }]);
      expect(folio.lines.map((l) => l.text)).toEqual(["第一句"]);
    }
  });

  it("署名区里夹着或跟着的声明归入版记", () => {
    const folio = buildFolio(
      [
        "[00:00.00]风月叩关河-墨明棋妙/河图",
        "[00:03.99]作词: 东方千月",
        "[00:05.00]歌曲版权归某某所有，仅开放翻唱授权",
        "[00:07.00]混音/和声: 小吴太太",
        "[00:19.97]-墨明棋妙二十周年纪念专辑《墨明棋妙这个村》Track01-",
        "[00:21.97]「版权所有未经许可请勿翻唱」",
        "[00:23.97]我守着城池残破",
      ].join("\n"),
      { title: "风月叩关河" },
    );
    expect(folio.credits.map((c) => c.role)).toEqual(["作词", "混音/和声"]);
    expect(folio.notices).toHaveLength(3);
    expect(folio.lines.map((l) => l.text)).toEqual(["我守着城池残破"]);
  });

  it("署名中间重复的歌名略过，同一角色只留第一次", () => {
    const folio = buildFolio(
      [
        "[00:00.00]作词 : 择荇",
        "[00:00.81]一笑相逢在翠微",
        "[00:03.56]演唱：河图、少司命",
        "[00:06.55]作词：择荇",
        "[00:10.62]司：",
        "[00:15.84]就定于鳞羽竞渡的仲春，",
      ].join("\n"),
      { title: "一笑相逢在翠微" },
    );
    expect(folio.credits).toEqual([
      { role: "作词", names: "择荇" },
      { role: "演唱", names: "河图、少司命" },
    ]);
    expect(folio.notices).toEqual([]);
    expect(folio.lines[0].text).toBe("司：");
  });

  it("没有署名时，形似声明的首句仍是歌词", () => {
    const folio = buildFolio("[00:01.00]「春风十里」\n[00:04.00]不如你", {
      title: "某歌",
    });
    expect(folio.lines.map((l) => l.text)).toEqual(["「春风十里」", "不如你"]);
    expect(folio.notices).toEqual([]);
  });

  it("手动指定歌词起点：此前全算署名区，有冒号的是署名，其余是声明", () => {
    const folio = buildFolio(
      [
        "[00:00.00]某歌 - 河图",
        "[00:02.00]词：某某",
        "[00:04.00]本曲献给某某",
        "[00:06.00]男：第一句",
        "[00:09.00]女：第二句",
      ].join("\n"),
      { title: "某歌", lyricsStart: "00:06.00" },
    );
    expect(folio.credits).toEqual([{ role: "词", names: "某某" }]);
    expect(folio.notices).toEqual(["本曲献给某某"]);
    expect(folio.lines.map((l) => l.text)).toEqual([
      "男：第一句",
      "女：第二句",
    ]);
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

  it("去掉句末与各短语末尾的标点，保留成对符号", () => {
    const { lines } = buildFolio(
      "[00:01.00]寄情山水悠长， 四时变幻。\n[00:04.00]读罢《离骚》！",
    );
    const marked = markLines(lines, [
      { id: 1, name: "山水", timetags: ["00:01.00"] },
    ]);
    expect(pickExcerpt(lines, marked)).toBe("寄情山水悠长 四时变幻");
    expect(pickExcerpt(lines.slice(1), marked.slice(1))).toBe("读罢《离骚》");
  });

  it("列数或单列字数超出竖排限制的句子不选", () => {
    const { lines } = buildFolio(
      [
        "[00:01.00]无妨愿者上钩随其缘且看", // 单列 11 字
        "[00:04.00]一 二 三 四", // 4 列
        "[00:07.00]钟爱枕草听牧笛 放鹤归山",
      ].join("\n"),
    );
    const marked = markLines(lines, [
      { id: 1, name: "钩", timetags: ["00:01.00"] },
      { id: 2, name: "二", timetags: ["00:04.00"] },
    ]);
    expect(pickExcerpt(lines, marked)).toBe("钟爱枕草听牧笛 放鹤归山");
  });

  it("没有标注时取第一句长度合适的歌词", () => {
    const { lines } = buildFolio("[00:01.00]啊\n[00:04.00]春风十里");
    expect(pickExcerpt(lines, markLines(lines, []))).toBe("春风十里");
  });
});

describe("parseNotes", () => {
  it("按空行分段，段内换行保留，落款行单独标出", () => {
    const notes = notesOf(
      "山海为证，青鸟为引，指向瑶宫去\r\n-记《穆天子传》西王母 周穆王\r\n\r\n《说书先生·上》是原创音乐合辑。",
    );
    expect(notes.paragraphs).toEqual([
      [
        { text: "山海为证，青鸟为引，指向瑶宫去", signature: false },
        { text: "-记《穆天子传》西王母 周穆王", signature: true },
      ],
      [{ text: "《说书先生·上》是原创音乐合辑。", signature: false }],
    ]);
  });

  it("接在句末的落款拆成单独一行", () => {
    const notes = notesOf(
      [
        "人间天上明月照，也照滩涂生荒草。2025年最后一首歌。 ——Finale",
        "诗言意 歌长言 神人以和。 -- 《史记·五帝本纪》",
        "表面冰冷，内中滚烫——暮日流年",
      ].join("\n"),
    );
    expect(notes.paragraphs[0]).toEqual([
      {
        text: "人间天上明月照，也照滩涂生荒草。2025年最后一首歌。",
        signature: false,
      },
      { text: "——Finale", signature: true },
      { text: "诗言意 歌长言 神人以和。", signature: false },
      { text: "-- 《史记·五帝本纪》", signature: true },
      { text: "表面冰冷，内中滚烫", signature: false },
      { text: "——暮日流年", signature: true },
    ]);
  });

  it("正文里的破折号不当作落款", () => {
    const lines = [
      "——她告诉我，我所在的世界，只是一本书。",
      "——以歌咏志，以音诉情——",
      "“杉木橹啊——”",
      "中日音乐合辑——",
      "陈鹏杰——重量级国风歌手倾情加盟。",
      "为大家带来的第四张音乐CD——《NL不分》",
    ];
    const notes = notesOf(lines.join("\n"));
    expect(notes.paragraphs[0]).toEqual(
      lines.map((text) => ({ text, signature: false })),
    );
  });

  it("独占一行的落款", () => {
    const notes = notesOf("——《天岁城志·墨离传》\n——Finale楼");
    expect(notes.paragraphs[0].every((l) => l.signature)).toBe(true);
  });

  it("字数不计落款与空白", () => {
    const notes = notesOf("春风 十里\n\n——某某");
    expect(notes.length).toBe(4);
  });

  it("空备注返回 null", () => {
    expect(parseNotes("  \r\n ")).toBeNull();
    expect(parseNotes(null)).toBeNull();
  });
});
