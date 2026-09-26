"use client";

import ThemeToggle from "@/components/shared/ThemeToggle";
import { useUserContext } from "@/context/UserContext";
import { useCsrfToken } from "@/hooks/utils/useCsrfToken";
import type { ImageryCategory } from "@/lib/types";
import {
  BookOpen,
  Home,
  Layers,
  ListTree,
  Music,
  Plus,
  Search,
  Tag,
  User,
  XCircle,
} from "lucide-react";
import { Link } from "@/i18n/navigation";
import type { ReactNode } from "react";
import { useCallback, useMemo, useState } from "react";
import CategoriesTab from "./imagery-admin/CategoriesTab";
import ImageryAdminModals from "./imagery-admin/ImageryAdminModals";
import ImageryTab from "./imagery-admin/ImageryTab";
import MeaningsTab from "./imagery-admin/MeaningsTab";
import OccurrencesTab from "./imagery-admin/OccurrencesTab";
import { cn } from "./imagery-admin/shared";
import type { Tab } from "./imagery-admin/types";
import { useCategoriesTab } from "./imagery-admin/useCategoriesTab";
import { useImageryTab } from "./imagery-admin/useImageryTab";
import { useMeaningsTab } from "./imagery-admin/useMeaningsTab";
import { useOccurrencesTab } from "./imagery-admin/useOccurrencesTab";

interface Props {
  initialCategories: ImageryCategory[];
}

