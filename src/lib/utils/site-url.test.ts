import { describe, expect, it } from "vitest";
import { localeAlternates, localeUrl } from "./site-url";

describe("localeUrl", () => {
  it("拼上语言前缀；首页不带路径", () => {
    expect(localeUrl("zh-TW", "/song/12")).toBe(
      "https://www.hetu-music.com/zh-TW/song/12",
    );
    expect(localeUrl("zh-CN")).toBe("https://www.hetu-music.com/zh-CN");
  });

  it("不认识的语言按简体", () => {
    expect(localeUrl("en", "/quiz")).toBe(
      "https://www.hetu-music.com/zh-CN/quiz",
    );
  });
});

describe("localeAlternates", () => {
  it("canonical 是本语言，languages 列出简繁两版", () => {
    expect(localeAlternates("zh-TW", "/imagery")).toEqual({
      canonical: "https://www.hetu-music.com/zh-TW/imagery",
      languages: {
        "zh-CN": "https://www.hetu-music.com/zh-CN/imagery",
        "zh-TW": "https://www.hetu-music.com/zh-TW/imagery",
      },
    });
  });
});
