import { describe, expect, it, vi } from "vitest";
import {
  buildCorpus,
  buildCorpusChunked,
  lineAt,
  lineEnd,
  SEPARATOR,
} from "./corpus";
import { LYRICS } from "./test-fixtures";

describe("buildCorpus", () => {
  const c = buildCorpus(LYRICS);

  it("句子归一化后用分隔符拼起来", () => {
    expect(c.corpus.startsWith(`夜夜笙歌${SEPARATOR}七重纱衣血溅了白纱`)).toBe(
      true,
    );
    expect(c.lines).toHaveLength(13);
    expect(c.lines[1]).toBe("七重纱衣，血溅了白纱");
  });

  it("每句记下起点、所属的歌和是第几句", () => {
    expect([...c.lineSong.slice(0, 5)]).toEqual([1, 1, 1, 2, 2]);
    expect([...c.lineIndex.slice(0, 5)]).toEqual([0, 1, 2, 0, 1]);
    const line = 1;
    expect(c.corpus.slice(c.lineStart[line], lineEnd(c, line))).toBe(
      "七重纱衣血溅了白纱",
    );
  });

  it("位置定位到句子，最后一句的终点是 corpus 的结尾", () => {
    const p = c.corpus.indexOf("天下之大");
    const line = lineAt(c, p);
    expect(c.lines[line]).toBe("天下之大");
    expect(lineEnd(c, line)).toBe(c.corpus.length);
    expect(lineAt(c, 0)).toBe(0);
  });

  it("命中不跨句：上一句的结尾接下一句的开头搜不到", () => {
    // 「夜夜笙歌」的结尾和「七重纱衣」的开头
    expect(c.corpus.indexOf("笙歌七重")).toBe(-1);
  });

  it("空数据也能建", () => {
    const empty = buildCorpus([]);
    expect(empty.corpus).toBe("");
    expect(empty.lines).toEqual([]);
  });
});

describe("buildCorpusChunked", () => {
  it("分段构建的结果和一次建好的一样，每段之间让出主线程", async () => {
    const yieldToMain = vi.fn(() => Promise.resolve());
    const chunked = await buildCorpusChunked(LYRICS, {
      chunkSize: 2,
      yieldToMain,
    });
    expect(chunked).toEqual(buildCorpus(LYRICS));
    // 5 首歌，每段 2 首：3 段，中间让出 2 次
    expect(yieldToMain).toHaveBeenCalledTimes(2);
  });

  it("中途放弃时抛出 signal 的原因", async () => {
    const controller = new AbortController();
    const reason = new Error("换了字形");
    const promise = buildCorpusChunked(LYRICS, {
      chunkSize: 1,
      signal: controller.signal,
      yieldToMain: async () => controller.abort(reason),
    });
    await expect(promise).rejects.toBe(reason);
  });

  it("默认用 setTimeout 让出（没有 scheduler.yield 时）", async () => {
    const c = await buildCorpusChunked(LYRICS, { chunkSize: 2 });
    expect(c.lines).toHaveLength(13);
  });
});
