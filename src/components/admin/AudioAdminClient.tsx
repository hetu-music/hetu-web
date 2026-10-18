"use client";

import { useMutation } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { apiRunAudioSync } from "@/lib/api/client-api";
import SongAudioRow from "./audio-admin/SongAudioRow";
import SyncPanel from "./audio-admin/SyncPanel";
import TrackPicker from "./audio-admin/TrackPicker";
import { useAudioAdmin } from "./audio-admin/useAudioAdmin";
import {
  filterRows,
  needsAttention,
  type RowFilter,
} from "./audio-admin/utils";
import AdminShell from "./kit/AdminShell";
import {
  AdminToolbar,
  EmptyState,
  ErrorState,
  FilterOptions,
  LoadingState,
  SearchInput,
} from "./kit/parts";
import { notify } from "./kit/toast";

const FILTERS: { key: RowFilter; label: string }[] = [
  { key: "all", label: "全部" },
  { key: "linked", label: "已关联" },
  { key: "unlinked", label: "未关联" },
  { key: "attention", label: "需处理" },
];

export default function AudioAdminClient() {
  const audio = useAudioAdmin();
  const { overview, rows } = audio;
  const data = overview.data;

  const [filter, setFilter] = useState<RowFilter>("all");
  const [query, setQuery] = useState("");

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

  const sync = useMutation({
    mutationFn: () => apiRunAudioSync(audio.csrfToken),
    onSuccess: (result) => {
      notify({
        type: "success",
        text: `同步完成：写入 ${result.upserted}，删除 ${result.deleted}，has_audio 更新 ${result.hasAudioChanged.length}`,
      });
      void overview.refetch();
    },
    onError: (e) => notify({ type: "error", text: e.message }),
  });

  const picker = audio.pickerSong;

  return (
    <AdminShell
      section="audio"
      title="音频"
      description="管理歌曲与 Navidrome 曲目的关联。Navidrome 升级或文件改名后曲目 ID 会变化，执行一次同步即可按标题与时长重新配对。单首歌的关联也可以在歌曲工作台里改。"
      stats={
        data
          ? [
              { label: "曲库", value: data.library.length },
              { label: "已关联", value: `${counts.linked} / ${counts.all}` },
              {
                label: "需处理",
                value: counts.attention,
                warn: counts.attention > 0,
              },
            ]
          : undefined
      }
    >
      {overview.isPending ? (
        <LoadingState text="正在读取 Navidrome 曲库…" />
      ) : overview.isError ? (
        <ErrorState
          message={`加载失败：${overview.error.message}`}
          onRetry={() => void overview.refetch()}
        />
      ) : (
        <>
          <SyncPanel
            plan={overview.data.plan}
            refreshing={overview.isFetching}
            syncing={sync.isPending}
            onRefresh={() => void overview.refetch()}
            onSync={() => sync.mutate()}
          />

          <AdminToolbar
            search={
              <SearchInput
                value={query}
                onChange={setQuery}
                placeholder="搜索 #ID、标题、专辑、文件路径"
              />
            }
          >
            <FilterOptions
              options={FILTERS.map((f) => ({ ...f, count: counts[f.key] }))}
              active={filter}
              onSelect={setFilter}
            />
          </AdminToolbar>

          {visibleRows.length === 0 ? (
            <EmptyState>没有符合条件的歌曲</EmptyState>
          ) : (
            <div className="border-t border-slate-200/70 dark:border-slate-800">
              {visibleRows.map((row) => (
                <SongAudioRow
                  key={row.song.id}
                  row={row}
                  busy={audio.busySongId === row.song.id}
                  onPick={() => audio.setPickerSong(row.song)}
                  onUnlink={() => audio.unlink(row.song)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {picker && data && (
        <TrackPicker
          song={picker}
          currentNavidId={
            rows.find((r) => r.song.id === picker.id)?.navidId ?? null
          }
          library={data.library}
          owners={audio.owners}
          pending={audio.mapping.isPending}
          onPick={(nav) => audio.link(picker, nav.id)}
          onClose={() => audio.setPickerSong(null)}
        />
      )}
    </AdminShell>
  );
}
