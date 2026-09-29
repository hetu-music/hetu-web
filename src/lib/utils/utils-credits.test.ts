import { describe, it, expect } from "vitest";
import { applyCreditAliases, summarizeCreditNames } from "./utils-credits";

const aliases = new Map([
  ["萧忆情Alex", "萧忆情"],
  ["潮汐-tide", "Tide潮汐"],
]);

describe("applyCreditAliases", () => {
  it("把别名换成主名，并记下原署", () => {
    const song = {
      id: 1,
      artist: ["河图", "萧忆情Alex"],
      lyricist: ["潮汐-tide"],
      composer: ["河图"],
    };
    const result = applyCreditAliases(song, aliases);

    expect(result.artist).toEqual(["河图", "萧忆情"]);
    expect(result.lyricist).toEqual(["Tide潮汐"]);
    expect(result.composer).toEqual(["河图"]);
    // 只记改动过的字段
    expect(result.credited).toEqual({
      artist: ["河图", "萧忆情Alex"],
      lyricist: ["潮汐-tide"],
    });
    expect(result.creditAliases?.sort()).toEqual(["潮汐-tide", "萧忆情Alex"]);
    expect(song.artist).toEqual(["河图", "萧忆情Alex"]);
  });

  it("没有别名的歌原样返回", () => {
    const song = { id: 2, artist: ["河图"], lyricist: null };
    expect(applyCreditAliases(song, aliases)).toBe(song);
    expect(applyCreditAliases(song, new Map())).toBe(song);
  });

  it("原名与别名并列时归并后只留一个", () => {
    const result = applyCreditAliases(
      { artist: ["萧忆情", "萧忆情Alex"] },
      aliases,
    );
    expect(result.artist).toEqual(["萧忆情"]);
    expect(result.credited?.artist).toEqual(["萧忆情", "萧忆情Alex"]);
  });

  it("只处理歌曲上存在的字段", () => {
    const result = applyCreditAliases({ artist: ["萧忆情Alex"] }, aliases);
    expect("albumartist" in result).toBe(false);
  });
});

describe("summarizeCreditNames", () => {
  it("按名字统计歌曲数与角色，身兼数职只算一首", () => {
    const usage = summarizeCreditNames([
      { artist: ["河图"], composer: ["河图"], lyricist: ["Finale"] },
      { artist: ["河图"], albumartist: ["河图"] },
    ]);
    expect(usage).toEqual([
      { name: "Finale", songs: 1, roles: ["lyricist"] },
      { name: "河图", songs: 2, roles: ["composer", "artist", "albumartist"] },
    ]);
  });
});
