import { describe, it, expect } from "vitest";
import { songFields } from "@/lib/constants";
import type {
  SongDetail,
  SongFieldConfig,
  SongFormFieldKey,
} from "@/lib/types";
import {
  getMissingFields,
  isCreatorFieldKey,
  isCriticalField,
  isFieldEmpty,
  getInputValue,
  hasSongId,
  isSongIncomplete,
} from "./utils";

/**
 * 覆盖值故意放宽为 unknown：测试需要构造 title=null 这类
 * 「类型上不该出现但数据库里确实可能存在」的脏数据。
 */
type SongOverrides = Partial<Record<keyof SongDetail, unknown>>;

function fieldByKey(key: SongFormFieldKey): SongFieldConfig {
  const field = songFields.find((f) => f.key === key);
  if (!field) throw new Error(`songFields 缺少字段配置: ${key}`);
  return field;
}

/** 所有 songFields 都已填写的歌曲 */
function makeCompleteSong(overrides: SongOverrides = {}): SongDetail {
  return {
    id: 1,
    title: "倾尽天下",
    album: "倾尽天下",
    lyricist: ["finale"],
    composer: ["河图"],
    arranger: ["河图"],
    artist: ["河图"],
    albumartist: ["某发行方"],
    type: ["原创"],
    genre: ["古风"],
    length: 260,
    date: "2010-01-01",
    lyrics: "[00:01.00]词",
    nmn_status: true,
    track: 1,
    tracktotal: 10,
    discnumber: 1,
    disctotal: 1,
    // 以下为非关键字段
    hascover: true,
    comment: "备注",
    kugolink: "https://example.com/k",
    nelink: "https://example.com/n",
    qmlink: "https://example.com/q",
    ...overrides,
  } as unknown as SongDetail;
}

describe("isCriticalField", () => {
  it("封面 / 外链 / 备注不计入完善度", () => {
    for (const key of [
      "hascover",
      "kugolink",
      "qmlink",
      "nelink",
      "comment",
    ] as const) {
      expect(isCriticalField(key)).toBe(false);
    }
  });

  it("标题等字段计入完善度", () => {
    expect(isCriticalField("title")).toBe(true);
    expect(isCriticalField("nmn_status")).toBe(true);
  });
});

describe("isFieldEmpty", () => {
  const titleField = fieldByKey("title");
  const nmnField = fieldByKey("nmn_status");
  const artistField = fieldByKey("artist");

  it("null / undefined 视为空", () => {
    expect(isFieldEmpty(makeCompleteSong({ title: null }), titleField)).toBe(
      true,
    );
  });

  it("空数组视为空", () => {
    expect(isFieldEmpty(makeCompleteSong({ artist: [] }), artistField)).toBe(
      true,
    );
  });

  it("纯空白字符串视为空", () => {
    expect(isFieldEmpty(makeCompleteSong({ title: "   " }), titleField)).toBe(
      true,
    );
  });

  it("nmn_status 只有 true 才算已补全（false 也算缺失）", () => {
    expect(isFieldEmpty(makeCompleteSong({ nmn_status: true }), nmnField)).toBe(
      false,
    );
    expect(
      isFieldEmpty(makeCompleteSong({ nmn_status: false }), nmnField),
    ).toBe(true);
    expect(isFieldEmpty(makeCompleteSong({ nmn_status: null }), nmnField)).toBe(
      true,
    );
  });

  it("有值时不为空", () => {
    expect(isFieldEmpty(makeCompleteSong(), titleField)).toBe(false);
  });
});

describe("getMissingFields / isSongIncomplete", () => {
  it("字段齐全时无缺失", () => {
    const song = makeCompleteSong();
    expect(getMissingFields(song)).toEqual([]);
    expect(isSongIncomplete(song)).toBe(false);
  });

  it("缺标题时列出「标题」", () => {
    const song = makeCompleteSong({ title: null });
    expect(getMissingFields(song)).toContain("标题");
    expect(isSongIncomplete(song)).toBe(true);
  });

  it("歌词字段使用覆盖后的显示名「歌词」", () => {
    const song = makeCompleteSong({ lyrics: "" });
    expect(getMissingFields(song)).toContain("歌词");
  });

  it("仅缺非关键字段时不算待完善", () => {
    const song = makeCompleteSong({
      comment: null,
      kugolink: null,
      nelink: null,
      qmlink: null,
      hascover: null,
    });
    expect(getMissingFields(song)).toEqual([]);
    expect(isSongIncomplete(song)).toBe(false);
  });

  it("nmn_status 为 false 时算待完善", () => {
    const song = makeCompleteSong({ nmn_status: false });
    expect(getMissingFields(song)).toContain("乐谱");
    expect(isSongIncomplete(song)).toBe(true);
  });

  // 两个函数此前是各写一遍的独立实现，合并后必须保持等价
  it("isSongIncomplete 与 getMissingFields 结果始终一致", () => {
    const samples: SongDetail[] = [
      makeCompleteSong(),
      makeCompleteSong({ title: null }),
      makeCompleteSong({ artist: [] }),
      makeCompleteSong({ nmn_status: false }),
      makeCompleteSong({ comment: null }),
      makeCompleteSong({ album: "  ", lyrics: null, track: null }),
    ];
    for (const song of samples) {
      expect(isSongIncomplete(song)).toBe(getMissingFields(song).length > 0);
    }
  });
});

describe("小工具", () => {
  it("getInputValue 把 null/undefined 归一为空字符串", () => {
    expect(getInputValue(null)).toBe("");
    expect(getInputValue(undefined)).toBe("");
    expect(getInputValue(0)).toBe(0);
    expect(getInputValue("x")).toBe("x");
  });

  it("hasSongId 只接受有限数字", () => {
    expect(hasSongId(1)).toBe(true);
    expect(hasSongId(0)).toBe(true);
    expect(hasSongId(NaN)).toBe(false);
    expect(hasSongId("1")).toBe(false);
    expect(hasSongId(undefined)).toBe(false);
  });

  it("isCreatorFieldKey 识别数组型创作者字段", () => {
    expect(isCreatorFieldKey("lyricist")).toBe(true);
    expect(isCreatorFieldKey("albumartist")).toBe(true);
    expect(isCreatorFieldKey("title")).toBe(false);
  });
});
