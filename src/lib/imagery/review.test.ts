import { describe, expect, it } from "vitest";
import { buildReviewPrompt, MAX_ADDITIONS, parseReviewOutput } from "./review";

const lines = [
  { tag: "00:10.00", text: "明月照亮天涯" },
  { tag: "00:20.00", text: "风流不假" },
  { tag: "01:10.00", text: "明月照亮天涯" }, // 副歌重复
  { tag: "00:30.00", text: "登上九重宝塔" },
];
const candidates = [
  { imageryId: 11, name: "明月", rate: 0.77, recommended: true },
  { imageryId: 12, name: "风", rate: 0.49, recommended: true },
  { imageryId: -1, name: "天涯", rate: null, recommended: false },
];
const categories = [
  { id: 100, label: "天象 / 星相" },
  { id: 200, label: "建筑 / 构筑" },
];
const input = { lines, candidates, categories };

describe("buildReviewPrompt", () => {
  it("歌词按文本去重编号，候选带历史标注率，列出分类", () => {
    const prompt = buildReviewPrompt({ title: "倾尽天下", ...input });
    expect(prompt).toContain("歌名：倾尽天下");
    expect(prompt).toContain("1. 明月照亮天涯\n2. 风流不假\n3. 登上九重宝塔");
    expect(prompt).not.toContain("4. ");
    expect(prompt).toContain("1. 明月（默认勾选，历史标注率 77%）");
    expect(prompt).toContain("3. 天涯（默认不勾选，历史标注率 无参考）");
    expect(prompt).toContain("200: 建筑 / 构筑");
  });
});

describe("parseReviewOutput", () => {
  it("候选编号映射回意象 id，丢弃越界和重复的编号", () => {
    const result = parseReviewOutput(
      {
        verdicts: [
          { id: 1, keep: true, reason: "具体景物" },
          { id: 2, keep: false, reason: "「风流」的构词成分" },
          { id: 2, keep: true, reason: "重复" },
          { id: 9, keep: true, reason: "越界" },
        ],
        additions: [],
      },
      input,
    );
    expect(result.verdicts).toEqual([
      { imageryId: 11, keep: true, reason: "具体景物" },
      { imageryId: 12, keep: false, reason: "「风流」的构词成分" },
    ]);
  });

  it("补充项的行号映射为全部时间标签，分类不在列表中时置空", () => {
    const result = parseReviewOutput(
      {
        verdicts: [],
        additions: [
          { name: "宝塔", lines: [3], categoryId: 200, reason: "建筑" },
          { name: "天涯", lines: [1], categoryId: 100, reason: "已是候选" },
          { name: "照亮", lines: [1], categoryId: 999, reason: "分类无效" },
        ],
      },
      input,
    );
    expect(result.additions).toEqual([
      {
        name: "宝塔",
        timetags: ["00:30.00"],
        lines: ["登上九重宝塔"],
        categoryId: 200,
        reason: "建筑",
      },
      {
        name: "照亮",
        timetags: ["00:10.00", "01:10.00"],
        lines: ["明月照亮天涯", "明月照亮天涯"],
        categoryId: null,
        reason: "分类无效",
      },
    ]);
  });

  it("丢弃歌词里并不存在的补充项（防止模型编造）", () => {
    const result = parseReviewOutput(
      {
        verdicts: [],
        additions: [
          { name: "九龙塔", lines: [3], categoryId: 200, reason: "编造" },
          { name: "宝塔", lines: [99], categoryId: 200, reason: "行号越界" },
        ],
      },
      input,
    );
    expect(result.additions).toEqual([]);
  });

  it(`补充项最多保留 ${MAX_ADDITIONS} 个`, () => {
    const many = Array.from({ length: MAX_ADDITIONS + 5 }, (_, i) => ({
      name: String.fromCharCode(0x4e00 + i),
      lines: [1],
      categoryId: 100,
      reason: "",
    }));
    const text = many.map((a) => a.name).join("");
    const result = parseReviewOutput(
      { verdicts: [], additions: many },
      { ...input, lines: [{ tag: "00:01.00", text }] },
    );
    expect(result.additions).toHaveLength(MAX_ADDITIONS);
  });

  it("结构不符时抛错", () => {
    expect(() => parseReviewOutput({ verdicts: "x" }, input)).toThrow();
  });
});
