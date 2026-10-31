import { describe, it, expect } from "vitest";
import { createMotifFormValues, motifFormSchema } from "./imagery-form";

describe("motifFormSchema", () => {
  const valid = { name: "汗", parent_id: 2, description: "汗水、汗珠" };

  it("名称、类别、说明齐全时通过，并去掉首尾空白", () => {
    const result = motifFormSchema.safeParse({ ...valid, name: " 汗 " });
    expect(result.success).toBe(true);
    expect(result.data?.name).toBe("汗");
  });

  it("名称为空或超过 50 字拒绝", () => {
    expect(motifFormSchema.safeParse({ ...valid, name: "" }).success).toBe(
      false,
    );
    expect(
      motifFormSchema.safeParse({ ...valid, name: "a".repeat(51) }).success,
    ).toBe(false);
  });

  it("说明必填", () => {
    expect(
      motifFormSchema.safeParse({ ...valid, description: "  " }).success,
    ).toBe(false);
    expect(
      motifFormSchema.safeParse({ ...valid, description: null }).success,
    ).toBe(false);
  });

  it("必须选类别", () => {
    expect(motifFormSchema.safeParse({ ...valid, parent_id: 0 }).success).toBe(
      false,
    );
  });
});

describe("createMotifFormValues", () => {
  it("新增时给空值，类别为 0（未选）", () => {
    expect(createMotifFormValues()).toEqual({
      name: "",
      parent_id: 0,
      description: "",
    });
  });

  it("编辑时带出原值，说明为 null 时转成空字符串", () => {
    expect(
      createMotifFormValues({
        id: 9,
        name: "汗",
        parent_id: 2,
        level: 3,
        description: null,
      }),
    ).toEqual({ name: "汗", parent_id: 2, description: "" });
  });
});
