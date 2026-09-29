"use client";

import PlayerBar from "@/components/shared/player/PlayerBar";
import { usePathname } from "@/i18n/navigation";
import { usePlayerStore } from "@/store/player-store";

/** 沉浸式全屏页面不显示播放条（音频照常播放） */
const HIDDEN_PATHS = ["/imagery", "/story"];

/**
 * 全站播放条的挂载点。没有曲目、或在沉浸式页面时整条卸载，
 * 连同它对播放进度的监听一起停掉。
 */
export default function GlobalPlayer() {
  const pathname = usePathname();
  const hasTrack = usePlayerStore((s) => !!s.currentTrack);
  if (!hasTrack || HIDDEN_PATHS.some((p) => pathname.startsWith(p)))
    return null;
  return <PlayerBar />;
}
