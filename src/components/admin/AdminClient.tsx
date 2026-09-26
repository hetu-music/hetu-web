"use client";

import { AlertCircle, Plus, Search, XCircle } from "lucide-react";
import { parseAsInteger, parseAsString } from "nuqs";
import { useCallback, useEffect, useMemo, useState } from "react";
import FloatingActionButtons from "@/components/shared/FloatingActionButtons";
import Pagination from "@/components/shared/Pagination";
import { useUserContext } from "@/context/UserContext";
import { useSongs } from "@/hooks/library/useSongs";
import { useScrollTop } from "@/hooks/ui/useScrollTop";
import { useSyncedQueryState } from "@/hooks/utils/useSyncedQueryState";
import type { SongDetail } from "@/lib/types";
import { cn } from "@/lib/utils/utils";
import Notification from "./Notification";
import AdminNavbar from "./song-admin/AdminNavbar";
import {
  OperationToast,
  PublishConfirmDialog,
  SearchResultsModal,
} from "./song-admin/SongAdminDialogs";
import SongFormModal from "./song-admin/SongFormModal";
import SongListRow from "./song-admin/SongListRow";
import { useSongAdmin } from "./song-admin/useSongAdmin";
import { isSongIncomplete } from "./song-admin/utils";

const ITEMS_PER_PAGE = 24;

