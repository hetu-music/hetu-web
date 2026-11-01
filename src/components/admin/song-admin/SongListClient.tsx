"use client";

import { useCallback, useEffect, useMemo } from "react";
import Pagination from "@/components/shared/Pagination";
import { useSongs } from "@/hooks/admin/useSongs";
import { useDebouncedDraft } from "@/hooks/ui/useDebouncedDraft";
import { useUrlState } from "@/hooks/utils/useUrlState";
import { Link } from "@/i18n/navigation";
import { isPoolEligible, MIN_OCCURRENCES } from "@/lib/quiz/pool";
import type { SongDetail } from "@/lib/types";
import { cn } from "@/lib/utils/utils";
import {
  readInt,
  readString,
  writeInt,
  writeString,
} from "@/lib/utils/url-params";
import type { PublishStatus } from "@/lib/utils/utils-song-diff";
import AdminShell from "../kit/AdminShell";
import {
  AdminOptions,
  AdminToolbar,
  EmptyState,
  ErrorState,
  type FilterOption,
  FilterOptions,
  SearchInput,
} from "../kit/parts";
import { META_CLASS, SOLID_BUTTON_CLASS, WARN_TEXT_CLASS } from "../kit/styles";
import { AdminCoverArt } from "./shared";
import { MISSING_GROUPS, PLATFORM_LINKS } from "./types";
import UsageNotesButton from "./UsageNotes";
import {
  getMissingFields,
  getMissingGroups,
  getMissingLinks,
  lacksScore,
  summarizeMissing,
} from "./utils";

const ITEMS_PER_PAGE = 30;

/** 搜索框停下多久才写进地址栏（同曲库页） */
const SEARCH_DEBOUNCE_MS = 300;

type Filter =
  "all" | "incomplete" | "unpublished" | "imagery" | "score" | "links";

const PLATFORM_LABEL = new Map(PLATFORM_LINKS.map((p) => [p.key, p.label]));

/** 表头与每一行共用的列宽 */
const GRID_COLS = "lg:grid-cols-[3rem_2.5rem_minmax(0,1fr)_9rem_5rem_14rem]";

/** 进不了寻曲测验的歌：类型与日期允许入池，但意象标注不够 */
function lacksImagery(song: SongDetail, count: number) {
  return (
    isPoolEligible({
      title: song.title,
      type: song.type ?? null,
      date: song.date ?? null,
    }) && count < MIN_OCCURRENCES
  );
}

const join = (value: string[] | string | null | undefined) =>
  Array.isArray(value) ? value.join("、") : value || "";

