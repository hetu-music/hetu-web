"use client";

import AdminShell from "@/components/admin/kit/AdminShell";
import { ADMIN_SECTIONS } from "@/components/admin/kit/AdminNavbar";
import { usePathname } from "@/i18n/navigation";

/**
 * 后台各页读数据时先出外壳：顶栏、题名照常，正文一道细线。
 * 没有它时点了板块要等服务端把整页数据读完才有反应，看着像卡住。
 * 细线延迟 300ms 才淡入，数据回来得快时不闪。
 */
export default function AdminLoading() {
  const pathname = usePathname();
  // 最长前缀匹配：/admin/songs/12 归「歌曲」，/admin 归「待办」
  const section =
    [...ADMIN_SECTIONS]
      .sort((a, b) => b.href.length - a.href.length)
      .find((s) => pathname === s.href || pathname.startsWith(`${s.href}/`)) ??
    ADMIN_SECTIONS[0];
  // 歌曲工作台的题名是歌名，还不知道，先空着
  const isWorkspace = /^\/admin\/songs\/[^/]+/.test(pathname);

  return (
    <AdminShell
      section={section.key}
      title={
        isWorkspace ? (
          <span className="block h-9 w-56 rounded bg-slate-200/70 dark:bg-slate-800/70 md:h-10" />
        ) : (
          section.label
        )
      }
    >
      <div
        role="status"
        aria-label="加载中"
        className="flex justify-center py-24 animate-in fade-in duration-500 delay-300 fill-mode-both"
      >
        <span
          aria-hidden
          className="relative block h-px w-32 overflow-hidden bg-slate-200 dark:bg-slate-800"
        >
          <span className="folio-sweep-anim motion-reduce:animate-none absolute inset-y-0 left-0 w-1/3 bg-(--tone) opacity-70" />
        </span>
      </div>
    </AdminShell>
  );
}