export default function ImageryAdminClient({ initialCategories }: Props) {
  const { user } = useUserContext();
  const csrfToken = useCsrfToken();
  // 关系管理是日常最常用的入口，默认打开
  const [activeTab, setActiveTab] = useState<Tab>("occurrences");
  const [toast, setToast] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const showToast = useCallback((type: "success" | "error", text: string) => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 3000);
  }, []);

  // ── Tab hooks ──────────────────────────────────────────────────────────────

  const imagery = useImageryTab(csrfToken, showToast);
  const categories = useCategoriesTab(initialCategories, csrfToken, showToast);
  const meanings = useMeaningsTab(csrfToken, showToast);
  const occurrences = useOccurrencesTab(
    csrfToken,
    showToast,
    imagery.refreshItems,
  );

  // ── Derived state shared across tabs ──────────────────────────────────────

  const imageryCountByCategory = useMemo(() => {
    const counts = new Map<number, number>();
    imagery.items.forEach((item) => {
      item.categoryIds.forEach((categoryId) => {
        let currentId: number | null = categoryId;
        while (currentId) {
          counts.set(currentId, (counts.get(currentId) ?? 0) + 1);
          const currentCategory = categories.categories.find(
            (category) => category.id === currentId,
          );
          currentId = currentCategory?.parent_id ?? null;
        }
      });
    });
    return counts;
  }, [categories.categories, imagery.items]);

  const leafCategories = useMemo(() => {
    const parentIds = new Set(
      categories.categories
        .map((category) => category.parent_id)
        .filter((value): value is number => value !== null),
    );
    return categories.categories.filter(
      (category) => !parentIds.has(category.id),
    );
  }, [categories.categories]);

  // ── Active modal (one at a time across all tabs) ───────────────────────────
  // Each tab manages its own modal state; we pick the active one for the modal renderer.
  const activeModal =
    activeTab === "imagery"
      ? imagery.modal
      : activeTab === "categories"
        ? categories.modal
        : activeTab === "meanings"
          ? meanings.modal
          : occurrences.modal;

  const closeActiveModal = () => {
    if (activeTab === "imagery") imagery.closeModal();
    else if (activeTab === "categories") categories.closeModal();
    else if (activeTab === "meanings") meanings.closeModal();
    else occurrences.closeModal();
  };

  // ── Tab config ─────────────────────────────────────────────────────────────

  const tabs: { key: Tab; label: string; icon: ReactNode; hint: string }[] = [
    {
      key: "occurrences",
      label: "关系管理",
      icon: <Layers size={14} />,
      hint: "按歌曲对照编辑",
    },
    {
      key: "imagery",
      label: "意象管理",
      icon: <Tag size={14} />,
      hint: "词条与概览",
    },
    {
      key: "categories",
      label: "分类管理",
      icon: <ListTree size={14} />,
      hint: "树形与分页",
    },
    {
      key: "meanings",
      label: "含义管理",
      icon: <BookOpen size={14} />,
      hint: "全局含义库",
    },
  ];

  return (
    <div className="min-h-screen bg-[#FAFAFA] font-sans transition-colors duration-500 dark:bg-[#0B0F19]">
      <nav className="fixed left-0 right-0 top-0 z-50 border-b border-slate-200/50 bg-[#FAFAFA]/80 backdrop-blur-md dark:border-slate-800/50 dark:bg-[#0B0F19]/80">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between gap-4 px-6">
          <div className="shrink-0 flex items-center gap-1.5 bg-slate-200/50 dark:bg-slate-900/50 backdrop-blur-md border border-slate-200/30 dark:border-slate-800/60 rounded-full p-1 shadow-inner relative">
            {/* 歌曲管理 (当前未激活态) */}
            <Link
              href="/admin"
              className="group relative flex items-center gap-2 px-3 sm:px-5 py-2 rounded-full text-sm font-medium tracking-wide text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-white/60 dark:hover:bg-slate-800/40 hover:shadow-xs transition-all duration-300"
            >
              <Music
                size={14}
                className="text-slate-400 dark:text-slate-500 group-hover:text-blue-500 dark:group-hover:text-blue-400 transition-colors duration-300 group-hover:scale-110 shrink-0"
              />
              <span className="hidden sm:inline">歌曲管理</span>
            </Link>

            {/* 意象管理 (当前激活态 - 紫色主题) */}
            <span className="relative flex items-center gap-2 px-3 sm:px-5 py-2 rounded-full text-sm font-medium tracking-wide bg-linear-to-r from-violet-600 to-fuchsia-600 dark:from-violet-500 dark:to-fuchsia-500 text-white shadow-md shadow-violet-500/20 dark:shadow-violet-500/10 transition-all select-none">
              <Tag size={14} className="sm:animate-pulse shrink-0" />
              <span className="hidden sm:inline">意象管理</span>
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Link
              href="/"
              className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-200/50 dark:text-slate-400 dark:hover:bg-slate-800"
              title="返回主页"
            >
              <Home size={18} />
            </Link>
            <Link
              href="/profile"
              className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-200/50 dark:text-slate-400 dark:hover:bg-slate-800"
              title={user?.name ?? "个人中心"}
            >
              <User
                size={18}
                className={user ? "text-blue-500 dark:text-blue-400" : ""}
              />
            </Link>
            <ThemeToggle className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-200/50 dark:text-slate-400 dark:hover:bg-slate-800" />
          </div>
        </div>
      </nav>

      <main className="pt-24 pb-20 max-w-7xl mx-auto px-6">
        {/* Header & Stats */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
          <div>
            <h1 className="text-4xl font-bold text-slate-900 dark:text-slate-50 mb-4">
              意象管理
            </h1>
            <div className="flex flex-wrap gap-3">
              <div className="px-3 py-1 bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300 rounded-full text-sm font-medium border border-violet-100 dark:border-violet-800">
                总计意象 {imagery.items.length} 个
              </div>
              <div className="px-3 py-1 bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 rounded-full text-sm font-medium border border-amber-100 dark:border-amber-800">
                分类 {categories.categories.length} 个
              </div>
              <div className="px-3 py-1 bg-cyan-50 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300 rounded-full text-sm font-medium border border-cyan-100 dark:border-cyan-800">
                含义 {meanings.meanings.length} 条
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {activeTab === "imagery" && (
              <button
                onClick={imagery.openAdd}
                className="flex items-center gap-2 px-6 py-3 bg-violet-600 hover:bg-violet-500 text-white rounded-full font-medium shadow-lg shadow-violet-500/20 transition-all hover:-translate-y-0.5"
              >
                <Plus size={20} />
                <span>新增意象</span>
              </button>
            )}
            {activeTab === "categories" && (
              <button
                onClick={() => categories.openAdd()}
                className="flex items-center gap-2 px-6 py-3 bg-cyan-600 hover:bg-cyan-500 text-white rounded-full font-medium shadow-lg shadow-cyan-500/20 transition-all hover:-translate-y-0.5"
              >
                <Plus size={20} />
                <span>新增顶级分类</span>
              </button>
            )}
            {activeTab === "meanings" && (
              <button
                onClick={meanings.startAdd}
                className="flex items-center gap-2 px-6 py-3 bg-amber-600 hover:bg-amber-500 text-white rounded-full font-medium shadow-lg shadow-amber-500/20 transition-all hover:-translate-y-0.5"
              >
                <Plus size={20} />
                <span>新增含义</span>
              </button>
            )}
          </div>
        </div>

        {/* Controls Bar */}
        <div className="sticky top-20 z-40 bg-[#FAFAFA]/95 dark:bg-[#0B0F19]/95 backdrop-blur-sm py-4 mb-8 -mx-6 px-6 border-y border-transparent data-[scrolled=true]:border-slate-100">
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            {/* Tab Pills */}
            <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto no-scrollbar">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={cn(
                    "px-4 py-1.5 rounded-full text-sm border transition-all whitespace-nowrap flex items-center gap-1.5",
                    activeTab === tab.key
                      ? "bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900 dark:border-white"
                      : "bg-transparent text-slate-500 border-slate-200 dark:border-slate-800 hover:border-slate-300 hover:text-slate-900 dark:hover:text-slate-300",
                  )}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Search */}
            {(activeTab === "imagery" ||
              activeTab === "meanings" ||
              activeTab === "occurrences") && (
              <div className="relative group w-full md:w-64">
                <Search
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  size={16}
                />
                <input
                  type="text"
                  placeholder={
                    activeTab === "imagery"
                      ? "搜索意象名称..."
                      : activeTab === "meanings"
                        ? "搜索含义标签或描述..."
                        : "搜索歌曲标题、专辑..."
                  }
                  value={
                    activeTab === "imagery"
                      ? imagery.searchTerm
                      : activeTab === "meanings"
                        ? meanings.searchTerm
                        : occurrences.songSearchTerm
                  }
                  onChange={(e) => {
                    const value = e.target.value;
                    if (activeTab === "imagery") {
                      imagery.setSearchTerm(value);
                      imagery.setPage(1);
                    } else if (activeTab === "meanings") {
                      meanings.setSearchTerm(value);
                      meanings.setPage(1);
                    } else if (activeTab === "occurrences") {
                      occurrences.setSongSearchTerm(value);
                      occurrences.setSongsPage(1);
                    }
                  }}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-full py-2 pl-9 pr-8 text-sm outline-none focus:border-violet-500 transition-colors"
                />
                {((activeTab === "imagery" && imagery.searchTerm) ||
                  (activeTab === "meanings" && meanings.searchTerm) ||
                  (activeTab === "occurrences" &&
                    occurrences.songSearchTerm)) && (
                  <button
                    onClick={() => {
                      if (activeTab === "imagery") {
                        imagery.setSearchTerm("");
                        imagery.setPage(1);
                      } else if (activeTab === "meanings") {
                        meanings.setSearchTerm("");
                        meanings.setPage(1);
                      } else if (activeTab === "occurrences") {
                        occurrences.setSongSearchTerm("");
                        occurrences.setSongsPage(1);
                      }
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-300 hover:text-slate-500"
                  >
                    <XCircle size={14} />
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4 min-h-[50vh]">
          {activeTab === "imagery" && (
            <ImageryTab
              categories={categories.categories}
              itemsLoading={imagery.itemsLoading}
              itemsError={imagery.itemsError}
              searchTerm={imagery.searchTerm}
              pagedItems={imagery.pagedItems}
              currentPage={imagery.currentPage}
              totalPages={imagery.totalPages}
              onPageChange={imagery.setPage}
              onEdit={imagery.openEdit}
            />
          )}

          {activeTab === "categories" && (
            <CategoriesTab
              categoryTree={categories.categoryTree}
              imageryCountByCategory={imageryCountByCategory}
              categories={categories.categories}
              onAddCategory={categories.openAdd}
              onEditCategory={categories.openEdit}
            />
          )}

          {activeTab === "meanings" && (
            <MeaningsTab
              meaningsLoading={meanings.meaningsLoading}
              meaningsSearchTerm={meanings.searchTerm}
              pagedMeanings={meanings.pagedMeanings}
              addingMeaning={meanings.addingMeaning}
              editingMeaning={meanings.editingMeaning}
              meaningSubmitting={meanings.meaningSubmitting}
              currentPage={meanings.currentPage}
              totalPages={meanings.totalPages}
              onPageChange={meanings.setPage}
              onStartEdit={meanings.startEdit}
              onStartDelete={meanings.openDeleteModal}
              onReset={meanings.resetEditor}
              onCreate={meanings.handleCreate}
              onUpdate={meanings.handleUpdate}
            />
          )}

          {activeTab === "occurrences" && (
            <OccurrencesTab
              songSearchTerm={occurrences.songSearchTerm}
              songsLoading={occurrences.songsLoading}
              pagedSongs={occurrences.pagedSongs}
              currentPage={occurrences.currentSongsPage}
              totalPages={occurrences.songsTotalPages}
              expandedSongId={occurrences.expandedSongId}
              occurrencesBySong={occurrences.occurrencesBySong}
              occurrenceLoadingSongId={occurrences.occurrenceLoadingSongId}
              occurrenceSubmitting={occurrences.occurrenceSubmitting}
              items={imagery.items}
              meanings={meanings.meanings}
              leafCategories={leafCategories}
              onPageChange={occurrences.setSongsPage}
              onToggleSongPanel={occurrences.toggleSongPanel}
              onSaveRelation={occurrences.saveRelation}
              onDeleteRelation={occurrences.openDeleteOccurrenceModal}
              onReloadSong={(songId) =>
                Promise.all([
                  occurrences.loadOccurrencesForSong(songId),
                  imagery.refreshItems(),
                ])
              }
              csrfToken={csrfToken}
              getCategoryPath={categories.getCategoryPathFn}
            />
          )}
        </div>
      </main>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-4">
          <div
            className={cn(
              "px-6 py-3 rounded-full shadow-xl flex items-center gap-3 border backdrop-blur-md",
              toast.type === "success"
                ? "bg-emerald-50/90 border-emerald-200 text-emerald-800 dark:bg-emerald-900/80 dark:border-emerald-700 dark:text-emerald-200"
                : "bg-red-50/90 border-red-200 text-red-800 dark:bg-red-900/80 dark:border-red-700 dark:text-red-200",
            )}
          >
            <span className="text-sm font-medium">{toast.text}</span>
          </div>
        </div>
      )}

      {/* Modals */}
      <ImageryAdminModals
        modal={activeModal}
        isSubmitting={
          activeTab === "imagery"
            ? imagery.isSubmitting
            : activeTab === "categories"
              ? categories.isSubmitting
              : activeTab === "meanings"
                ? meanings.meaningSubmitting
                : occurrences.occurrenceSubmitting
        }
        deleteSubmitting={
          activeTab === "imagery"
            ? imagery.isSubmitting
            : activeTab === "categories"
              ? categories.isSubmitting
              : activeTab === "meanings"
                ? meanings.meaningSubmitting
                : occurrences.occurrenceSubmitting
        }
        categories={categories.categories}
        getCategoryPath={categories.getCategoryPathFn}
        onClose={closeActiveModal}
        onAddImagery={imagery.handleAdd}
        onEditImagery={imagery.handleEdit}
        onAddCategory={categories.handleAdd}
        onEditCategory={categories.handleEdit}
        onDeleteMeaning={meanings.handleDelete}
        onDeleteOccurrence={occurrences.handleDeleteRelation}
      />
    </div>
  );
}
