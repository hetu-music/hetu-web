"use client";

import type React from "react";
import { ToastViewport } from "@/components/ui/toast";
import { useUserContext } from "@/context/UserContext";
import { cn } from "@/lib/utils/utils";
import AdminNavbar, { type AdminSection } from "./AdminNavbar";
import { type Stat, StatLine } from "./parts";

/**
 * 所有后台页共用的外壳：顶栏、题头（题名、说明、统计、主操作）、正文与提示条。
 * 强调色用全站默认的墨蓝 --tone（globals.css），不再每个板块各配一种颜色。
 */
export default function AdminShell({
  section,
  title,
  eyebrow,
  description,
  stats,
  actions,
  pinned,
  className,
  children,
}: {
  section: AdminSection;
  title: React.ReactNode;
  /** 题名上方的一行小字，如歌曲工作台里的「歌曲 · #123」 */
  eyebrow?: React.ReactNode;
  description?: React.ReactNode;
  stats?: readonly Stat[];
  /** 题头右侧的主操作 */
  actions?: React.ReactNode;
  pinned?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  const { user } = useUserContext();

  return (
    <div className="min-h-screen bg-[#FAFAFA] font-sans text-slate-800 dark:bg-[#0B0F19] dark:text-slate-200">
      <AdminNavbar active={section} isSuper={user?.isSuper} pinned={pinned} />

      <main
        className={cn(
          "mx-auto max-w-7xl px-4 pt-28 pb-24 sm:px-6 md:pt-32",
          className,
        )}
      >
        <header className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="min-w-0">
            {eyebrow && (
              <div className="mb-3 text-xs tracking-[0.35em] text-(--tone)">
                {eyebrow}
              </div>
            )}
            <h1 className="font-serif text-3xl font-semibold tracking-tight text-balance text-slate-900 wrap-break-word md:text-4xl dark:text-slate-50">
              {title}
            </h1>
            {description && (
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-500 dark:text-slate-400">
                {description}
              </p>
            )}
            {stats && stats.length > 0 && (
              <div className="mt-4">
                <StatLine stats={stats} />
              </div>
            )}
          </div>
          {actions && (
            <div className="flex shrink-0 flex-wrap items-center gap-3">
              {actions}
            </div>
          )}
        </header>

        {children}
      </main>

      <ToastViewport />
    </div>
  );
}
