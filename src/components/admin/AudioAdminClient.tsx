"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { Loader2, Search, XCircle } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { useUserContext } from "@/context/UserContext";
import { useCsrfToken } from "@/hooks/utils/useCsrfToken";
import {
  apiGetAudioOverview,
  apiRunAudioSync,
  apiUpdateAudioMapping,
} from "@/lib/api/client-api";
import type { DbSong } from "@/lib/navidrome/sync";
import { cn } from "@/lib/utils/utils";
import SongAudioRow from "./audio-admin/SongAudioRow";
import SyncPanel from "./audio-admin/SyncPanel";
import TrackPicker from "./audio-admin/TrackPicker";
import {
  buildRows,
  filterRows,
  needsAttention,
  type RowFilter,
} from "./audio-admin/utils";
import AdminNavbar from "./song-admin/AdminNavbar";
import { OperationToast } from "./song-admin/SongAdminDialogs";
import type { OperationMessage } from "./song-admin/types";

const TOAST_DURATION_MS = 4000;

const FILTERS: { key: RowFilter; label: string }[] = [
  { key: "all", label: "全部" },
  { key: "linked", label: "已关联" },
  { key: "unlinked", label: "未关联" },
  { key: "attention", label: "需处理" },
];

export default function AudioAdminClient() {
  const { user } = useUserContext();
  const csrfToken = useCsrfToken();

  const [filter, setFilter] = useState<RowFilter>("all");
  const [query, setQuery] = useState("");
  const [pickerSong, setPickerSong] = useState<DbSong | null>(null);
  const [toast, setToast] = useState<OperationMessage | null>(null);

  const notify = useCallback((message: OperationMessage) => {
    setToast(message);
    setTimeout(() => setToast(null), TOAST_DURATION_MS);
  }, []);

  const overview = useQuery({
    queryKey: ["admin", "audio"],
    queryFn: apiGetAudioOverview,
    refetchOnWindowFocus: false,
  });
  const data = overview.data;

  const rows = useMemo(
    () => (data ? buildRows(data.songs, data.mappings, data.library) : []),
    [data],
  );
  const visibleRows = useMemo(
    () => filterRows(rows, filter, query),
    [rows, filter, query],
  );
  const counts = useMemo(
    () => ({
      all: rows.length,
      linked: rows.filter((r) => r.nav).length,
      unlinked: rows.filter((r) => !r.nav).length,
      attention: rows.filter(needsAttention).length,
    }),
    [rows],
  );
  const owners = useMemo(() => {
    const map = new Map<string, DbSong>();
    for (const r of rows) if (r.navidId) map.set(r.navidId, r.song);
    return map;
  }, [rows]);

  const sync = useMutation({
    mutationFn: () => apiRunAudioSync(csrfToken),
    onSuccess: (result) => {
      notify({
        type: "success",
        text: `同步完成：写入 ${result.upserted}，删除 ${result.deleted}，has_audio 更新 ${result.hasAudioChanged.length}`,
      });
      void overview.refetch();
    },
    onError: (e) => notify({ type: "error", text: e.message }),
  });

  const mapping = useMutation({
    mutationFn: (vars: { song: DbSong; navidId: string | null }) =>
      apiUpdateAudioMapping(vars.song.id, vars.navidId, csrfToken),
    onSuccess: (_result, vars) => {
      notify({
        type: "success",
        text: vars.navidId
          ? `已关联 #${vars.song.id} ${vars.song.title}`
          : `已解除 #${vars.song.id} ${vars.song.title}`,
      });
      setPickerSong(null);
      void overview.refetch();
    },
    onError: (e) => notify({ type: "error", text: e.message }),
  });
  const busySongId = mapping.isPending ? mapping.variables?.song.id : null;

  return (
    <div className="min-h-screen bg-[#FAFAFA] font-sans transition-colors duration-500 dark:bg-[#0B0F19]">
      <AdminNavbar active="audio" isSuper={user?.isSuper} />

      <main className="mx-auto max-w-7xl px-6 pb-20 pt-24">
        <div className="mb-10">
          <h1 className="mb-4 text-4xl font-bold text-slate-900 dark:text-slate-50">
            音频管理
          </h1>
          <p className="mb-4 max-w-3xl text-sm text-slate-500 dark:text-slate-400">
            管理歌曲与 Navidrome 曲目的关联。Navidrome 升级或文件改名后曲目 ID
            会变化，执行一次同步即可按标题与时长重新配对。
          </p>
          {data && (
            <div className="flex flex-wrap gap-3 text-sm font-medium">
              <span className="rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300">
                曲库 {data.library.length} 首
              </span>
              <span className="rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-blue-700 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                已关联 {counts.linked} / {counts.all}
              </span>
              {counts.attention > 0 && (
                <span className="rounded-full border border-amber-100 bg-amber-50 px-3 py-1 text-amber-700 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                  需处理 {counts.attention}
                </span>
              )}
            </div>
          )}
        </div>

        {overview.isPending ? (
          <div className="flex flex-col items-center justify-center py-24 text-slate-400">
            <Loader2 size={28} className="mb-4 animate-spin" />
            <p className="font-light">正在读取 Navidrome 曲库…</p>
          </div>
        ) : overview.isError ? (
          <div className="rounded-3xl border border-red-200 bg-red-50 px-6 py-5 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
            <p className="font-medium">加载失败：{overview.error.message}</p>
            <button
              type="button"
              onClick={() => void overview.refetch()}
              className="mt-3 rounded-full border border-red-300 px-4 py-1.5 hover:bg-red-100 dark:border-red-800 dark:hover:bg-red-900/40"
            >
              重试
            </button>
          </div>
        ) : (
          <>
            <SyncPanel
              plan={overview.data.plan}
              refreshing={overview.isFetching}
              syncing={sync.isPending}
              onRefresh={() => void overview.refetch()}
              onSync={() => sync.mutate()}
            />

            <div className="sticky top-(--nav-h) z-40 -mx-6 mb-6 bg-[#FAFAFA]/95 px-6 py-4 backdrop-blur-sm dark:bg-[#0B0F19]/95">
              <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
                <div className="no-scrollbar flex w-full items-center gap-2 overflow-x-auto md:w-auto">
                  {FILTERS.map((f) => (
                    <button
                      key={f.key}
                      type="button"
                      onClick={() => setFilter(f.key)}
                      className={cn(
                        "whitespace-nowrap rounded-full border px-4 py-1.5 text-sm transition-all",
                        filter === f.key
                          ? "border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-slate-900"
                          : "border-slate-200 bg-transparent text-slate-500 hover:border-slate-300 dark:border-slate-800",
                      )}
                    >
                      {f.label}
                      <span className="ml-1.5 tabular-nums opacity-60">
                        {counts[f.key]}
                      </span>
                    </button>
                  ))}
                </div>

                <div className="relative w-full md:w-72">
                  <Search
                    size={16}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="搜索 #ID、标题、专辑、文件路径"
                    className="w-full rounded-full border border-slate-200 bg-white py-2 pl-9 pr-8 text-sm outline-none transition-colors focus:border-emerald-500 dark:border-slate-800 dark:bg-slate-900"
                  />
                  {query && (
                    <button
                      type="button"
                      onClick={() => setQuery("")}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-300 hover:text-slate-500"
                    >
                      <XCircle size={14} />
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              {visibleRows.length === 0 ? (
                <p className="py-20 text-center font-light text-slate-400">
                  没有符合条件的歌曲
                </p>
              ) : (
                visibleRows.map((row) => (
                  <SongAudioRow
                    key={row.song.id}
                    row={row}
                    busy={busySongId === row.song.id}
                    onPick={() => setPickerSong(row.song)}
                    onUnlink={() =>
                      mapping.mutate({ song: row.song, navidId: null })
                    }
                  />
                ))
              )}
            </div>
          </>
        )}
      </main>

      {pickerSong && data && (
        <TrackPicker
          song={pickerSong}
          currentNavidId={
            rows.find((r) => r.song.id === pickerSong.id)?.navidId ?? null
          }
          library={data.library}
          owners={owners}
          pending={mapping.isPending}
          onPick={(nav) =>
            mapping.mutate({ song: pickerSong, navidId: nav.id })
          }
          onClose={() => setPickerSong(null)}
        />
      )}

      {toast && <OperationToast message={toast} />}
    </div>
  );
}
