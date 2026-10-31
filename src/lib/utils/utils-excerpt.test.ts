import { describe, it, expect } from "vitest";
import { buildFolio, markLines } from "./utils-folio";
import { groupMarks, pickExcerpt, songExcerpt } from "./utils-excerpt";

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

  it("每句都放不进一列时，把意象最多的长句折成两列", () => {
    const { lines } = buildFolio(
      [
        "[00:01.00]绢帛里工笔被风干成标本",
        "[00:02.00]你睫毛下的湖泊结着薄冰",
        "[00:03.00]一二三四五六七八九十一二三四五六七八九",
      ].join("\n"),
    );
    const marked = markLines(lines, [
      { id: 1, name: "湖泊", timetags: ["00:02.00"] },
    ]);
    expect(pickExcerpt(lines, marked)).toBe("你睫毛下的 湖泊结着薄冰");
    // 超过两列容量的长句不折
    expect(pickExcerpt(lines.slice(2), marked.slice(2))).toBeNull();
  });

  it("有能直接放下的句子时不折长句", () => {
    const { lines } = buildFolio(
      "[00:01.00]你睫毛下的湖泊结着薄冰\n[00:02.00]春风十里",
    );
    expect(pickExcerpt(lines, markLines(lines, []))).toBe("春风十里");
  });

  it.each([
    // 断在虚词、方位词边界上，胜过正中间
    ["当碎瓷声割痛某个黎明", "当碎瓷声割痛 某个黎明"],
    ["怕惊动香炉旁你浅睡的倒影", "怕惊动香炉旁 你浅睡的倒影"],
    ["当月光在青瓷盏里苏醒", "当月光 在青瓷盏里苏醒"],
    // 不切开词语，助词跟着前面的动词
    ["像等待某个朝代跌入的蜻蜓", "像等待 某个朝代跌入的蜻蜓"],
    ["你鬓角还斜插着初唐的烟云", "你鬓角 还斜插着初唐的烟云"],
    // 繁体同样适用
    ["怕驚動香爐旁你淺睡的倒影", "怕驚動香爐旁 你淺睡的倒影"],
    // 几处边界都合适时取最靠中间的
    ["绢帛里工笔被风干成标本", "绢帛里工笔 被风干成标本"],
  ])("折句断在词语之间：%s", (line, expected) => {
    const { lines } = buildFolio(`[00:01.00]${line}`);
    expect(pickExcerpt(lines, markLines(lines, []))).toBe(expected);
  });
});

describe("songExcerpt", () => {
  it("与 buildFolio + markLines + pickExcerpt 结果一致", () => {
    const marks = [
      { id: 1, name: "飞花", timetags: ["00:37.20"] },
      { id: 3, name: "舟", timetags: ["00:40.14"] },
    ];
    const { lines } = buildFolio(LRC, { title: "闲看波澜生" });
    expect(songExcerpt(LRC, { title: "闲看波澜生", marks })).toBe(
      pickExcerpt(lines, markLines(lines, marks)),
    );
  });

  it("不传 marks 时取第一句长度合适的歌词", () => {
    expect(songExcerpt(LRC)).toBe("我搁苍山一柄剑");
  });

  it("没有歌词时返回 null", () => {
    expect(songExcerpt(null)).toBeNull();
    expect(songExcerpt("")).toBeNull();
  });
});

describe("groupMarks", () => {
  it("按歌分组，一个词一条，时间标签取并集", () => {
    const marks = groupMarks(
      [
        { song_id: 1, imagery_id: 7, lyric_timetag: ["00:01.00"] },
        { song_id: 1, imagery_id: 7, lyric_timetag: ["00:01.00", "00:05.00"] },
        { song_id: 1, imagery_id: 8, lyric_timetag: null },
        { song_id: 2, imagery_id: 7, lyric_timetag: ["00:09.00"] },
      ],
      [
        { id: 7, name: "灯火" },
        { id: 8, name: "月" },
      ],
    );
    expect(marks.get(1)).toEqual([
      { id: 7, name: "灯火", timetags: ["00:01.00", "00:05.00"] },
      { id: 8, name: "月", timetags: [] },
    ]);
    expect(marks.get(2)).toEqual([
      { id: 7, name: "灯火", timetags: ["00:09.00"] },
    ]);
  });

  it("词表里找不到名字的标注不要", () => {
    const marks = groupMarks(
      [{ song_id: 1, imagery_id: 9, lyric_timetag: ["00:01.00"] }],
      [],
    );
    expect(marks.get(1)).toBeUndefined();
  });
});
