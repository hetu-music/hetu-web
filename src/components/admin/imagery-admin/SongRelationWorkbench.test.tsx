// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { OccurrenceWithSong } from "@/lib/server/service-imagery";
import type { ImageryCategory, ImageryItem } from "@/lib/types";
import SongRelationWorkbench from "./SongRelationWorkbench";

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
  { id: 1, name: "明月", count: 44, categoryIds: [100], meaningCount: 0 },
  { id: 2, name: "天涯", count: 27, categoryIds: [200], meaningCount: 0 },
];
const leafCategories: ImageryCategory[] = [
  { id: 100, name: "星相", parent_id: 10, level: 3, description: null },
  { id: 200, name: "区域", parent_id: 20, level: 3, description: null },
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
    meaning_id: null,
    lyric_timetag: [],
    song_title: "测试",
    song_album: null,
    imagery_name: "明月",
    ...patch,
  };
}

const onSave = vi.fn();
const onDelete = vi.fn();

function renderWorkbench(occurrences: OccurrenceWithSong[] = []) {
  return render(
    <SongRelationWorkbench
      song={song}
      occurrences={occurrences}
      loading={false}
      items={items}
      leafCategories={leafCategories}
      meanings={[]}
      submitting={false}
      getCategoryPath={(id) => paths[id] ?? `分类 #${id}`}
      onSave={onSave}
      onDelete={onDelete}
    />,
  );
}

/** 歌词行元素（按时间标签定位） */
const line = (container: HTMLElement, tag: string) =>
  container.querySelector(`[data-tag="${tag}"]`) as HTMLElement;

beforeEach(() => {
  onSave.mockReset().mockResolvedValue(true);
  onDelete.mockReset();
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(cleanup);

describe("SongRelationWorkbench", () => {
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

  it("编辑已有关系：点击歌词行增删时间标签后保存", async () => {
    const { container } = renderWorkbench([
      occurrence({ id: 1, lyric_timetag: ["00:10.00"] }),
    ]);
    fireEvent.click(screen.getByText("明月", { selector: "span" }));
    expect(screen.getByText("编辑关系 #1")).toBeTruthy();

    fireEvent.click(line(container, "01:10.00"));
    fireEvent.click(line(container, "00:10.00"));
    fireEvent.click(screen.getByRole("button", { name: "保存" }));

    expect(onSave).toHaveBeenCalledWith(1, {
      imageryId: 1,
      imageryName: "明月",
      categoryId: 100,
      meaningId: null,
      timetags: ["01:10.00"],
    });
  });

  it("新增关系：填已有意象时带出常用分类，匹配全部行", () => {
    renderWorkbench();
    fireEvent.click(screen.getByRole("button", { name: /新增关系/ }));
    fireEvent.change(screen.getByPlaceholderText("输入或选择意象"), {
      target: { value: "天涯" },
    });
    fireEvent.click(screen.getByRole("button", { name: /匹配全部行/ }));
    fireEvent.click(screen.getByRole("button", { name: "保存" }));

    expect(onSave).toHaveBeenCalledWith(null, {
      imageryId: 2,
      imageryName: "天涯",
      categoryId: 200,
      meaningId: null,
      timetags: ["00:10.00", "01:10.00"],
    });
  });

  it("词典里没有的意象标为新意象，保存时 imageryId 为 null", () => {
    const { container } = renderWorkbench();
    fireEvent.click(screen.getByRole("button", { name: /新增关系/ }));
    fireEvent.change(screen.getByPlaceholderText("输入或选择意象"), {
      target: { value: "天地" },
    });
    expect(screen.getByText("新意象，保存时创建")).toBeTruthy();

    // 新意象没有常用分类，未选分类前不能保存
    fireEvent.click(line(container, "00:20.00"));
    const saveButton = screen.getByRole("button", { name: "保存" });
    expect((saveButton as HTMLButtonElement).disabled).toBe(true);

    fireEvent.change(screen.getByDisplayValue("— 选择分类 —"), {
      target: { value: "200" },
    });
    fireEvent.click(saveButton);
    expect(onSave).toHaveBeenCalledWith(null, {
      imageryId: null,
      imageryName: "天地",
      categoryId: 200,
      meaningId: null,
      timetags: ["00:20.00"],
    });
  });

  it("同一首歌不能重复添加同一意象", () => {
    renderWorkbench([occurrence({ id: 1, lyric_timetag: ["00:10.00"] })]);
    fireEvent.click(screen.getByRole("button", { name: /新增关系/ }));
    fireEvent.change(screen.getByPlaceholderText("输入或选择意象"), {
      target: { value: "明月" },
    });
    expect(screen.getByText("这首歌已有这个意象")).toBeTruthy();
    expect(
      (screen.getByRole("button", { name: "保存" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "打开那一条" }));
    expect(screen.getByText("编辑关系 #1")).toBeTruthy();
  });

  it("提示歌词中已找不到的时间标签", () => {
    renderWorkbench([
      occurrence({ id: 1, lyric_timetag: ["00:10.00", "03:00.00"] }),
    ]);
    expect(screen.getByText("1 个时间在歌词中找不到")).toBeTruthy();
  });

  it("删除按钮交给上层确认，不触发编辑", () => {
    renderWorkbench([occurrence({ id: 1, lyric_timetag: ["00:10.00"] })]);
    fireEvent.click(screen.getByRole("button", { name: "删除「明月」" }));
    expect(onDelete).toHaveBeenCalledWith(1, "明月");
    expect(screen.queryByText("编辑关系 #1")).toBeNull();
  });
});
