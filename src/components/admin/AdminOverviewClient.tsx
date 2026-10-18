"use client";

import { useUserContext } from "@/context/UserContext";
import { Link } from "@/i18n/navigation";
import { MIN_OCCURRENCES } from "@/lib/quiz/pool";
import { cn } from "@/lib/utils/utils";
import { needsAttention } from "./audio-admin/utils";
import { useAudioAdmin } from "./audio-admin/useAudioAdmin";
import AdminShell from "./kit/AdminShell";
import { ADMIN_SECTIONS } from "./kit/AdminNavbar";
import { SOLID_BUTTON_CLASS } from "./kit/styles";
import {
  MISSING_GROUPS,
  type MissingGroup,
  PLATFORM_LINKS,
  type PlatformLinkKey,
} from "./song-admin/types";

export interface OverviewCounts {
  songs: number;
  pendingRequests: number;
  unpublished: number;
  incomplete: number;
  /** 待完善里各组缺资料的歌数；一首歌可能同时缺几组 */
  missingByGroup: Record<MissingGroup, number>;
  /** 至少缺一个音乐平台链接的歌数 */
  lacksLinks: number;
  missingByPlatform: Record<PlatformLinkKey, number>;
  lacksImagery: number;
  lacksScore: number;
}

/**
 * 后台首页：现在有什么要处理。每一项点进去就是筛好的列表。
 * 数字都在服务端算好；音频要整个读 Navidrome 曲库，只给超级管理员、在客户端慢慢取。
 */
export default function AdminOverviewClient({
  counts,
}: {
  counts: OverviewCounts;
}) {
  const { user } = useUserContext();
  const isSuper = Boolean(user?.isSuper);

  return (
    <AdminShell
      section="overview"
      title="待办"
      description={`曲库共 ${counts.songs} 首。下面是还要处理的事，点进去就是筛好的列表。`}
      actions={
        <Link href="/admin/songs/new" className={SOLID_BUTTON_CLASS}>
          新增歌曲
        </Link>
      }
    >
      <ol className="grid border-t border-slate-200/70 md:grid-cols-2 dark:border-slate-800">
        <TodoItem
          href="/admin/requests?status=pending"
          count={counts.pendingRequests}
          label="待处理的反馈"
          hint="用户提交的纠错与申请，回复后对方能在个人中心看到"
        />
        <TodoItem
          href="/admin/songs?f=unpublished"
          count={counts.unpublished}
          label="待发布的歌曲"
          hint="暂存表里有改动，或者还没发布过"
        />
        <TodoItem
          href="/admin/songs?f=incomplete"
          count={counts.incomplete}
          label="资料待完善"
          hint="缺歌词、署名、日期等关键字段"
          breakdown={MISSING_GROUPS.map((g) => ({
            label: g.label,
            count: counts.missingByGroup[g.key],
            href: `/admin/songs?f=incomplete&miss=${g.key}`,
          }))}
        />
        <TodoItem
          href="/admin/songs?f=imagery"
          count={counts.lacksImagery}
          label="意象标注不足"
          hint={`少于 ${MIN_OCCURRENCES} 个标注的歌不会进入寻曲测验`}
        />
        {/* 乐谱、链接不算待完善：前者要另找来上传，后者有的歌确实不在某个平台 */}
        <TodoItem
          href="/admin/songs?f=score"
          count={counts.lacksScore}
          label="缺乐谱"
          hint="找到简谱后，在歌曲的「封面与乐谱」里上传"
        />
        <TodoItem
          href="/admin/songs?f=links"
          count={counts.lacksLinks}
          label="平台链接不全"
          hint="详情页的收听入口，三个平台没有都填上"
          breakdown={PLATFORM_LINKS.map((l) => ({
            label: l.label,
            count: counts.missingByPlatform[l.key],
            href: `/admin/songs?f=links&miss=${l.key}`,
          }))}
        />
        {isSuper && <AudioTodo />}
      </ol>

      <nav className="mt-16">
        <h2 className="text-xs tracking-[0.2em] text-slate-400 dark:text-slate-500">
          全部板块
        </h2>
        <ul className="mt-4 flex flex-wrap gap-x-6 gap-y-2">
          {ADMIN_SECTIONS.filter(
            (s) => s.key !== "overview" && (!s.superOnly || isSuper),
          ).map((s) => (
            <li key={s.key}>
              <Link
                href={s.href}
                className="font-serif text-lg tracking-wider text-slate-600 transition-colors hover:text-(--tone) dark:text-slate-300"
              >
                {s.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </AdminShell>
  );
}

function TodoItem({
  href,
  count,
  label,
  hint,
  breakdown,
}: {
  href: string;
  /** null 表示还在取 */
  count: number | null;
  label: string;
  hint: string;
  /** 分项，各自链到筛好的列表；为 0 的不列 */
  breakdown?: { label: string; count: number; href: string }[];
}) {
  const parts = breakdown?.filter((b) => b.count > 0) ?? [];
  const done = count === 0;
  return (
    <li className="border-b border-slate-200/70 md:odd:not-last:border-r md:odd:pr-8 md:even:pl-8 dark:border-slate-800">
      <Link href={href} className="group flex items-baseline gap-5 py-6">
        <span
          className={cn(
            "w-16 shrink-0 text-right font-serif text-4xl tabular-nums transition-colors",
            count === null
              ? "text-slate-300 dark:text-slate-700"
              : done
                ? "text-slate-300 dark:text-slate-600"
                : "text-slate-900 group-hover:text-(--tone) dark:text-slate-50",
          )}
        >
          {count ?? "·"}
        </span>
        <span className="min-w-0">
          <span
            className={cn(
              "block",
              done
                ? "text-slate-400 dark:text-slate-500"
                : "text-slate-800 dark:text-slate-200",
            )}
          >
            {label}
          </span>
          <span className="mt-1 block text-xs leading-relaxed text-slate-400 dark:text-slate-500">
            {hint}
          </span>
        </span>
      </Link>
      {/* 与上面的标签对齐：数字栏 4rem 加间距 1.25rem */}
      {parts.length > 0 && (
        <p className="-mt-3 mb-6 ml-[5.25rem] flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm">
          {parts.map((b, i) => (
            <span key={b.href} className="flex items-baseline gap-x-3">
              {i > 0 && (
                <span
                  aria-hidden
                  className="text-slate-300 dark:text-slate-600"
                >
                  ·
                </span>
              )}
              <Link
                href={b.href}
                className="text-slate-500 transition-colors hover:text-(--tone) dark:text-slate-400"
              >
                {b.label}
                <span className="ml-1.5 tabular-nums text-slate-800 dark:text-slate-200">
                  {b.count}
                </span>
              </Link>
            </span>
          ))}
        </p>
      )}
    </li>
  );
}

function AudioTodo() {
  const { overview, rows } = useAudioAdmin();
  return (
    <TodoItem
      href="/admin/audio"
      count={overview.isSuccess ? rows.filter(needsAttention).length : null}
      label="音频需处理"
      hint={
        overview.isError
          ? `读取 Navidrome 失败：${overview.error.message}`
          : "关联失效、时长对不上，或 has_audio 与关联不一致"
      }
    />
  );
}
