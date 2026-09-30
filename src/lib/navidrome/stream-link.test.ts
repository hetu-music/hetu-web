import { describe, expect, it } from "vitest";
import crypto from "crypto";
import {
  buildStreamUrl,
  signStreamPath,
  streamLinkConfigFromEnv,
  streamModeFor,
} from "./stream-link";

const config = { baseUrl: "https://relay.example.com", secret: "k3y" };
const NOW = Date.UTC(2026, 8, 30, 12, 0, 0);

describe("streamLinkConfigFromEnv", () => {
  it("缺任一项返回 null，去掉地址末尾斜杠", () => {
    expect(streamLinkConfigFromEnv({ STREAM_BASE_URL: "https://a/" })).toBe(
      null,
    );
    expect(
      streamLinkConfigFromEnv({
        STREAM_BASE_URL: "https://a/",
        STREAM_LINK_SECRET: "s",
      }),
    ).toEqual({ baseUrl: "https://a", secret: "s" });
  });
});

describe("signStreamPath", () => {
  it("与 nginx secure_link_md5 的算法一致：md5 二进制转 base64url、无填充", () => {
    // nginx 配置：secure_link_md5 "$secure_link_expires$uri$arg_u <secret>"
    const expected = crypto
      .createHash("md5")
      .update("1790000000/stream/abcuser-1 k3y")
      .digest("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    expect(signStreamPath("/stream/abc", "user-1", 1790000000, "k3y")).toBe(
      expected,
    );
  });
});

describe("streamModeFor", () => {
  const song = (extra: object) => ({ id: "a", title: "t", ...extra });

  it("mp3 直接发原文件，大小写不敏感", () => {
    expect(streamModeFor(song({ suffix: "mp3", bitRate: 320 }))).toBe(
      "original",
    );
    expect(streamModeFor(song({ suffix: "MP3", bitDepth: 0 }))).toBe(
      "original",
    );
  });

  it("无损、其他格式、带位深、取不到信息时都转码", () => {
    expect(streamModeFor(song({ suffix: "flac", bitDepth: 16 }))).toBe(
      "transcode",
    );
    // m4a 可能是 ALAC，ogg 旧版 iOS 播不了
    expect(streamModeFor(song({ suffix: "m4a" }))).toBe("transcode");
    expect(streamModeFor(song({ suffix: "ogg" }))).toBe("transcode");
    expect(streamModeFor(song({ suffix: "mp3", bitDepth: 24 }))).toBe(
      "transcode",
    );
    expect(streamModeFor(song({}))).toBe("transcode");
    expect(streamModeFor(null)).toBe("transcode");
  });
});

describe("buildStreamUrl", () => {
  it("原文件走 /file/，签名覆盖该路径，不带起播位置", () => {
    const url = new URL(
      buildStreamUrl(config, {
        navidId: "abc",
        userId: "u",
        duration: 200,
        mode: "original",
        timeOffset: 90,
        now: NOW,
      }),
    );
    expect(url.pathname).toBe("/file/abc");
    expect(url.searchParams.has("t")).toBe(false);
    const expires = Number(url.searchParams.get("e"));
    expect(url.searchParams.get("s")).toBe(
      signStreamPath("/file/abc", "u", expires, "k3y"),
    );
    // 同一首的转码链接签名不同，改路径验不过
    expect(url.searchParams.get("s")).not.toBe(
      signStreamPath("/stream/abc", "u", expires, "k3y"),
    );
  });

  it("签名覆盖路径、用户与过期时间", () => {
    const url = new URL(
      buildStreamUrl(config, {
        navidId: "abc",
        userId: "user-1",
        duration: 200,
        now: NOW,
      }),
    );
    const expires = Number(url.searchParams.get("e"));
    expect(expires).toBe(NOW / 1000 + 200 + 3600);
    expect(url.searchParams.get("s")).toBe(
      signStreamPath("/stream/abc", "user-1", expires, "k3y"),
    );
  });

  it("从中间起播时，过期时间只算剩余部分", () => {
    const url = new URL(
      buildStreamUrl(config, {
        navidId: "abc",
        userId: "u",
        duration: 200,
        timeOffset: 150.7,
        now: NOW,
      }),
    );
    expect(url.searchParams.get("t")).toBe("150");
    expect(Number(url.searchParams.get("e"))).toBe(NOW / 1000 + 50 + 3600);
  });

  it("不知道时长时按一小时算", () => {
    const url = new URL(
      buildStreamUrl(config, {
        navidId: "abc",
        userId: "u",
        duration: null,
        now: NOW,
      }),
    );
    expect(Number(url.searchParams.get("e"))).toBe(NOW / 1000 + 3600 + 3600);
  });

  it("曲目 ID 带路径字符时拒绝", () => {
    expect(() =>
      buildStreamUrl(config, {
        navidId: "../rest/getUsers",
        userId: "u",
        duration: 1,
      }),
    ).toThrow();
  });
});