export default function SongListClient({
  initialSongs: songs,
  initialError: error,
  publishStatuses,
  occurrenceCounts,
  initialSearch,
}: {
  initialSongs: SongDetail[];
  initialError: string | null;
  publishStatuses: Record<number, PublishStatus>;
  occurrenceCounts: Record<number, number>;
  /** 这次请求的查询串，打开时直接是对的筛选和页码（见 useUrlState） */
  initialSearch: string;
}) {
  const [params, updateUrl] = useUrlState({ initialSearch });
  const searchTerm = readString(params, "q");
  const currentPage = readInt(params, "page", 1);
  const filter = readString(params, "f", "all");
  // 待完善、缺链接下再细分：缺哪组资料、缺哪个平台
  const miss = readString(params, "miss", "all");

  // 防抖在输入这一端（同曲库页）：搜索框立刻变，停下才写进地址栏；结果直接跟着地址栏走。
  // 写地址栏时顺带清掉页码，只写一次。清空时立刻生效
  const commitSearch = useCallback(
    (value: string) =>
      updateUrl((draft) => {
        writeString(draft, "q", value);
        draft.delete("page");
      }),
    [updateUrl],
  );
  const [searchInput, updateSearchInput] = useDebouncedDraft(
    searchTerm,
    commitSearch,
    SEARCH_DEBOUNCE_MS,
  );

  const sortedSongs = useSongs(songs, searchTerm);

  const predicates = useMemo<Record<Filter, (s: SongDetail) => boolean>>(
    () => ({
      all: () => true,
      incomplete: (s) => getMissingFields(s).length > 0,
      unpublished: (s) =>
        (publishStatuses[s.id] ?? "unpublished") !== "published",
      imagery: (s) => lacksImagery(s, occurrenceCounts[s.id] ?? 0),
      score: lacksScore,
      links: (s) => getMissingLinks(s).length > 0,
    }),
    [occurrenceCounts, publishStatuses],
  );
  const activeFilter: Filter =
    filter in predicates ? (filter as Filter) : "all";

  /** 有细分的筛选：每一项的名字与判断 */
  const subFilters = useMemo(() => {
    const groupsById = new Map(songs.map((s) => [s.id, getMissingGroups(s)]));
    const linksById = new Map(songs.map((s) => [s.id, getMissingLinks(s)]));
    return {
      incomplete: MISSING_GROUPS.map((g) => ({
        id: g.key as string,
        label: g.label,
        test: (s: SongDetail) => !!groupsById.get(s.id)?.includes(g.key),
      })),
      links: PLATFORM_LINKS.map((l) => ({
        id: l.key as string,
        label: l.label,
        test: (s: SongDetail) => !!linksById.get(s.id)?.includes(l.key),
      })),
    } as Partial<
      Record<
        Filter,
        { id: string; label: string; test: (s: SongDetail) => boolean }[]
      >
    >;
  }, [songs]);
  const subs = subFilters[activeFilter];
  const activeSub = subs?.find((o) => o.id === miss);

  const counts = useMemo(
    () =>
      Object.fromEntries(
        (Object.keys(predicates) as Filter[]).map((key) => [
          key,
          songs.filter(predicates[key]).length,
        ]),
      ) as Record<Filter, number>,
    [predicates, songs],
  );

  const visibleSongs = sortedSongs.filter(
    (s) => predicates[activeFilter](s) && (!activeSub || activeSub.test(s)),
  );

  const totalPages = Math.max(
    1,
    Math.ceil(visibleSongs.length / ITEMS_PER_PAGE),
  );
  const safePage = Math.min(Math.max(1, currentPage), totalPages);
  const pagedSongs = visibleSongs.slice(
    (safePage - 1) * ITEMS_PER_PAGE,
    safePage * ITEMS_PER_PAGE,
  );

  useEffect(() => {
    if (safePage !== currentPage) {
      updateUrl((draft) => writeInt(draft, "page", safePage, 1));
    }
  }, [currentPage, safePage, updateUrl]);

  const filters: FilterOption<Filter>[] = [
    { key: "all", label: "全部", count: counts.all },
    { key: "incomplete", label: "待完善", count: counts.incomplete },
    { key: "unpublished", label: "待发布", count: counts.unpublished },
    { key: "imagery", label: "意象不足", count: counts.imagery },
    { key: "score", label: "缺乐谱", count: counts.score },
    { key: "links", label: "缺链接", count: counts.links },
  ];

  return (
    <AdminShell
      section="songs"
      title="歌曲"
      stats={[
        { label: "总计", value: songs.length },
        {
          label: "待完善",
          value: counts.incomplete,
          warn: counts.incomplete > 0,
        },
        {
          label: "待发布",
          value: counts.unpublished,
          warn: counts.unpublished > 0,
        },
      ]}
      actions={
        <Link href="/admin/songs/new" className={SOLID_BUTTON_CLASS}>
          新增歌曲
        </Link>
      }
      pinned={<UsageNotesButton />}
    >
      <AdminToolbar
        search={
          <SearchInput
            value={searchInput}
            onChange={(value) => updateSearchInput(value, value === "")}
            placeholder="搜索标题、专辑、作者"
          />
        }
      >
        <FilterOptions
          options={filters}
          active={activeFilter}
          onSelect={(key) =>
            updateUrl((draft) => {
              writeString(draft, "f", key, "all");
              draft.delete("miss");
              draft.delete("page");
            })
          }
        />
        {subs && (
          <div className="flex items-baseline gap-3">
            <span className="text-xs tracking-[0.2em] text-slate-400 dark:text-slate-500">
              缺
            </span>
            <AdminOptions
              items={[
                { id: "all", label: "全部" },
                ...subs.map((o) => ({
                  id: o.id,
                  label: `${o.label} ${songs.filter(o.test).length}`,
                })),
              ]}
              active={activeSub?.id ?? "all"}
              onSelect={(id) =>
                updateUrl((draft) => {
                  writeString(draft, "miss", id, "all");
                  draft.delete("page");
                })
              }
            />
          </div>
        )}
      </AdminToolbar>

      {error && songs.length === 0 ? (
        <ErrorState message={`加载失败：${error}`} />
      ) : visibleSongs.length === 0 ? (
        <EmptyState>没有符合条件的歌曲</EmptyState>
      ) : (
        <>
          <div
            className={cn(
              META_CLASS,
              "hidden border-b border-slate-200/70 pb-2 lg:grid lg:gap-4 dark:border-slate-800",
              GRID_COLS,
            )}
          >
            <span className="text-right">#</span>
            <span />
            <span>歌名</span>
            <span>作曲</span>
            <span>类型</span>
            <span>状态</span>
          </div>
          <ol>
            {pagedSongs.map((song) => (
              <SongRow
                key={song.id}
                song={song}
                status={publishStatuses[song.id] ?? "unpublished"}
                occurrences={occurrenceCounts[song.id] ?? 0}
                showLinks={activeFilter === "links"}
              />
            ))}
          </ol>
          <Pagination
            className="mt-10"
            currentPage={safePage}
            totalPages={totalPages}
            onPageChange={(page) =>
              updateUrl((draft) =>
                writeInt(draft, "page", Math.max(1, page), 1),
              )
            }
          />
        </>
      )}
    </AdminShell>
  );
}

