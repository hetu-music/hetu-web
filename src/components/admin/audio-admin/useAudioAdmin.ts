"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useCsrfToken } from "@/hooks/utils/useCsrfToken";
import {
  apiGetAudioOverview,
  apiUpdateAudioMapping,
} from "@/lib/api/client-api";
import type { DbSong } from "@/lib/navidrome/sync";
import { notify } from "../kit/toast";
import { buildRows } from "./utils";

/**
 * 音频关联的数据与操作：音频板块的全表和歌曲工作台的单曲共用。
 * 曲库要整个从 Navidrome 读回来才能配对，两处共用同一份缓存。
 */
export function useAudioAdmin() {
  const csrfToken = useCsrfToken();
  const [pickerSong, setPickerSong] = useState<DbSong | null>(null);

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
  /** navid → 已关联它的歌曲 */
  const owners = useMemo(() => {
    const map = new Map<string, DbSong>();
    for (const r of rows) if (r.navidId) map.set(r.navidId, r.song);
    return map;
  }, [rows]);

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

  return {
    csrfToken,
    overview,
    rows,
    owners,
    mapping,
    busySongId: mapping.isPending ? mapping.variables?.song.id : null,
    pickerSong,
    setPickerSong,
    link: (song: DbSong, navidId: string) => mapping.mutate({ song, navidId }),
    unlink: (song: DbSong) => mapping.mutate({ song, navidId: null }),
  };
}
