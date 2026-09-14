import { describe, it, expect, vi } from "vitest";
import {
  convertEmptyStringToNull,
  debounce,
  formatDate,
  formatField,
  formatTime,
  serializeJsonLd,
} from "./utils-common";

describe("formatTime", () => {
  it("将秒数格式化为 分:秒", () => {
    expect(formatTime(65)).toBe("1:05");
    expect(formatTime(5)).toBe("0:05");
  });

  it.each([null, 0, NaN])("非法/空值 %s 返回“未知”", (input) => {
    expect(formatTime(input as number)).toBe("未知");
  });
});

describe("formatDate", () => {
  it("格式化为 年月日", () => {
    expect(formatDate("2023-05-01")).toBe("2023年5月1日");
  });

  it.each([null, undefined, ""])("空值 %j 返回“未知”", (input) => {
    expect(formatDate(input)).toBe("未知");
  });
});

describe("debounce", () => {
  it("在等待时间内多次调用只执行最后一次", () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const debounced = debounce(fn, 100);

    debounced("a");
    debounced("b");
    debounced("c");
    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith("c");

    vi.useRealTimers();
  });
});

describe("convertEmptyStringToNull", () => {
  it("对象中的空字符串字段转为 null，其他字段保留", () => {
    const result = convertEmptyStringToNull({ a: "", b: "keep", c: 1 });
    expect(result).toEqual({ a: null, b: "keep", c: 1 });
  });

  it("数组字段内的空字符串项也转为 null", () => {
    const result = convertEmptyStringToNull({ tags: ["x", "", "y"] });
    expect(result).toEqual({ tags: ["x", null, "y"] });
  });

  it("嵌套数组（对象数组）递归处理", () => {
    const result = convertEmptyStringToNull([{ a: "" }, { a: "b" }]);
    expect(result).toEqual([{ a: null }, { a: "b" }]);
  });

  it("非对象/数组的原始值原样返回", () => {
    expect(convertEmptyStringToNull("plain" as unknown as object)).toBe(
      "plain",
    );
    expect(convertEmptyStringToNull(null as unknown as object)).toBeNull();
  });
});

describe("formatField", () => {
  it("null/undefined 显示为 -", () => {
    expect(formatField(null, "text")).toBe("-");
    expect(formatField(undefined, "number")).toBe("-");
  });

  it("array 类型用逗号连接", () => {
    expect(formatField(["a", "b"], "array")).toBe("a, b");
  });

  it("boolean 类型显示为 是/否", () => {
    expect(formatField(true, "boolean")).toBe("是");
    expect(formatField(false, "boolean")).toBe("否");
  });

  it("date 类型截取前10位", () => {
    expect(formatField("2023-05-01T12:00:00Z", "date")).toBe("2023-05-01");
  });

  it("textarea 超过50字时截断并加省略号", () => {
    const long = "a".repeat(60);
    expect(formatField(long, "textarea")).toBe("a".repeat(50) + "...");
  });

  it("textarea 未超过50字时原样返回", () => {
    expect(formatField("短文本", "textarea")).toBe("短文本");
  });
});

describe("serializeJsonLd", () => {
  it("转义尖括号，阻断 </script> 提前闭合标签", () => {
    const out = serializeJsonLd({
      description: "前 </script><script>alert(1)</script> 后",
    });
    expect(out).not.toContain("</script>");
    expect(out).not.toContain("<");
    expect(out).not.toContain(">");
  });

  it("转义后仍是合法 JSON，且内容无损", () => {
    const data = { name: "意象<词云>&测试", count: 27 };
    expect(JSON.parse(serializeJsonLd(data))).toEqual(data);
  });

  it("转义 & 号", () => {
    expect(serializeJsonLd({ a: "x&y" })).toContain("\\u0026");
  });

  it("转义 U+2028 / U+2029（JSON 合法但 JS 源码里是换行）", () => {
    const out = serializeJsonLd({ a: "x y z" });
    expect(out).toContain("\\u2028");
    expect(out).toContain("\\u2029");
    expect(out).not.toContain(" ");
    expect(out).not.toContain(" ");
  });

  it("普通内容不受影响", () => {
    expect(serializeJsonLd({ name: "河图" })).toBe('{"name":"河图"}');
  });
});
