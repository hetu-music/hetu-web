"use client";

import { usePathname } from "@/i18n/navigation";
import { usePlayerStore } from "@/store/player-store";
import dynamic from "next/dynamic";

// 播放条连同队列面板单独分包：没在播放的页面用不到，不放进首屏的包里。
// 第一次点播放时才下载，条子晚出现一两百毫秒，声音不受影响（播放由 player-store 负责）
const PlayerBar = dynamic(
  () => import("@/components/shared/player/PlayerBar"),
  {
    ssr: false,
  },
);

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
