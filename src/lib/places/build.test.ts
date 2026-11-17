import { describe, expect, it } from "vitest";
import { buildPlaces, type PlaceSong } from "@/lib/places/build";

const line = (text: string, time: number | null = null) => ({
  text,
  time,
  stanzaStart: false,
});

const songs = new Map<number, PlaceSong>([
  [
    10,
    {
      title: "落笔生花",
      lines: [line("开头", 1), line("我欲文风昌盛", 5), line("满庭芳华", 9)],
    },
  ],
  [20, { title: "唱给你的歌", lines: [line("诺言都兑现", 3)] }],
  [30, { title: "改过词", lines: [line("新的一句")] }],
]);

const places = [
  { id: 1, name: "文昌阁", full_name: null, region: "北京" },
  { id: 2, name: "鸟巢", full_name: "鸟巢国家体育场", region: "北京" },
  { id: 3, name: "没人写", full_name: null, region: "某地" },
  { id: 4, name: "某处", full_name: null, region: "某地" },
];

const row = {
  anchor_index: null,
  anchor_time: null,
  anchor_quote: null,
  note: null,
} as const;

describe("buildPlaces", () => {
  it("把引句定位到正文的句子，按次序排列，备注取第一条", () => {
    const result = buildPlaces(
      places,
      [
        {
          ...row,
          song_id: 10,
          place_id: 1,
          relation: "setting",
          anchor_index: 2,
          anchor_time: "9.000",
          anchor_quote: "满庭芳华",
        },
        {
          ...row,
          song_id: 10,
          place_id: 1,
          relation: "setting",
          // 改词后行号错位了，按引文仍找得到
          anchor_index: 0,
          anchor_quote: "我欲文风昌盛",
          note: "备注",
        },
      ],
      songs,
    );
    expect(result).toEqual([
      {
        id: 1,
        name: "文昌阁",
        fullName: null,
        region: "北京",
        entries: [
          {
            songId: 10,
            title: "落笔生花",
            relation: "setting",
            verses: [
              { index: 1, text: "我欲文风昌盛" },
              { index: 2, text: "满庭芳华" },
            ],
            note: "备注",
          },
        ],
      },
    ]);
  });

  it("演出场馆不引歌词；没有对应的地点、不在线上的歌不列", () => {
    const result = buildPlaces(
      places,
      [
        { ...row, song_id: 20, place_id: 2, relation: "venue", note: "现场" },
        { ...row, song_id: 99, place_id: 3, relation: "setting" },
      ],
      songs,
    );
    expect(result.map((p) => p.id)).toEqual([2]);
    expect(result[0].entries[0]).toMatchObject({
      relation: "venue",
      verses: [],
      note: "现场",
    });
  });

  it("引句在歌词里找不到时不显示这一句，歌仍列在地点下", () => {
    const result = buildPlaces(
      places,
      [
        {
          ...row,
          song_id: 30,
          place_id: 4,
          relation: "setting",
          anchor_index: 0,
          anchor_quote: "旧的一句",
        },
      ],
      songs,
    );
    expect(result[0].entries[0]).toMatchObject({ songId: 30, verses: [] });
  });

  it("文字按页面语言转换，定位用转换前的原文", () => {
    const result = buildPlaces(
      places,
      [
        {
          ...row,
          song_id: 10,
          place_id: 1,
          relation: "setting",
          anchor_index: 1,
          anchor_quote: "我欲文风昌盛",
        },
      ],
      songs,
      (s) => `「${s}」`,
    );
    expect(result[0].name).toBe("「文昌阁」");
    expect(result[0].entries[0].title).toBe("「落笔生花」");
    expect(result[0].entries[0].verses).toEqual([
      { index: 1, text: "「我欲文风昌盛」" },
    ]);
  });
});
