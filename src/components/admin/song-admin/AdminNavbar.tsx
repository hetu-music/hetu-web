import { Bell, Home, Music, Tag, User } from "lucide-react";
import ThemeToggle from "@/components/shared/ThemeToggle";
import { Link } from "@/i18n/navigation";

const ICON_BUTTON_CLASS =
  "p-2 rounded-lg hover:bg-slate-200/50 dark:hover:bg-slate-800 transition-colors text-slate-500 dark:text-slate-400";

export default function AdminNavbar({
  userName,
  isLoggedIn,
  onOpenNotification,
}: {
  userName?: string;
  isLoggedIn: boolean;
  onOpenNotification: () => void;
}) {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-[#FAFAFA]/80 dark:bg-[#0B0F19]/80 backdrop-blur-md border-b border-slate-200/50 dark:border-slate-800/50">
      <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between gap-4">
        <div className="shrink-0 flex items-center gap-1.5 bg-slate-200/50 dark:bg-slate-900/50 backdrop-blur-md border border-slate-200/30 dark:border-slate-800/60 rounded-full p-1 shadow-inner relative">
          {/* 歌曲管理（当前页，激活态）*/}
          <span className="relative flex items-center gap-2 px-3 sm:px-5 py-2 rounded-full text-sm font-medium tracking-wide bg-linear-to-r from-blue-600 to-indigo-600 dark:from-blue-500 dark:to-indigo-500 text-white shadow-md shadow-blue-500/20 dark:shadow-blue-500/10 transition-all select-none">
            <Music size={14} className="sm:animate-pulse shrink-0" />
            <span className="hidden sm:inline">歌曲管理</span>
          </span>

          <Link
            href="/admin/imagery"
            className="group relative flex items-center gap-2 px-3 sm:px-5 py-2 rounded-full text-sm font-medium tracking-wide text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-white/60 dark:hover:bg-slate-800/40 hover:shadow-xs transition-all duration-300"
          >
            <Tag
              size={14}
              className="text-slate-400 dark:text-slate-500 group-hover:text-violet-500 dark:group-hover:text-violet-400 transition-colors duration-300 group-hover:scale-110 shrink-0"
            />
            <span className="hidden sm:inline">意象管理</span>
          </Link>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={onOpenNotification}
            className={ICON_BUTTON_CLASS}
            title="使用说明"
          >
            <Bell size={18} />
          </button>
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
