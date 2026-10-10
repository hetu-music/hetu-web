"use client";

import { Link } from "@/i18n/navigation";
import type React from "react";

interface SongTitleLinkProps {
  songId: number;
  onNavigate: () => void;
  children: React.ReactNode;
}

/**
 * 曲库卡片上的歌名链接：给爬虫和「新标签页打开」一个真实的 href。
 * 普通点击时取消 Link 自己的跳转，交给卡片的导航逻辑（记滚动位置、导航深度）；
 * 带修饰键点击时 onNavigate 不触发，由浏览器按链接处理。
 * 两种情况都拦住冒泡，免得卡片的 onClick 再跳一次。
 */
export default function SongTitleLink({
  songId,
  onNavigate,
  children,
}: SongTitleLinkProps) {
  return (
    <Link
      href={`/song/${songId}`}
      prefetch={false}
      onClick={(event) => event.stopPropagation()}
      onNavigate={(event) => {
        event.preventDefault();
        onNavigate();
      }}
    >
      {children}
    </Link>
  );
}
