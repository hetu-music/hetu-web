"use client";

import TopBar from "@/components/shared/topbar/TopBar";
import { PlaceNav } from "@/components/shared/topbar/parts";
import { useRouter } from "@/i18n/navigation";
import type React from "react";

export type AdminSection =
  | "overview"
  | "songs"
  | "imagery"
  | "credits"
  | "requests"
  | "audio"
  | "users"
  | "logs";

type SectionConfig = {
  key: AdminSection;
  href: string;
  label: string;
  superOnly?: boolean;
};

// 内容（歌曲、意象、署名）→ 运营（反馈、音频）→ 系统（用户、日志）
export const ADMIN_SECTIONS: SectionConfig[] = [
  { key: "overview", href: "/admin", label: "待办" },
  { key: "songs", href: "/admin/songs", label: "歌曲" },
  { key: "imagery", href: "/admin/imagery", label: "意象" },
  { key: "credits", href: "/admin/credits", label: "署名" },
  { key: "requests", href: "/admin/requests", label: "反馈" },
  { key: "audio", href: "/admin/audio", label: "音频", superOnly: true },
  { key: "users", href: "/admin/users", label: "用户", superOnly: true },
  { key: "logs", href: "/admin/logs", label: "日志", superOnly: true },
];

/**
 * 后台顶栏：与歌曲页同一套，左侧「返回 · 回主页」加「后台 · 当前板块 ▾」。
 * 后台还没做 i18n，先不放简繁切换与安装。
 */
export default function AdminNavbar({
  active,
  isSuper = false,
  pinned,
}: {
  active: AdminSection;
  /** 超级管理员才显示音频、用户、日志入口 */
  isSuper?: boolean;
  /** 窄屏也常驻的按钮，如使用说明 */
  pinned?: React.ReactNode;
}) {
  const router = useRouter();
  const sections = ADMIN_SECTIONS.filter(
    (s) => !s.superOnly || isSuper || s.key === active,
  );

  return (
    <TopBar
      exit={{ kind: "back" }}
      nav={
        <PlaceNav
          title="后台"
          items={sections.map((s) => ({ id: s.key, label: s.label }))}
          active={active}
          onSelect={(id) => {
            const target = sections.find((s) => s.key === id);
            if (target) router.push(target.href);
          }}
          menuTitle="后台板块"
        />
      }
      pinned={pinned}
      install={false}
      script={false}
    />
  );
}
