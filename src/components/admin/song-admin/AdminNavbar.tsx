import {
  Bell,
  ClipboardList,
  Disc3,
  Home,
  Music,
  ScrollText,
  Tag,
  User,
  Users,
} from "lucide-react";
import type { ComponentType } from "react";
import ThemeToggle from "@/components/shared/ThemeToggle";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils/utils";

const ICON_BUTTON_CLASS =
  "p-2 rounded-lg hover:bg-slate-200/50 dark:hover:bg-slate-800 transition-colors text-slate-500 dark:text-slate-400";

export type AdminSection =
  "songs" | "imagery" | "audio" | "requests" | "users" | "logs";

type SectionConfig = {
  key: AdminSection;
  href: string;
  label: string;
  icon: ComponentType<{ size?: number; className?: string }>;
  /** 激活态的渐变底色 */
  activeClassName: string;
  /** 未激活时悬停的图标颜色 */
  hoverIconClassName: string;
  superOnly?: boolean;
};

const SECTIONS: SectionConfig[] = [
  {
    key: "songs",
    href: "/admin",
    label: "歌曲管理",
    icon: Music,
    activeClassName:
      "from-blue-600 to-indigo-600 dark:from-blue-500 dark:to-indigo-500 shadow-blue-500/20 dark:shadow-blue-500/10",
    hoverIconClassName:
      "group-hover:text-blue-500 dark:group-hover:text-blue-400",
  },
  {
    key: "imagery",
    href: "/admin/imagery",
    label: "意象管理",
    icon: Tag,
    activeClassName:
      "from-violet-600 to-fuchsia-600 dark:from-violet-500 dark:to-fuchsia-500 shadow-violet-500/20 dark:shadow-violet-500/10",
    hoverIconClassName:
      "group-hover:text-violet-500 dark:group-hover:text-violet-400",
  },
  {
    key: "audio",
    href: "/admin/audio",
    label: "音频管理",
    icon: Disc3,
    activeClassName:
      "from-emerald-600 to-teal-600 dark:from-emerald-500 dark:to-teal-500 shadow-emerald-500/20 dark:shadow-emerald-500/10",
    hoverIconClassName:
      "group-hover:text-emerald-500 dark:group-hover:text-emerald-400",
    superOnly: true,
  },
  {
    key: "requests",
    href: "/admin/requests",
    label: "反馈管理",
    icon: ClipboardList,
    activeClassName:
      "from-amber-500 to-orange-500 dark:from-amber-500 dark:to-orange-500 shadow-amber-500/20 dark:shadow-amber-500/10",
    hoverIconClassName:
      "group-hover:text-amber-500 dark:group-hover:text-amber-400",
  },
  {
    key: "users",
    href: "/admin/users",
    label: "用户管理",
    icon: Users,
    activeClassName:
      "from-sky-600 to-cyan-600 dark:from-sky-500 dark:to-cyan-500 shadow-sky-500/20 dark:shadow-sky-500/10",
    hoverIconClassName:
      "group-hover:text-sky-500 dark:group-hover:text-sky-400",
    superOnly: true,
  },
  {
    key: "logs",
    href: "/admin/logs",
    label: "操作日志",
    icon: ScrollText,
    activeClassName:
      "from-slate-600 to-slate-800 dark:from-slate-500 dark:to-slate-700 shadow-slate-500/20 dark:shadow-slate-500/10",
    hoverIconClassName:
      "group-hover:text-slate-700 dark:group-hover:text-slate-200",
    superOnly: true,
  },
];

export default function AdminNavbar({
  active,
  userName,
  isLoggedIn,
  isSuper = false,
  onOpenNotification,
}: {
  active: AdminSection;
  userName?: string;
  isLoggedIn: boolean;
  /** 超级管理员才显示音频管理入口 */
  isSuper?: boolean;
  /** 不传则不显示使用说明按钮 */
  onOpenNotification?: () => void;
}) {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-[#FAFAFA]/80 dark:bg-[#0B0F19]/80 backdrop-blur-md border-b border-slate-200/50 dark:border-slate-800/50">
      <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between gap-4">
        <div className="min-w-0 overflow-x-auto no-scrollbar flex items-center gap-1.5 bg-slate-200/50 dark:bg-slate-900/50 backdrop-blur-md border border-slate-200/30 dark:border-slate-800/60 rounded-full p-1 shadow-inner relative">
          {SECTIONS.filter(
            (s) => !s.superOnly || isSuper || s.key === active,
          ).map((s) => {
            const Icon = s.icon;
            return s.key === active ? (
              <span
                key={s.key}
                className={cn(
                  "relative shrink-0 flex items-center gap-2 px-3 sm:px-5 py-2 rounded-full text-sm font-medium tracking-wide bg-linear-to-r text-white shadow-md transition-all select-none",
                  s.activeClassName,
                )}
              >
                <Icon size={14} className="sm:animate-pulse shrink-0" />
                <span className="hidden sm:inline">{s.label}</span>
              </span>
            ) : (
              <Link
                key={s.key}
                href={s.href}
                title={s.label}
                className="group relative shrink-0 flex items-center gap-2 px-3 lg:px-5 py-2 rounded-full text-sm font-medium tracking-wide text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-white/60 dark:hover:bg-slate-800/40 hover:shadow-xs transition-all duration-300"
              >
                <Icon
                  size={14}
                  className={cn(
                    "text-slate-400 dark:text-slate-500 transition-colors duration-300 group-hover:scale-110 shrink-0",
                    s.hoverIconClassName,
                  )}
                />
                {/* 六个入口排不下，未选中的只在宽屏显示文字 */}
                <span className="hidden lg:inline">{s.label}</span>
              </Link>
            );
          })}
        </div>

        <div className="shrink-0 flex items-center gap-1">
          {onOpenNotification && (
            <button
              onClick={onOpenNotification}
              className={ICON_BUTTON_CLASS}
              title="使用说明"
            >
              <Bell size={18} />
            </button>
          )}
          <Link href="/" className={ICON_BUTTON_CLASS} title="返回主页">
            <Home size={18} />
          </Link>
          <Link
            href="/profile"
            className={ICON_BUTTON_CLASS}
            title={userName ?? "个人中心"}
          >
            <User
              size={18}
              className={isLoggedIn ? "text-blue-500 dark:text-blue-400" : ""}
            />
          </Link>
          <ThemeToggle className={ICON_BUTTON_CLASS} />
        </div>
      </div>
    </nav>
  );
}
