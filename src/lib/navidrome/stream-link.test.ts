import { describe, expect, it } from "vitest";
import crypto from "crypto";
import {
  buildStreamUrl,
  signStreamPath,
  streamLinkConfigFromEnv,
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

describe("buildStreamUrl", () => {
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