function SongRow({
  song,
  status,
  occurrences,
  showLinks,
}: {
  song: SongDetail;
  status: PublishStatus;
  occurrences: number;
  /** 筛「缺链接」时，在状态里写出缺哪几个平台 */
  showLinks: boolean;
}) {
  const missing = getMissingFields(song);
  const missingLinks = showLinks
    ? getMissingLinks(song).map((key) => PLATFORM_LABEL.get(key) ?? key)
    : [];
  const fewImagery = lacksImagery(song, occurrences);

  return (
    <li className="border-b border-slate-200/70 dark:border-slate-800">
      <Link
        href={`/admin/songs/${song.id}`}
        className={cn(
          "group grid grid-cols-[2.5rem_minmax(0,1fr)] items-center gap-x-4 gap-y-1 py-3 transition-colors hover:bg-slate-100/60 lg:gap-4 dark:hover:bg-slate-900/60",
          GRID_COLS,
        )}
      >
        <span className="hidden text-right font-mono text-xs text-slate-400 tabular-nums lg:block">
          {song.id}
        </span>
        <span className="row-span-2 size-10 overflow-hidden rounded ring-1 ring-slate-900/5 lg:row-span-1 dark:ring-white/10">
          <AdminCoverArt song={song} />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-slate-900 transition-colors group-hover:text-(--tone) dark:text-slate-100">
            {song.title}
          </span>
          <span className="block truncate text-xs text-slate-500 dark:text-slate-400">
            {[song.album || "未归档", join(song.lyricist)]
              .filter(Boolean)
              .join(" · ")}
          </span>
        </span>
        <span className="hidden truncate text-sm text-slate-500 lg:block dark:text-slate-400">
          {join(song.composer) || "—"}
        </span>
        <span className="hidden truncate text-sm text-slate-500 lg:block dark:text-slate-400">
          {song.type?.[0] ?? "—"}
        </span>
        {/* 窄屏排在歌名下面 */}
        <span className="col-start-2 flex flex-wrap gap-x-3 text-xs lg:col-start-auto">
          {status !== "published" && (
            <span
              className={
                status === "unpublished" ? WARN_TEXT_CLASS : "text-(--tone)"
              }
            >
              {status === "unpublished" ? "未发布" : "待发布"}
            </span>
          )}
          {missing.length > 0 && (
            <span className={WARN_TEXT_CLASS} title={missing.join("、")}>
              缺{summarizeMissing(missing)}
            </span>
          )}
          {missingLinks.length > 0 && (
            <span className="text-slate-500 dark:text-slate-400">
              无{missingLinks.join("、")}链接
            </span>
          )}
          <span
            className={
              fewImagery
                ? WARN_TEXT_CLASS
                : "text-slate-400 dark:text-slate-500"
            }
            title={
              fewImagery
                ? `少于 ${MIN_OCCURRENCES} 个不会进入寻曲测验`
                : undefined
            }
          >
            意象 {occurrences}
          </span>
        </span>
      </Link>
    </li>
  );
}
