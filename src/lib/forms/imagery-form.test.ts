import { describe, it, expect } from "vitest";
import {
  categoryFormSchema,
  createCategoryFormValues,
  createImageryFormValues,
  imageryFormSchema,
  toCategoryPayload,
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

  it("名称为 null 时按空字符串处理并拒绝，非字符串转为字符串", () => {
    expect(imageryFormSchema.safeParse({ name: null }).success).toBe(false);
    const result = imageryFormSchema.safeParse({ name: 123 });
    expect(result.success).toBe(true);
    expect(result.data?.name).toBe("123");
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

  it("createCategoryFormValues 无参数时返回空值，顶级分类 parent_id 为 null", () => {
    expect(createCategoryFormValues()).toEqual({
      name: "",
      parent_id: null,
      description: "",
    });
    expect(
      createCategoryFormValues({ name: "顶级", parent_id: null }).parent_id,
    ).toBeNull();
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

  it("父分类缺少 level 时按 1 级计算", () => {
    const payload = toCategoryPayload(
      { name: "子分类", parent_id: 2, description: "描述" },
      [
        {
          id: 2,
          name: "无层级父分类",
          parent_id: null,
          level: null,
          description: null,
        },
      ],
    );
    expect(payload.level).toBe(2);
    expect(payload.description).toBe("描述");
  });

  it("parent_id 在分类列表中找不到时 level 为 1", () => {
    const payload = toCategoryPayload(
      { name: "孤儿", parent_id: 99, description: "" },
      categories,
    );
    expect(payload.parent_id).toBe(99);
    expect(payload.level).toBe(1);
  });
});
