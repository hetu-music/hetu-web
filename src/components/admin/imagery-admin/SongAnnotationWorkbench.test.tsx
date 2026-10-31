// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  apiCreateOccurrencesBatch,
  apiGetImagerySuggestions,
} from "@/lib/api/client-api";
import type { OccurrenceWithSong } from "@/lib/server/service-imagery";
import type { MotifOption } from "@/lib/imagery/word-motifs";
import type { ImageryItem } from "@/lib/types";
import SongAnnotationWorkbench from "./SongAnnotationWorkbench";

vi.mock("@/lib/api/client-api", () => ({
  apiGetImagerySuggestions: vi.fn(),
  apiCreateOccurrencesBatch: vi.fn(),
  apiGetOccurrencesForSong: vi.fn(),
  apiReviewImagery: vi.fn(),
}));

const song = {
  id: 7,
  title: "测试",
  lyrics: [
    "[00:01.00]词：河图",
    "[00:10.00]明月照亮天涯",
    "[00:20.00]风过天地",
    "[01:10.00]明月照亮天涯",
  ].join("\n"),
};

const items: ImageryItem[] = [
  // 词典里有、但还没登记母题（数据不一致时会出现）
  {
    id: 1,
    name: "明月",
    count: 44,
    primary: null,
    alternatives: [],
    parts: [],
  },
  { id: 2, name: "天涯", count: 27, primary: 200, alternatives: [], parts: [] },
];
const motifs: MotifOption[] = [
  { id: 200, label: "自然事物 / 地理 / 区域" },
  { id: 100, label: "自然事物 / 天象 / 星相" },
];
const paths: Record<number, string> = {
  100: "自然事物 / 天象 / 星相",
  200: "自然事物 / 地理 / 区域",
};

function occurrence(
  patch: Partial<OccurrenceWithSong> & { id: number },
): OccurrenceWithSong {
  return {
    song_id: 7,
    imagery_id: 1,
    category_id: 100,
    lyric_timetag: [],
    song_title: "测试",
    song_album: null,
    imagery_name: "明月",
    ...patch,
  };
}

const onSave = vi.fn();
const onDelete = vi.fn();
const onReload = vi.fn();

function renderWorkbench(occurrences: OccurrenceWithSong[] = []) {
  return render(
    <SongAnnotationWorkbench
      song={song}
      occurrences={occurrences}
      loading={false}
      items={items}
      motifs={motifs}
      submitting={false}
      getCategoryPath={(id) => paths[id] ?? `分类 #${id}`}
      onSave={onSave}
      onDelete={onDelete}
      onReload={onReload}
    />,
  );
}

/** 歌词行元素（按时间标签定位） */
const line = (container: HTMLElement, tag: string) =>
  container.querySelector(`[data-tag="${tag}"]`) as HTMLElement;

