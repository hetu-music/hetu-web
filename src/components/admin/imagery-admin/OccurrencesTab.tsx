import type { OccurrenceWithSong } from "@/lib/server/service-imagery";
import type { ImageryCategory, ImageryItem, ImageryMeaning } from "@/lib/types";
import { ChevronDown, ChevronRight, Layers } from "lucide-react";
import Pagination from "@/components/shared/Pagination";
import { EmptyState, LoadingState } from "./shared";
import SongRelationWorkbench from "./SongRelationWorkbench";
import type { SongOption } from "./types";
import type { RelationDraft } from "./useOccurrencesTab";

/** 关系管理：按歌曲列出，展开后进入「左歌词、右意象」的对照编辑 */
export default function OccurrencesTab({
  songSearchTerm,
  songsLoading,
  pagedSongs,
  occurrencesBySong,
  expandedSongId,
  occurrenceLoadingSongId,
  occurrenceSubmitting,
  items,
  leafCategories,
  meanings,
  currentPage,
  totalPages,
  onPageChange,
  onToggleSongPanel,
  onSaveRelation,
  onDeleteRelation,
  onReloadSong,
  getCategoryPath,
  csrfToken,
}: {
  songSearchTerm: string;
  songsLoading: boolean;
  pagedSongs: SongOption[];
  occurrencesBySong: Record<number, OccurrenceWithSong[]>;
  expandedSongId: number | null;
  occurrenceLoadingSongId: number | null;
  occurrenceSubmitting: boolean;
  items: ImageryItem[];
  leafCategories: ImageryCategory[];
  meanings: ImageryMeaning[];
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onToggleSongPanel: (songId: number) => Promise<void>;
  onSaveRelation: (
    songId: number,
    occurrenceId: number | null,
    draft: RelationDraft,
  ) => Promise<boolean>;
  onDeleteRelation: (
    occurrenceId: number,
    songId: number,
    label: string,
  ) => void;
  /** 候选批量保存后刷新该歌的关系与意象列表 */
  onReloadSong: (songId: number) => Promise<unknown>;
  getCategoryPath: (categoryId: number) => string;
  csrfToken: string;
}) {
  if (songsLoading) return <LoadingState text="加载歌曲中…" />;
  if (pagedSongs.length === 0) {
    return (
      <EmptyState
        icon={<Layers size={24} />}
        title={songSearchTerm ? "没有找到匹配的歌曲" : "暂无歌曲"}
        description={
          songSearchTerm ? "试试别的关键词。" : "当前没有可管理关系的歌曲。"
        }
      />
    );
  }

  return (
    <div className="space-y-3">
      {pagedSongs.map((song) => {
        const occurrences = occurrencesBySong[song.id];
        const isExpanded = expandedSongId === song.id;

        return (
          <div
            key={song.id}
            className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white transition-all hover:border-blue-200 hover:shadow-md dark:border-slate-800 dark:bg-slate-900/50 dark:hover:border-blue-900/30"
          >
            <button
              type="button"
              onClick={() => void onToggleSongPanel(song.id)}
              className="flex items-center gap-3 px-4 py-4 text-left"
            >
              <span className="rounded-xl p-2 text-slate-500">
                {isExpanded ? (
                  <ChevronDown size={16} />
                ) : (
                  <ChevronRight size={16} />
                )}
              </span>
              <span className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                <span className="text-base font-semibold text-slate-900 dark:text-slate-100">
                  {song.title}
                </span>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                  song_id {song.id}
                </span>
                {song.album && (
                  <span className="text-sm text-slate-500 dark:text-slate-400">
                    {song.album}
                  </span>
                )}
                {occurrences && (
                  <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[11px] text-violet-700 dark:bg-violet-900/20 dark:text-violet-300">
                    {occurrences.length} 条关系
                  </span>
                )}
                {!song.lyrics?.trim() && (
                  <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] text-amber-700 dark:bg-amber-900/20 dark:text-amber-300">
                    无歌词
                  </span>
                )}
              </span>
              <span className="text-xs text-slate-400">
                {isExpanded ? "收起" : "对照编辑"}
              </span>
            </button>

            {isExpanded && (
              <div className="border-t border-slate-200/70 bg-slate-50/50 p-4 dark:border-slate-800/70 dark:bg-black/10">
                <SongRelationWorkbench
                  song={song}
                  occurrences={occurrences ?? []}
                  loading={occurrenceLoadingSongId === song.id && !occurrences}
                  items={items}
                  leafCategories={leafCategories}
                  meanings={meanings}
                  submitting={occurrenceSubmitting}
                  getCategoryPath={getCategoryPath}
                  csrfToken={csrfToken}
                  onReload={() => onReloadSong(song.id)}
                  onSave={(occurrenceId, draft) =>
                    onSaveRelation(song.id, occurrenceId, draft)
                  }
                  onDelete={(occurrenceId, label) =>
                    onDeleteRelation(occurrenceId, song.id, label)
                  }
                />
              </div>
            )}
          </div>
        );
      })}

      <div className="pt-4">
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={onPageChange}
        />
      </div>
    </div>
  );
}
