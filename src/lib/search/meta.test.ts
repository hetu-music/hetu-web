import { describe, expect, it } from "vitest";
import { getSongMeta, namesOf } from "./meta";
import { song } from "./test-fixtures";

describe("SongMeta", () => {
  it("各字段归一化，人名按角色分开", () => {
    const meta = getSongMeta(
      song(1, "傾盡天下", {
        album: "《倾尽天下》",
        artist: ["河圖", "河图"],
        lyricist: ["Vagary"],
        composer: ["小魂"],
        arranger: null,
        creditAliases: ["萧忆情"],
        genre: ["古風"],
      }),
    );
    expect(meta).toEqual({
      id: 1,
      title: "倾尽天下",
      album: "倾尽天下",
      artist: ["河图"],
      lyricist: ["vagary"],
      composer: ["小魂"],
      arranger: [],
      aliases: ["萧忆情"],
      genre: ["古风"],
    });
    expect(namesOf(meta)).toEqual(["河图", "vagary", "小魂", "萧忆情"]);
  });

  it("同一个 Song 对象只建一次：筛选后的新数组也复用", () => {
    const a = song(1, "如花");
    const b = song(2, "越人歌");
    const all = [a, b].map(getSongMeta);
    const filtered = [b].map(getSongMeta);
    expect(filtered[0]).toBe(all[1]);
    expect(getSongMeta(a)).toBe(all[0]);
  });

  it("换了 Song 对象就重建", () => {
    const first = getSongMeta(song(1, "如花"));
    const second = getSongMeta(song(1, "如花"));
    expect(second).not.toBe(first);
    expect(second).toEqual(first);
  });
});
