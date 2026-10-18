"use client";

import { Link } from "@/i18n/navigation";
import SongAudioRow from "../audio-admin/SongAudioRow";
import TrackPicker from "../audio-admin/TrackPicker";
import { useAudioAdmin } from "../audio-admin/useAudioAdmin";
import { EmptyState, ErrorState, LoadingState } from "../kit/parts";
import { TEXT_BUTTON_CLASS } from "../kit/styles";

/** 一首歌与 Navidrome 曲目的关联；同步与批量处理仍在音频板块 */
export default function SongAudioTab({ songId }: { songId: number }) {
  const audio = useAudioAdmin();
  const { overview } = audio;

  if (overview.isPending) {
    return <LoadingState text="正在读取 Navidrome 曲库…" />;
  }
  if (overview.isError) {
    return (
      <ErrorState
        message={`加载失败：${overview.error.message}`}
        onRetry={() => void overview.refetch()}
      />
    );
  }

  const row = audio.rows.find((r) => r.song.id === songId);
  const picker = audio.pickerSong;
  if (!row) {
    return <EmptyState>发布以后才能关联音频</EmptyState>;
  }

  return (
    <div className="max-w-3xl">
      <SongAudioRow
        row={row}
        showSong={false}
        busy={audio.busySongId === songId}
        onPick={() => audio.setPickerSong(row.song)}
        onUnlink={() => audio.unlink(row.song)}
      />
      <p className="mt-4 text-xs text-slate-400">
        Navidrome 升级或文件改名后曲目 ID 会变化，到
        <Link href="/admin/audio" className={`${TEXT_BUTTON_CLASS} mx-1`}>
          音频板块
        </Link>
        执行一次同步即可重新配对。
      </p>

      {picker && (
        <TrackPicker
          song={picker}
          currentNavidId={row.navidId}
          library={overview.data.library}
          owners={audio.owners}
          pending={audio.mapping.isPending}
          onPick={(nav) => audio.link(picker, nav.id)}
          onClose={() => audio.setPickerSong(null)}
        />
      )}
    </div>
  );
}
