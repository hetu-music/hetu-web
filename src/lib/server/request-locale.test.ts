import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { localeFromRequest } from "./request-locale";

function request(query = "", cookie?: string) {
  const req = new NextRequest(`http://localhost/api/x${query}`);
  if (cookie) req.cookies.set("NEXT_LOCALE", cookie);
  return req;
}

describe("localeFromRequest", () => {
  it("取 ?locale= 里认得的语系", () => {
    expect(localeFromRequest(request("?locale=zh-TW"))).toBe("zh-TW");
    expect(localeFromRequest(request("?locale=zh-CN"))).toBe("zh-CN");
  });

  it("缺省或不认识的一律简体", () => {
    expect(localeFromRequest(request())).toBe("zh-CN");
    expect(localeFromRequest(request("?locale=en"))).toBe("zh-CN");
    expect(localeFromRequest(request("?locale="))).toBe("zh-CN");
  });

  it("不看 NEXT_LOCALE cookie", () => {
    expect(localeFromRequest(request("", "zh-TW"))).toBe("zh-CN");
    expect(localeFromRequest(request("?locale=zh-CN", "zh-TW"))).toBe("zh-CN");
  });
});
