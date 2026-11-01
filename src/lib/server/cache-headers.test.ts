import { describe, expect, it } from "vitest";
// next.config.ts 的 headers 就是用这个函数匹配 source 的
import { getPathMatch } from "next/dist/shared/lib/router/utils/path-match";
import { API_NO_STORE_SOURCE } from "./cache-headers";

const noStore = getPathMatch(API_NO_STORE_SOURCE);

describe("/api 下统一加 no-store 的范围", () => {
  it("自己设了缓存头的接口不在其中", () => {
    for (const path of [
      "/api/public/songs/42/lyrics",
      "/api/public/songs/lyrics-lines",
      "/api/imagery/motifs/7",
      "/api/public/contributors",
    ]) {
      expect(noStore(path), path).toBe(false);
    }
  });

  it("其余接口都在其中，包括和上面只差一截的", () => {
    for (const path of [
      "/api/public/songs/search",
      "/api/public/songs/42/comments",
      "/api/public/csrf-token",
      "/api/auth/me",
      "/api/admin/songs/42",
      "/api/navidrome/stream-url",
      "/api/public/songs/42/lyrics/extra",
      "/api/public/songs/lyrics-lines-old",
      "/api/imagery/motifs/7/words",
    ]) {
      expect(noStore(path), path).not.toBe(false);
    }
  });

  it("不碰 /api 以外的路径", () => {
    expect(noStore("/zh-CN")).toBe(false);
    expect(noStore("/zh-CN/song/42")).toBe(false);
  });
});
