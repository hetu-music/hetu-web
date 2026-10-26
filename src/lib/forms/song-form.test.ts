import { describe, it, expect } from "vitest";
import {
  createEmptySongForm,
  createEmptySongFormState,
  toSongFormPayload,
  toSongFormState,
  validateSongForm,
  type SongFormValues,
} from "./song-form";
import type { SongDetail } from "@/lib/types";

describe("toSongFormState / toSongFormPayload 往返转换", () => {
  it("state → payload 时数组字段从 {value} 对象还原为字符串数组", () => {
    const state = createEmptySongFormState();
    state.title = "测试歌曲";
    state.lyricist = [{ value: "甲" }, { value: "乙" }];

    const payload = toSongFormPayload(state);
    expect(payload.lyricist).toEqual(["甲", "乙"]);
    expect(payload.title).toBe("测试歌曲");
  });

  it("所有 field array 字段都还原为字符串数组，往返后与原值一致", () => {
    const song: Partial<SongDetail> = {
      title: "标题",
      lyricist: ["甲"],
      composer: ["乙"],
      arranger: ["丙"],
      artist: ["丁", "戊"],
      albumartist: ["己"],
      type: ["原创"],
    };

    const payload = toSongFormPayload(toSongFormState(song));
    expect(payload.lyricist).toEqual(["甲"]);
    expect(payload.composer).toEqual(["乙"]);
    expect(payload.arranger).toEqual(["丙"]);
    expect(payload.artist).toEqual(["丁", "戊"]);
    expect(payload.albumartist).toEqual(["己"]);
    // type / genre 不走 field array，保持字符串数组
    expect(payload.type).toEqual(["原创"]);
  });

  it("song → state 时数组字段包裹为 {value} 供 useFieldArray 使用", () => {
    const song: Partial<SongDetail> = {
      title: "标题",
      lyricist: ["甲", "乙"],
    };
    const state = toSongFormState(song);
    expect(state.lyricist).toEqual([{ value: "甲" }, { value: "乙" }]);
  });

  it("song 缺失字段时补齐为空值而不是 undefined", () => {
    const state = toSongFormState({ title: "只有标题" });
    expect(state.album).toBe("");
    expect(state.length).toBeNull();
    expect(state.composer).toEqual([]);
  });

  it("null / 非法类型字段被规范化为对应空值", () => {
    const song = {
      title: 123, // 非字符串
      length: "not-a-number",
      hascover: "true", // 非布尔值
    } as unknown as Partial<SongDetail>;
    const state = toSongFormState(song);
    expect(state.title).toBe("123");
    expect(state.length).toBeNull();
    expect(state.hascover).toBeNull();
  });

  it("数组字段中的非字符串项被转为字符串，非数组被视为空数组", () => {
    const song = {
      title: "标题",
      lyricist: [1, "乙"],
      genre: "流行",
    } as unknown as Partial<SongDetail>;
    const state = toSongFormState(song);
    expect(state.lyricist).toEqual([{ value: "1" }, { value: "乙" }]);
    expect(state.genre).toEqual([]);
  });
});

describe("validateSongForm", () => {
  function baseValues(): SongFormValues {
    return { ...createEmptySongForm(), title: "合法标题" };
  }

  it("合法数据通过校验", () => {
    const result = validateSongForm(baseValues());
    expect(result.errors).toEqual({});
    expect(result.data).not.toBeNull();
  });

  it("标题为空时报错", () => {
    const result = validateSongForm({ ...baseValues(), title: "" });
    expect(result.data).toBeNull();
    expect(result.errors.title).toBeTruthy();
  });

  it("非法 URL 时报错", () => {
    const result = validateSongForm({
      ...baseValues(),
      kugolink: "not-a-url",
    });
    expect(result.data).toBeNull();
    expect(result.errors.kugolink).toBeTruthy();
  });

  it("空字符串 URL 视为未填写，不报错", () => {
    const result = validateSongForm({ ...baseValues(), kugolink: "" });
    expect(result.errors.kugolink).toBeUndefined();
  });

  it("length 为负数时报错", () => {
    const result = validateSongForm({ ...baseValues(), length: -1 });
    expect(result.errors.length).toBeTruthy();
  });

  it("length 为数字字符串时被转换为数字后通过校验", () => {
    const result = validateSongForm({
      ...baseValues(),
      length: "180" as unknown as number,
    });
    expect(result.errors.length).toBeUndefined();
    expect(result.data?.length).toBe(180);
  });

  it("length 为非法类型（既非数字也非字符串）时报错而不是崩溃", () => {
    const result = validateSongForm({
      ...baseValues(),
      length: {} as unknown as number,
    });
    expect(result.data).toBeNull();
    expect(result.errors.length).toBeTruthy();
  });

  it("length 为空字符串时视为未填写", () => {
    const result = validateSongForm({
      ...baseValues(),
      length: "" as unknown as number,
    });
    expect(result.errors.length).toBeUndefined();
    expect(result.data?.length).toBeNull();
  });

  it("hascover 缺失时视为 null，非布尔值时报错", () => {
    const missing = validateSongForm({
      ...baseValues(),
      hascover: undefined as unknown as null,
    });
    expect(missing.data?.hascover).toBeNull();

    const invalid = validateSongForm({
      ...baseValues(),
      hascover: "true" as unknown as boolean,
    });
    expect(invalid.data).toBeNull();
    expect(invalid.errors.hascover).toBeTruthy();
  });

  it("lyrics_start 接受 LRC 时间标签或留空，拒绝其他格式", () => {
    expect(
      validateSongForm({ ...baseValues(), lyrics_start: "00:23.97" }).errors
        .lyrics_start,
    ).toBeUndefined();
    expect(
      validateSongForm({ ...baseValues(), lyrics_start: "1:05" }).errors
        .lyrics_start,
    ).toBeUndefined();
    expect(
      validateSongForm({ ...baseValues(), lyrics_start: "23.97" }).errors
        .lyrics_start,
    ).toBeTruthy();
  });

  it("一个字段有多个校验错误时，只记录第一条错误信息", () => {
    const result = validateSongForm({
      ...baseValues(),
      title: "", // 触发 min(1) 错误
    });
    // errors.title 应该存在且只有一条（不是数组）
    expect(typeof result.errors.title).toBe("string");
  });
});
