import { describe, expect, it } from "vitest";
import { lyricsVersion } from "./service-lyrics-lines";

describe("lyricsVersion", () => {
  const map = (entries: [number, string][]) =>
    new Map(entries.map(([id, iso]) => [id, new Date(iso)]));

  it("最近一次更新变了，版本号就变", () => {
    const a = lyricsVersion(
      map([
        [1, "2026-01-01T00:00:00Z"],
        [2, "2026-02-01T00:00:00Z"],
      ]),
    );
    const b = lyricsVersion(
      map([
        [1, "2026-03-01T00:00:00Z"],
        [2, "2026-02-01T00:00:00Z"],
      ]),
    );
    expect(a).not.toBe(b);
  });

  it("删了一首歌（最近更新不变）版本号也变；数据不变时不变", () => {
    const two = map([
      [1, "2026-01-01T00:00:00Z"],
      [2, "2026-02-01T00:00:00Z"],
    ]);
    const one = map([[2, "2026-02-01T00:00:00Z"]]);
    expect(lyricsVersion(two)).not.toBe(lyricsVersion(one));
    expect(lyricsVersion(two)).toBe(lyricsVersion(new Map(two)));
  });

  it("可以直接放进地址", () => {
    expect(lyricsVersion(map([[1, "2026-01-01T00:00:00Z"]]))).toMatch(
      /^[0-9a-z]+$/,
    );
  });
});