beforeEach(() => {
  onSave.mockReset().mockResolvedValue(true);
  onDelete.mockReset();
  onReload.mockReset().mockResolvedValue(undefined);
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(cleanup);

describe("SongAnnotationWorkbench", () => {
  it("左侧展示完整歌词（含制作名单行），已标注的意象就地高亮", () => {
    const { container } = renderWorkbench([
      occurrence({ id: 1, lyric_timetag: ["00:10.00", "01:10.00"] }),
    ]);
    expect(line(container, "00:01.00").textContent).toContain("词：河图");
    const marks = line(container, "00:10.00").querySelectorAll("mark");
    expect([...marks].map((m) => m.textContent)).toEqual(["明月"]);
    expect(line(container, "00:20.00").querySelector("mark")).toBeNull();
    expect(screen.getByText("4 行 · 已标注 2 行")).toBeTruthy();
  });

  it("编辑已有标注：出现位置按歌词自动确定，点击歌词行不改动", async () => {
    const { container } = renderWorkbench([
      occurrence({ id: 1, lyric_timetag: ["00:10.00"] }),
    ]);
    fireEvent.click(screen.getByText("明月", { selector: "span" }));
    expect(screen.getByText("编辑标注 #1")).toBeTruthy();
    expect(screen.getByText(/出现位置 2 处/)).toBeTruthy();

    fireEvent.click(line(container, "00:10.00"));
    expect(screen.getByText(/出现位置 2 处/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "保存" }));

    expect(onSave).toHaveBeenCalledWith(1, {
      imageryId: 1,
      imageryName: "明月",
      categoryId: 100,
    });
  });

  it("新增标注：填已有的词时带出它的默认母题，列出它出现的行", () => {
    renderWorkbench();
    fireEvent.click(screen.getByRole("button", { name: /新增标注/ }));
    fireEvent.change(screen.getByPlaceholderText("输入或选择意象"), {
      target: { value: "天涯" },
    });
    expect(screen.getByText(/出现位置 2 处/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "保存" }));

    expect(onSave).toHaveBeenCalledWith(null, {
      imageryId: 2,
      imageryName: "天涯",
      categoryId: 200,
    });
  });

  it("新增标注：默认选登记的默认母题，下拉框只列登记的母题，「其他母题…」展开全部", () => {
    renderWorkbench();
    fireEvent.click(screen.getByRole("button", { name: /新增标注/ }));
    fireEvent.change(screen.getByPlaceholderText("输入或选择意象"), {
      target: { value: "天涯" },
    });
    const select = () =>
      screen.getByRole("combobox", { name: "母题" }) as HTMLSelectElement;
    const labels = () => [...select().options].map((o) => o.textContent);
    expect(select().value).toBe("200");
    expect(labels()).toEqual(["自然事物 / 地理 / 区域（通常）", "其他母题…"]);

    fireEvent.change(select(), { target: { value: "__all" } });
    expect(select().value).toBe("200");
    expect(labels()).toEqual([
      "自然事物 / 地理 / 区域",
      "自然事物 / 天象 / 星相",
    ]);
    fireEvent.change(select(), { target: { value: "100" } });
    expect(screen.getByText(/保存后会给它加一个「有时也指」/)).toBeTruthy();
  });

  it("没登记母题的词不预选，下拉框直接列全部", () => {
    renderWorkbench();
    fireEvent.click(screen.getByRole("button", { name: /新增标注/ }));
    fireEvent.change(screen.getByPlaceholderText("输入或选择意象"), {
      target: { value: "明月" },
    });
    const select = screen.getByRole("combobox", {
      name: "母题",
    }) as HTMLSelectElement;
    expect(select.value).toBe("");
    expect([...select.options].map((o) => o.value)).toEqual(["", "200", "100"]);
  });

  it("歌词里没有的词不能保存", () => {
    renderWorkbench();
    fireEvent.click(screen.getByRole("button", { name: /新增标注/ }));
    fireEvent.change(screen.getByPlaceholderText("输入或选择意象"), {
      target: { value: "孤灯" },
    });
    fireEvent.change(screen.getByDisplayValue("— 选择母题 —"), {
      target: { value: "200" },
    });
    expect(screen.getByText(/歌词里没有这个词/)).toBeTruthy();
    expect(
      (screen.getByRole("button", { name: "保存" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });

  it("词典里没有的词标为新词，保存时 imageryId 为 null", () => {
    renderWorkbench();
    fireEvent.click(screen.getByRole("button", { name: /新增标注/ }));
    fireEvent.change(screen.getByPlaceholderText("输入或选择意象"), {
      target: { value: "天地" },
    });
    expect(screen.getByText("词典里没有，保存时随标注创建")).toBeTruthy();

    // 新词没有登记的母题，未选母题前不能保存
    const saveButton = screen.getByRole("button", { name: "保存" });
    expect((saveButton as HTMLButtonElement).disabled).toBe(true);

    fireEvent.change(screen.getByDisplayValue("— 选择母题 —"), {
      target: { value: "200" },
    });
    fireEvent.click(saveButton);
    expect(onSave).toHaveBeenCalledWith(null, {
      imageryId: null,
      imageryName: "天地",
      categoryId: 200,
    });
  });

  it("同一首歌不能重复标同一个词", () => {
    renderWorkbench([occurrence({ id: 1, lyric_timetag: ["00:10.00"] })]);
    fireEvent.click(screen.getByRole("button", { name: /新增标注/ }));
    fireEvent.change(screen.getByPlaceholderText("输入或选择意象"), {
      target: { value: "明月" },
    });
    expect(screen.getByText("这首歌已经标过这个词")).toBeTruthy();
    expect(
      (screen.getByRole("button", { name: "保存" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "打开那一条" }));
    expect(screen.getByText("编辑标注 #1")).toBeTruthy();
  });

  it("提示歌词中已找不到的时间标签", () => {
    renderWorkbench([
      occurrence({ id: 1, lyric_timetag: ["00:10.00", "03:00.00"] }),
    ]);
    expect(screen.getByText("1 个时间在歌词中找不到")).toBeTruthy();
  });

  it("删除要点两次，不触发编辑", () => {
    renderWorkbench([occurrence({ id: 1, lyric_timetag: ["00:10.00"] })]);
    fireEvent.click(screen.getByRole("button", { name: "删除" }));
    expect(onDelete).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "确认删除" }));
    expect(onDelete).toHaveBeenCalledWith(1, "明月");
    expect(screen.queryByText("编辑标注 #1")).toBeNull();
  });

  it("候选审核：生成候选后在歌词中标出，批量保存后刷新标注", async () => {
    vi.mocked(apiGetImagerySuggestions).mockResolvedValue({
      published: true,
      hasLyrics: true,
      llmEnabled: false,
      suggestions: [
        {
          imageryId: 2,
          name: "天涯",
          timetags: ["00:10.00", "01:10.00"],
          lines: ["明月照亮天涯", "明月照亮天涯"],
          categoryIds: [200],
          seen: 10,
          annotated: 5,
          rate: 0.5,
          recommended: true,
        },
      ],
    });
    vi.mocked(apiCreateOccurrencesBatch).mockResolvedValue({
      created: 1,
      skipped: 0,
      newImagery: 0,
    });
    const { container } = renderWorkbench([
      occurrence({ id: 1, lyric_timetag: ["00:10.00"] }),
    ]);

    fireEvent.click(screen.getByRole("tab", { name: /候选审核/ }));
    fireEvent.click(screen.getByRole("button", { name: "从歌词生成候选" }));
    expect(
      await screen.findByRole("tab", { name: "候选审核 1/1" }),
    ).toBeTruthy();

    // 已有标注与勾选的候选在同一行里各自高亮
    const marks = [...line(container, "00:10.00").querySelectorAll("mark")];
    expect(marks.map((m) => m.textContent)).toEqual(["明月", "天涯"]);
    expect(marks[1].className).toContain("decoration-dashed");

    fireEvent.click(screen.getByRole("button", { name: "保存选中" }));
    await vi.waitFor(() => expect(onReload).toHaveBeenCalled());
    expect(apiCreateOccurrencesBatch).toHaveBeenCalledWith(7, [
      { imagery_id: 2, category_id: 200 },
    ]);
  });
});