export default function AdminClientComponent({
  initialSongs,
  initialError,
}: {
  initialSongs: SongDetail[];
  initialError: string | null;
}) {
  const { user } = useUserContext();
  const { showScrollTop, scrollToTop } = useScrollTop();

  // ─── 列表：搜索 / 筛选 / 分页 ───────────────────────────────────────────────
  const [searchTerm, setSearchTerm] = useSyncedQueryState<string>(
    "q",
    parseAsString.withDefault("").withOptions({ shallow: true }),
  );
  const [currentPage, setCurrentPage] = useSyncedQueryState<number>(
    "page",
    parseAsInteger.withDefault(1).withOptions({ shallow: true }),
  );
  const [showIncompleteOnly, setShowIncompleteOnly] = useState(false);

  const {
    songs,
    setSongs,
    loading,
    sortedSongs: baseSortedSongs,
  } = useSongs(initialSongs, initialError, searchTerm);

  const sortedSongs = useMemo(
    () =>
      showIncompleteOnly
        ? baseSortedSongs.filter(isSongIncomplete)
        : baseSortedSongs,
    [baseSortedSongs, showIncompleteOnly],
  );

  const totalPages = Math.max(
    1,
    Math.ceil(sortedSongs.length / ITEMS_PER_PAGE),
  );
  const safePage = Math.min(Math.max(1, currentPage), totalPages);
  const startIndex = (safePage - 1) * ITEMS_PER_PAGE + 1;
  const paginatedSongs = useMemo(
    () =>
      sortedSongs.slice(
        (safePage - 1) * ITEMS_PER_PAGE,
        safePage * ITEMS_PER_PAGE,
      ),
    [sortedSongs, safePage],
  );

  useEffect(() => {
    if (safePage !== currentPage) setCurrentPage(safePage);
  }, [currentPage, safePage, setCurrentPage]);

  const handlePageChange = useCallback(
    (page: number) => setCurrentPage(Math.max(1, page)),
    [setCurrentPage],
  );

  /** 切换筛选条件时回到第一页 */
  const applyIncompleteFilter = useCallback(
    (incompleteOnly: boolean) => {
      setShowIncompleteOnly(incompleteOnly);
      setCurrentPage(1);
    },
    [setCurrentPage],
  );

  // ─── 表单 / 发布 / 自动补全 ────────────────────────────────────────────────
  const admin = useSongAdmin(setSongs);

  return (
    <div className="min-h-screen bg-[#FAFAFA] dark:bg-[#0B0F19] transition-colors duration-500 font-sans">
      <AdminNavbar
        userName={user?.name}
        isLoggedIn={Boolean(user)}
        onOpenNotification={() => admin.setShowNotification(true)}
      />

      <main className="pt-24 pb-20 max-w-7xl mx-auto px-6">
        {/* Header & Stats */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
          <div>
            <h1 className="text-4xl font-bold text-slate-900 dark:text-slate-50 mb-4">
              歌曲管理
            </h1>
            <div className="flex flex-wrap gap-3">
              <div className="px-3 py-1 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 rounded-full text-sm font-medium border border-blue-100 dark:border-blue-800">
                总计 {songs.length} 首
              </div>
              {showIncompleteOnly && (
                <div className="px-3 py-1 bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 rounded-full text-sm font-medium border border-amber-100 dark:border-amber-800">
                  待完善 {sortedSongs.length} 首
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={admin.openAddForm}
              className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-full font-medium shadow-lg shadow-blue-500/20 transition-all hover:-translate-y-0.5"
            >
              <Plus size={20} />
              <span>新增歌曲</span>
            </button>
          </div>
        </div>

        {/* Controls Bar */}
        <div className="sticky top-20 z-40 bg-[#FAFAFA]/95 dark:bg-[#0B0F19]/95 backdrop-blur-sm py-4 mb-8 -mx-6 px-6 border-y border-transparent data-[scrolled=true]:border-slate-100">
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            {/* Filter Pills */}
            <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto no-scrollbar">
              <button
                onClick={() => applyIncompleteFilter(false)}
                className={cn(
                  "px-4 py-1.5 rounded-full text-sm border transition-all whitespace-nowrap",
                  !showIncompleteOnly
                    ? "bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900 dark:border-white"
                    : "bg-transparent text-slate-500 border-slate-200 dark:border-slate-800 hover:border-slate-300",
                )}
              >
                全部歌曲
              </button>
              <button
                onClick={() => applyIncompleteFilter(true)}
                className={cn(
                  "px-4 py-1.5 rounded-full text-sm border transition-all whitespace-nowrap flex items-center gap-1.5",
                  showIncompleteOnly
                    ? "bg-amber-100 text-amber-900 border-amber-200 dark:bg-amber-500/20 dark:text-amber-200 dark:border-amber-500/30"
                    : "bg-transparent text-slate-500 border-slate-200 dark:border-slate-800 hover:border-amber-300 hover:text-amber-600",
                )}
              >
                <AlertCircle size={14} />
                待完善
              </button>
            </div>

            {/* Search */}
            <div className="relative group w-full md:w-64">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                size={16}
              />
              <input
                type="text"
                placeholder="搜索标题、专辑、作者..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-full py-2 pl-9 pr-8 text-sm outline-none focus:border-blue-500 transition-colors"
              />
              {searchTerm && (
                <button
                  onClick={() => {
                    setSearchTerm("");
                    setCurrentPage(1);
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-300 hover:text-slate-500"
                >
                  <XCircle size={14} />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* List Content */}
        <div className="space-y-4 min-h-[50vh]">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400">
              <div className="w-8 h-8 border-2 border-slate-200 border-t-blue-500 rounded-full animate-spin mb-4" />
              <p className="font-light">Loading...</p>
            </div>
          ) : sortedSongs.length > 0 ? (
            <>
              {/* List Header (Desktop) */}
              <div className="hidden lg:flex px-4 py-2 text-xs font-bold tracking-wider text-slate-400 uppercase border-b border-slate-100 dark:border-slate-800 mb-2">
                <div className="w-8 shrink-0 text-center">#</div>
                <div className="w-12 shrink-0 ml-4 mr-0">Cover</div>
                <div className="flex-1 ml-4">Basic Info</div>
                <div className="w-32 mr-6 text-right">Composer</div>
                <div className="w-24 text-center mr-6">Type</div>
                <div className="w-20 ml-2">Actions</div>
              </div>

              <div className="flex flex-col gap-3">
                {paginatedSongs.map((song, i) => (
                  <SongListRow
                    key={song.id}
                    song={song}
                    idx={startIndex + i}
                    isExpanded={admin.expandedRows.has(song.id)}
                    toggleRowExpansion={admin.toggleRowExpansion}
                    handleEdit={admin.startEdit}
                    csrfToken={admin.csrfToken}
                  />
                ))}
              </div>

              <div className="mt-12 flex justify-center">
                <Pagination
                  currentPage={safePage}
                  totalPages={totalPages}
                  onPageChange={handlePageChange}
                />
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400">
              <Search size={48} className="mb-4 opacity-20" />
              <p className="font-light">没有找到符合条件的歌曲</p>
            </div>
          )}
        </div>
      </main>

      <FloatingActionButtons
        showScrollTop={showScrollTop}
        onScrollToTop={scrollToTop}
      />

      {admin.operationMsg && <OperationToast message={admin.operationMsg} />}

      {admin.formMode && (
        <SongFormModal
          formMode={admin.formMode}
          editSong={admin.editSong}
          songForm={admin.songForm}
          csrfToken={admin.csrfToken}
          isPublishing={admin.isPublishing}
          isAutoCompleting={admin.autoComplete.isAutoCompleting}
          currentProvider={admin.autoComplete.currentProvider}
          onAutoComplete={admin.runAutoComplete}
          onSubmit={admin.handleSongSubmit}
          onPublishClick={admin.handlePublishClick}
          onClose={admin.closeSongForm}
        />
      )}

      {admin.autoComplete.showSearchResults && (
        <SearchResultsModal
          results={admin.autoComplete.searchResults}
          onSelect={admin.selectSearchResult}
          onClose={admin.autoComplete.closeSearchResults}
        />
      )}

      {admin.showPublishConfirm && (
        <PublishConfirmDialog
          songTitle={admin.editSong?.title}
          isPublishing={admin.isPublishing}
          onConfirm={() => {
            admin.setShowPublishConfirm(false);
            admin.handlePublish();
          }}
          onCancel={() => admin.setShowPublishConfirm(false)}
        />
      )}

      {admin.showNotification && (
        <Notification onClose={() => admin.setShowNotification(false)} />
      )}
    </div>
  );
}
