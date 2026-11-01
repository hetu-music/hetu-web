import { describe, expect, it } from "vitest";
import { parseRouteId } from "./route-params";

describe("parseRouteId", () => {
  it("规范的十进制写法", () => {
    expect(parseRouteId("1")).toBe(1);
    expect(parseRouteId("382")).toBe(382);
  });

  it("前导零、夹带别的字符、零、负数、超长：都不认，免得同一首歌有好几个缓存地址", () => {
    for (const raw of [
      "012",
      "12abc",
      "12.0",
      " 12",
      "0",
      "-1",
      "1e3",
      "",
      "12345678901",
    ]) {
      expect(parseRouteId(raw), raw).toBeNull();
    }
  });
});
