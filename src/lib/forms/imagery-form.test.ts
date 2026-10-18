import { describe, it, expect } from "vitest";
import {
  categoryFormSchema,
  createCategoryFormValues,
  createImageryFormValues,
  createMeaningFormValues,
  createRelationFormValues,
  imageryFormSchema,
  lyricTimetagItemSchema,
  relationFormSchema,
  toCategoryPayload,
  toMeaningPayload,
  toRelationPayload,
} from "./imagery-form";
import type { ImageryCategory } from "@/lib/types";

describe("imageryFormSchema", () => {
  it("非空名称通过", () => {
    expect(imageryFormSchema.safeParse({ name: "明月" }).success).toBe(true);
  });

  it("空名称拒绝", () => {
    expect(imageryFormSchema.safeParse({ name: "" }).success).toBe(false);
  });

  it("超过50字拒绝", () => {
    expect(imageryFormSchema.safeParse({ name: "a".repeat(51) }).success).toBe(
      false,
    );
  });
});

describe("categoryFormSchema", () => {
  it("parent_id 允许为 null（顶级分类）", () => {
    const result = categoryFormSchema.safeParse({
      name: "自然意象",
      parent_id: null,
      description: "",
    });
    expect(result.success).toBe(true);
  });

  it("parent_id 为非正整数时拒绝", () => {
    const result = categoryFormSchema.safeParse({
      name: "自然意象",
      parent_id: -1,
      description: "",
    });
    expect(result.success).toBe(false);
  });
});

describe("lyricTimetagItemSchema", () => {
  it("空字符串视为占位项，不报错（提交时再过滤）", () => {
    expect(lyricTimetagItemSchema.safeParse({ value: "" }).success).toBe(true);
  });

  it.each(["01:26", "01:26.04", "01:26.045"])(
    "合法时间戳格式 %s 通过",
    (value) => {
      expect(lyricTimetagItemSchema.safeParse({ value }).success).toBe(true);
    },
  );

  it("非法格式拒绝", () => {
    expect(
      lyricTimetagItemSchema.safeParse({ value: "not-a-timestamp" }).success,
    ).toBe(false);
  });
});

describe("relationFormSchema", () => {
  it("imagery_id / category_id 必须为正整数", () => {
    const result = relationFormSchema.safeParse({
      imagery_id: 0,
      category_id: 1,
      meaning_id: null,
      lyric_timetag: [],
    });
    expect(result.success).toBe(false);
  });

  it("合法数据通过", () => {
    const result = relationFormSchema.safeParse({
      imagery_id: 1,
      category_id: 2,
      meaning_id: null,
      lyric_timetag: [{ value: "01:00" }],
    });
    expect(result.success).toBe(true);
  });
});

describe("默认值工厂", () => {
  it("createImageryFormValues 无参数时返回空名称", () => {
    expect(createImageryFormValues()).toEqual({ name: "" });
  });

  it("createCategoryFormValues 回填已有分类数据", () => {
    expect(
      createCategoryFormValues({
        name: "山川",
        parent_id: 3,
        description: "d",
      }),
    ).toEqual({ name: "山川", parent_id: 3, description: "d" });
  });

  it("createMeaningFormValues 无参数时返回空值", () => {
    expect(createMeaningFormValues()).toEqual({ label: "", description: "" });
  });

  it("createRelationFormValues 将 lyric_timetag 字符串数组包裹为 {value}", () => {
    const result = createRelationFormValues({
      imagery_id: 1,
      category_id: 2,
      meaning_id: 3,
      lyric_timetag: ["01:00", "02:00"],
    });
    expect(result.lyric_timetag).toEqual([
      { value: "01:00" },
      { value: "02:00" },
    ]);
  });
});

describe("toCategoryPayload", () => {
  const categories: ImageryCategory[] = [
    { id: 1, name: "父分类", parent_id: null, level: 1, description: null },
  ];

  it("有 parent_id 时 level 为父级 level + 1", () => {
    const payload = toCategoryPayload(
      { name: " 子分类 ", parent_id: 1, description: "" },
      categories,
    );
    expect(payload).toEqual({
      name: "子分类",
      parent_id: 1,
      level: 2,
      description: null,
    });
  });

  it("无 parent_id 时 level 为 1，空描述转为 null", () => {
    const payload = toCategoryPayload(
      { name: "顶级", parent_id: null, description: "  " },
      categories,
    );
    expect(payload.level).toBe(1);
    expect(payload.description).toBeNull();
  });
});

describe("toMeaningPayload / toRelationPayload", () => {
  it("toMeaningPayload 去除首尾空白，空描述转 null", () => {
    expect(toMeaningPayload({ label: " 思念 ", description: "  " })).toEqual({
      label: "思念",
      description: null,
    });
  });

  it("toRelationPayload 过滤空的 lyric_timetag 项并取出 value", () => {
    const payload = toRelationPayload({
      imagery_id: 1,
      category_id: 2,
      meaning_id: null,
      lyric_timetag: [{ value: "01:00" }, { value: "  " }, { value: "02:00" }],
    });
    expect(payload.lyric_timetag).toEqual(["01:00", "02:00"]);
  });
});
