"use client";

import { NAV_BUTTON_CLASS } from "@/components/shared/nav-button";
import TopBar from "@/components/shared/topbar/TopBar";
import { PlaceNav } from "@/components/shared/topbar/parts";
import { useRouter } from "@/i18n/navigation";
import { Bell } from "lucide-react";

export type AdminSection =
  "songs" | "imagery" | "credits" | "audio" | "requests" | "users" | "logs";

type SectionConfig = {
  key: AdminSection;
  href: string;
  label: string;
  superOnly?: boolean;
};

const SECTIONS: SectionConfig[] = [
  { key: "songs", href: "/admin", label: "歌曲管理" },
  { key: "imagery", href: "/admin/imagery", label: "意象管理" },
  { key: "credits", href: "/admin/credits", label: "署名管理" },
  { key: "audio", href: "/admin/audio", label: "音频管理", superOnly: true },
  { key: "requests", href: "/admin/requests", label: "反馈管理" },
  { key: "users", href: "/admin/users", label: "用户管理", superOnly: true },
  { key: "logs", href: "/admin/logs", label: "操作日志", superOnly: true },
];

/**
 * 后台顶栏：与歌曲页同一套，左侧「返回 · 回主页」加「后台 / 当前板块 ▾」。
 * 后台还没做 i18n，先不放简繁切换与安装。
 */
export default function AdminNavbar({
  active,
  isSuper = false,
  onOpenNotification,
}: {
  active: AdminSection;
  /** 超级管理员才显示音频、用户、日志入口 */
  isSuper?: boolean;
  /** 不传则不显示使用说明按钮 */
  onOpenNotification?: () => void;
}) {
  const router = useRouter();
  const sections = SECTIONS.filter(
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
            if (target && id !== active) router.push(target.href);
          }}
          menuTitle="后台板块"
        />
      }
      pinned={
        onOpenNotification && (
          <button
            type="button"
            onClick={onOpenNotification}
            className={NAV_BUTTON_CLASS}
            title="使用说明"
            aria-label="使用说明"
          >
            <Bell size={20} />
          </button>
        )
      }
      install={false}
      script={false}
    />
  );
}
