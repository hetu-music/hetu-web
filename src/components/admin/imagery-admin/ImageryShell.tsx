"use client";

import type React from "react";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils/utils";
import AdminShell from "../kit/AdminShell";
import { AdminToolbar, type Stat } from "../kit/parts";

export type ImagerySub = "items" | "categories" | "meanings";

const SUBS: { key: ImagerySub; href: string; label: string }[] = [
  { key: "items", href: "/admin/imagery", label: "词条" },
  { key: "categories", href: "/admin/imagery/categories", label: "分类" },
  { key: "meanings", href: "/admin/imagery/meanings", label: "含义" },
];

/**
 * 意象库三个子页的外壳：词条、分类、含义各有自己的地址。
 * 某首歌标了哪些意象，在歌曲工作台的「意象」一栏里编辑。
 */
export default function ImageryShell({
  sub,
  stats,
  actions,
  search,
  children,
}: {
  sub: ImagerySub;
  stats?: readonly Stat[];
  actions?: React.ReactNode;
  /** 工具栏右侧，通常是搜索框 */
  search?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <AdminShell
      section="imagery"
      title="意象"
      description={
        <>
          维护意象词典、分类树与含义库。某首歌标了哪些意象，到
          <Link
            href="/admin/songs"
            className="mx-1 text-(--tone) hover:opacity-75"
          >
            歌曲
          </Link>
          里打开那首歌编辑。
        </>
      }
      stats={stats}
      actions={actions}
    >
      <AdminToolbar search={search}>
        <nav className="flex items-baseline gap-x-3">
          {SUBS.map((s, i) => (
            <span key={s.key} className="flex items-baseline gap-x-3">
              {i > 0 && (
                <span
                  aria-hidden
                  className="text-slate-300 dark:text-slate-600"
                >
                  ·
                </span>
              )}
              <Link
                href={s.href}
                aria-current={s.key === sub ? "page" : undefined}
                className={cn(
                  "py-2 text-sm tracking-widest transition-colors",
                  s.key === sub
                    ? "text-(--tone)"
                    : "text-slate-400 hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-200",
                )}
              >
                {s.label}
              </Link>
            </span>
          ))}
        </nav>
      </AdminToolbar>
      {children}
    </AdminShell>
  );
}
