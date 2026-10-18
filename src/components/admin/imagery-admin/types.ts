import type { ImageryCategory, ImageryItem } from "@/lib/types";

export type ModalState =
  | { type: "none" }
  | { type: "add-imagery" }
  | { type: "edit-imagery"; item: ImageryItem }
  | { type: "add-category"; parentId?: number }
  | { type: "edit-category"; category: ImageryCategory };

export type SongOption = {
  id: number;
  title: string;
  album?: string | null;
  /** 暂存表中的 LRC 歌词，对照编辑时展示 */
  lyrics?: string | null;
};

export type CategoryNode = ImageryCategory & {
  children: CategoryNode[];
};
