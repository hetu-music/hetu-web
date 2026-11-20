"use client";

import CoverArt from "@/components/library/CoverArt";
import EnqueueButton from "@/components/shared/EnqueueButton";
import Pagination from "@/components/shared/Pagination";
import PlayButton from "@/components/shared/PlayButton";
import SiteMark from "@/components/shared/SiteMark";
import { useFavorites } from "@/context/FavoritesContext";
import { Link } from "@/i18n/navigation";
import { FILTER_OPTION_ALL, FILTER_OPTION_UNKNOWN } from "@/lib/constants";
import { cn } from "@/lib/utils/utils";
import { formatTime } from "@/lib/utils/utils-common";
import { enumLabel, getCoverUrl } from "@/lib/utils/utils-song";
import {
  type CoverTone,
  INK_TONE,
  toneFromImage,
} from "@/lib/utils/utils-tone";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  ArrowUpRight,
  Compass,
  Disc3,
  Heart,
  LayoutGrid,
  List,
  RotateCcw,
  Scroll,
  Search,
  Shuffle,
  Sparkles,
  XCircle,
} from "lucide-react";
import { useTranslations } from "next-intl";
import Image from "next/image";
import React, { useCallback, useState } from "react";
import {
  type DemoViewProps,
  FEATURE_ITEMS,
  songCreditLine,
} from "./shared";

const FEATURE_ICONS = {
  qjtx: Scroll,
  imagery: Sparkles,
  quiz: Compass,
};

/**
 * 方向 B：「光影唱片行」（Atmospheric Showcase）
 * 更彻底地跳出极简白纸：沉浸式流动封面幕布首屏 + 内嵌光感大搜索框 +
 * 焦点黑胶唱片展台 + 「近期收录」横滑画廊条 + 材质浮雕感曲库卡片。
 */
export default function DemoBShowcase({
  filteredSongs,
  pageSongs,
  featured,
  recentSongs,
  wallSongs,
  stats,
  types,
  activeType,
  onTypeChange,
  searchQuery,
  onSearchChange,
  isFiltering,
  onReset,
  view,
  onViewChange,
  page,
  totalPages,
  onPageChange,
  listStartRef,
  onOpenSong,
  onRandomSong,
}: DemoViewProps) {
  const tCommon = useTranslations("common");
  const tEnum = useTranslations("enums");
  const { isFavorite, toggleFavorite, isLoggedIn } = useFavorites();

  const [spotIdx, setSpotIdx] = useState(0);
  const [tone, setTone] = useState<CoverTone | null>(null);

  const safeIdx = featured.length > 0 ? spotIdx % featured.length : 0;
  const spotlight = featured[safeIdx] ?? null;

  const handleCoverLoad = useCallback((img: HTMLImageElement) => {
    setTone(toneFromImage(img) ?? INK_TONE);
  }, []);

  const appliedTone = tone ?? INK_TONE;
  const showShowcase = !isFiltering && page === 1;

  // 背景氛围封面条（两行慢速对向漂移，取自真实曲库封面）
  const mosaicPool =
    wallSongs.length >= 12
      ? wallSongs.slice(0, 16)
      : recentSongs.slice(0, 16).map((s) => ({
          id: s.id,
          title: s.title,
          excerpt: "",
        }));

  return (
    <div
      className="relative min-h-screen overflow-x-clip bg-[#F6F7F9] transition-colors duration-500 [--tone:var(--tone-light)] dark:bg-[#080C15] dark:[--tone:var(--tone-dark)]"
      style={
        {
          "--tone-light": appliedTone.light,
          "--tone-dark": appliedTone.dark,
        } as React.CSSProperties
      }
    >
      {/* ── 1. 沉浸式光影幕布首屏 ── */}
      <section className="relative overflow-hidden border-b border-slate-200/70 pt-28 pb-14 md:pt-36 md:pb-20 dark:border-white/[0.06]">
        {/* 背景流动封面矩阵 + 多层柔光遮罩 */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 overflow-hidden"
        >
          {mosaicPool.length > 0 && (
            <div className="absolute -inset-x-10 top-6 flex flex-col gap-4 opacity-[0.14] blur-[1px] dark:opacity-[0.18]">
              {[0, 1].map((row) => {
                const items = mosaicPool.filter((_, i) => i % 2 === row);
                return (
                  <div
                    key={row}
                    className="flex w-max gap-4 motion-reduce:animate-none!"
                    style={{
                      animation: `${row === 0 ? "imagery-marquee-ltr" : "imagery-marquee-rtl"} ${row === 0 ? 110 : 130}s linear infinite`,
                    }}
                  >
                    {[...items, ...items, ...items].map((item, i) => (
                      <div
                        key={`${item.id}-${i}`}
                        className="h-36 w-36 shrink-0 overflow-hidden rounded-xl bg-slate-200 dark:bg-slate-800"
                      >
                        <Image
                          src={getCoverUrl({ id: item.id, hascover: true })}
                          alt=""
                          width={160}
                          height={160}
                          className="h-full w-full object-cover"
                        />
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          )}

          {/* 封面取色极光雾面 */}
          <div
            className="absolute inset-0 transition-opacity duration-1000"
            style={{
              background: `radial-gradient(ellipse 60% 70% at 75% 25%, ${appliedTone.wash}, transparent 70%), radial-gradient(ellipse 55% 60% at 20% 20%, ${appliedTone.wash}, transparent 75%)`,
            }}
          />
          <div className="absolute inset-0 bg-linear-to-b from-[#F6F7F9]/85 via-[#F6F7F9]/70 to-[#F6F7F9] dark:from-[#080C15]/85 dark:via-[#080C15]/68 dark:to-[#080C15]" />
        </div>

        <div className="relative mx-auto max-w-7xl px-6">
          <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:gap-14">
            {/* 左侧：醒目主视觉 + 首屏内嵌大搜索框 */}
            <div>
              <div className="inline-flex items-center gap-2.5 rounded-full border border-slate-900/10 bg-white/75 px-3.5 py-1.5 text-xs tracking-[0.2em] text-slate-600 backdrop-blur-md dark:border-white/10 dark:bg-white/[0.06] dark:text-slate-300">
                <Disc3
                  size={13}
                  className="animate-[spin_9s_linear_infinite] text-(--tone)"
                />
                <span>河图声音档案</span>
                <span className="text-slate-300 dark:text-slate-600">·</span>
                <span className="font-mono tabular-nums text-(--tone)">
                  {stats.catalogCount} 曲
                </span>
              </div>

              <h1 className="mt-6 font-serif text-4xl font-semibold leading-[1.14] tracking-tight text-slate-900 dark:text-white sm:text-5xl xl:text-6xl">
                听见故事里的
                <span className="bg-linear-to-r from-(--tone) to-slate-700 bg-clip-text text-transparent dark:to-slate-200">
                  山河岁月
                </span>
              </h1>

              <p className="mt-4 max-w-xl font-kaiti text-base leading-relaxed text-slate-600 dark:text-slate-300 sm:text-lg">
                从《倾尽天下》到最新收录，完整汇集歌词校记、创作手记、意象谱系与曲谱典藏。
              </p>

              {/* 首屏中心大搜索胶囊：实时过滤下方曲库 */}
              <div className="mt-7 max-w-xl">
                <label className="group flex items-center gap-3 rounded-2xl border border-slate-900/10 bg-white/90 px-4 py-3.5 shadow-[0_16px_40px_-16px_rgba(15,23,42,0.16)] backdrop-blur-xl transition-all focus-within:border-(--tone)/60 focus-within:ring-4 focus-within:ring-(--tone)/10 dark:border-white/10 dark:bg-slate-900/80 dark:shadow-[0_16px_40px_-16px_rgba(0,0,0,0.6)]">
                  <Search
                    size={18}
                    className="shrink-0 text-slate-400 transition-colors group-focus-within:text-(--tone)"
                  />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => onSearchChange(e.target.value)}
                    placeholder="搜一首歌名、作词人、专辑，或直接按下方分类浏览..."
                    className="min-w-0 flex-1 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400 dark:text-white dark:placeholder:text-slate-500"
                  />
                  {searchQuery ? (
                    <button
                      type="button"
                      onClick={() => onSearchChange("")}
                      className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                    >
                      <XCircle size={16} />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={onRandomSong}
                      className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-slate-100 px-3 py-1.5 text-xs tracking-wider text-slate-600 transition-colors hover:bg-(--tone) hover:text-white dark:bg-white/[0.08] dark:text-slate-300 dark:hover:bg-(--tone) dark:hover:text-slate-950"
                    >
                      <Shuffle size={12} />
                      随缘一曲
                    </button>
                  )}
                </label>

                {/* 快捷流派/年份标签芯片 */}
                <div className="mt-3.5 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <span className="text-[11px] tracking-widest text-slate-400">
                    快览：
                  </span>
                  {types.slice(0, 6).map((opt) => {
                    const active = activeType === opt;
                    const label =
                      opt === FILTER_OPTION_ALL
                        ? tCommon("all")
                        : opt === FILTER_OPTION_UNKNOWN
                          ? tCommon("unknown")
                          : enumLabel(tEnum, "type", opt);
                    return (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => onTypeChange(opt)}
                        className={cn(
                          "rounded-full px-3 py-1 text-xs transition-all",
                          active
                            ? "bg-(--tone) text-white dark:text-slate-950"
                            : "bg-white/70 text-slate-600 ring-1 ring-slate-900/[0.06] hover:bg-white dark:bg-white/[0.05] dark:text-slate-300 dark:ring-white/10 dark:hover:bg-white/10",
                        )}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* 右侧：玻璃/宣纸质感焦点唱片展台（带隐约黑胶唱片探出效果） */}
            {spotlight && (
              <div className="relative">
                <div className="group relative overflow-hidden rounded-3xl border border-white/80 bg-white/75 p-5 shadow-[0_28px_70px_-24px_rgba(15,23,42,0.22)] backdrop-blur-xl sm:p-6 dark:border-white/10 dark:bg-slate-900/65 dark:shadow-[0_28px_70px_-24px_rgba(0,0,0,0.8)]">
                  <div className="flex items-center justify-between text-xs text-slate-400 dark:text-slate-500">
                    <span className="tracking-[0.25em] text-(--tone)">
                      焦点唱片
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setSpotIdx((i) => (i + 1) % featured.length)
                      }
                      className="inline-flex items-center gap-1 tracking-wider transition-colors hover:text-slate-800 dark:hover:text-slate-200"
                    >
                      换一首
                      <ArrowRight size={12} />
                    </button>
                  </div>

                  <AnimatePresence mode="wait">
                    <motion.div
                      key={spotlight.song.id}
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      transition={{ duration: 0.4 }}
                      className="mt-5 flex flex-col gap-5 sm:flex-row sm:items-center"
                    >
                      {/* 唱片封面 + 右侧微探出的暗黑唱片轮廓 */}
                      <button
                        type="button"
                        onClick={() => onOpenSong(spotlight.song.id)}
                        className="relative mx-auto block h-44 w-44 shrink-0 sm:mx-0 sm:mr-4"
                      >
                        <span
                          aria-hidden
                          className="absolute inset-y-2 -right-5 w-40 rounded-full bg-linear-to-br from-slate-800 via-slate-950 to-slate-800 shadow-lg ring-1 ring-white/10 transition-transform duration-700 group-hover:translate-x-2 group-hover:rotate-12"
                        >
                          <span className="absolute inset-[36%] rounded-full border border-white/15 bg-(--tone)/40" />
                        </span>
                        <span className="relative block h-full w-full overflow-hidden rounded-2xl shadow-xl ring-1 ring-black/10 dark:ring-white/15">
                          <Image
                            src={getCoverUrl(spotlight.song)}
                            alt={spotlight.song.title}
                            width={360}
                            height={360}
                            onLoad={(e) => handleCoverLoad(e.currentTarget)}
                            className="h-full w-full object-cover"
                          />
                        </span>
                      </button>

                      <div className="min-w-0 flex-1">
                        <p className="font-mono text-xs text-slate-400 dark:text-slate-500">
                          {spotlight.song.year || "典藏"}
                          {spotlight.song.genre?.[0]
                            ? ` · ${enumLabel(tEnum, "genre", spotlight.song.genre[0])}`
                            : ""}
                        </p>
                        <button
                          type="button"
                          onClick={() => onOpenSong(spotlight.song.id)}
                          className="mt-1 block text-left"
                        >
                          <h2 className="truncate font-serif text-2xl text-slate-900 transition-colors hover:text-(--tone) dark:text-white">
                            {spotlight.song.title}
                          </h2>
                        </button>
                        <p className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">
                          {songCreditLine(spotlight.song)}
                        </p>
                        {spotlight.excerpt && (
                          <p className="mt-3.5 line-clamp-2 border-l-2 border-(--tone)/50 pl-3 font-kaiti text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                            {spotlight.excerpt}
                          </p>
                        )}
                        <div className="mt-4 flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => onOpenSong(spotlight.song.id)}
                            className="inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-3.5 py-1.5 text-xs tracking-wider text-white transition-opacity hover:opacity-85 dark:bg-white dark:text-slate-950"
                          >
                            进入详情
                            <ArrowUpRight size={13} />
                          </button>
                          <PlayButton
                            songId={spotlight.song.id}
                            title={spotlight.song.title}
                            artist={spotlight.song.artist?.join(" / ")}
                            coverUrl={getCoverUrl(spotlight.song)}
                            hasAudio={spotlight.song.has_audio}
                          />
                        </div>
                      </div>
                    </motion.div>
                  </AnimatePresence>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-7xl px-6 pb-32 pt-12">
        {/* ── 2. 「近期收录」横滑画廊条（打破满屏小方图的单调） ── */}
        {showShowcase && recentSongs.length > 0 && (
          <section className="mb-14">
            <div className="mb-5 flex items-end justify-between">
              <div>
                <p className="text-[11px] tracking-[0.3em] text-(--tone)">
                  NEW ARRIVALS
                </p>
                <h2 className="mt-1 font-serif text-2xl text-slate-900 dark:text-white">
                  近期收录
                </h2>
              </div>
              <span className="text-xs text-slate-400 dark:text-slate-500">
                左右滑动浏览新作 →
              </span>
            </div>

            <div className="no-scrollbar -mx-6 flex gap-5 overflow-x-auto px-6 pb-3">
              {recentSongs.slice(0, 8).map((song) => (
                <article
                  key={song.id}
                  onClick={() => onOpenSong(song.id)}
                  className="group relative w-56 shrink-0 cursor-pointer overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-3 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl sm:w-64 dark:border-white/[0.08] dark:bg-slate-900/70 dark:hover:border-white/20"
                >
                  <div className="relative aspect-square w-full overflow-hidden rounded-xl">
                    <CoverArt song={song} sizes="256px" />
                    {song.year && (
                      <span className="absolute left-2.5 top-2.5 rounded-full bg-black/55 px-2.5 py-0.5 font-mono text-[11px] text-white backdrop-blur-md">
                        {song.year}
                      </span>
                    )}
                  </div>
                  <div className="mt-3 px-1">
                    <h3 className="truncate font-serif text-base text-slate-900 transition-colors group-hover:text-(--tone) dark:text-slate-100">
                      {song.title}
                    </h3>
                    <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
                      {songCreditLine(song)}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        {/* ── 3. 三大互动特辑光感卡片 ── */}
        {showShowcase && (
          <section className="mb-16">
            <div className="mb-5">
              <p className="text-[11px] tracking-[0.3em] text-(--tone)">
                CURATED EXPERIENCES
              </p>
              <h2 className="mt-1 font-serif text-2xl text-slate-900 dark:text-white">
                漫游专题
              </h2>
            </div>

            <div className="grid gap-5 md:grid-cols-3">
              {FEATURE_ITEMS.map((item) => {
                const Icon = FEATURE_ICONS[item.id];
                return (
                  <Link
                    key={item.id}
                    href={item.href}
                    className="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl dark:border-white/[0.08] dark:bg-slate-900/75 dark:hover:border-white/20"
                  >
                    <div
                      aria-hidden
                      className="pointer-events-none absolute inset-0 opacity-[0.07] transition-opacity duration-500 group-hover:opacity-[0.16] dark:opacity-[0.14] dark:group-hover:opacity-[0.24]"
                      style={{
                        background: `radial-gradient(circle at 90% 10%, ${item.accentLight}, transparent 62%)`,
                      }}
                    />
                    <div className="relative flex items-start justify-between">
                      <span
                        className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-white shadow-sm"
                        style={{ backgroundColor: item.accentLight }}
                      >
                        <Icon size={18} />
                      </span>
                      <span className="rounded-full border border-slate-200 px-2.5 py-0.5 text-[11px] tracking-widest text-slate-500 dark:border-white/10 dark:text-slate-400">
                        {item.tag}
                      </span>
                    </div>
                    <h3 className="relative mt-6 font-serif text-xl text-slate-900 dark:text-white">
                      {item.title}
                    </h3>
                    <p className="relative mt-2 font-kaiti text-sm leading-relaxed text-slate-500 dark:text-slate-400">
                      {item.subtitle}
                    </p>
                    <div className="relative mt-5 inline-flex items-center gap-1.5 text-xs tracking-widest text-(--tone)">
                      <span>立即探索</span>
                      <ArrowRight
                        size={13}
                        className="transition-transform group-hover:translate-x-1"
                      />
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        {/* ── 4. 全部曲库（材质浮雕卡片 / 现代唱片行列表） ── */}
        <div ref={listStartRef} aria-hidden className="scroll-mt-(--nav-h)" />

        <section>
          <div className="mb-8 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200/80 bg-white/85 px-4 py-3 shadow-xs backdrop-blur-md dark:border-white/[0.08] dark:bg-slate-900/70">
            <div className="flex items-center gap-3">
              <h2 className="font-serif text-lg text-slate-900 dark:text-white">
                全部曲目
              </h2>
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 font-mono text-xs tabular-nums text-slate-600 dark:bg-white/10 dark:text-slate-300">
                {filteredSongs.length}
              </span>
              {isFiltering && (
                <button
                  type="button"
                  onClick={onReset}
                  className="inline-flex items-center gap-1 text-xs text-(--tone) hover:underline"
                >
                  <RotateCcw size={12} />
                  重置
                </button>
              )}
            </div>

            <div className="flex items-center gap-1 rounded-xl bg-slate-100/90 p-1 dark:bg-white/[0.06]">
              <button
                type="button"
                onClick={() => onViewChange("grid")}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs transition-all",
                  view === "grid"
                    ? "bg-white text-slate-900 shadow-xs dark:bg-slate-800 dark:text-white"
                    : "text-slate-500 hover:text-slate-900 dark:text-slate-400",
                )}
              >
                <LayoutGrid size={14} />
                网格
              </button>
              <button
                type="button"
                onClick={() => onViewChange("list")}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs transition-all",
                  view === "list"
                    ? "bg-white text-slate-900 shadow-xs dark:bg-slate-800 dark:text-white"
                    : "text-slate-500 hover:text-slate-900 dark:text-slate-400",
                )}
              >
                <List size={14} />
                列表
              </button>
            </div>
          </div>

          {pageSongs.length === 0 ? (
            <p className="py-24 text-center font-kaiti text-base text-slate-400">
              没有找到匹配的歌曲
            </p>
          ) : view === "grid" ? (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {pageSongs.map((song, idx) => {
                const fav = isFavorite(song.id);
                return (
                  <article
                    key={song.id}
                    onClick={() => onOpenSong(song.id)}
                    className="group flex cursor-pointer flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-3 shadow-xs transition-all duration-300 hover:-translate-y-1 hover:border-(--tone)/35 hover:shadow-[0_20px_40px_-20px_rgba(15,23,42,0.24)] dark:border-white/[0.08] dark:bg-slate-900/65 dark:hover:border-(--tone)/45 dark:hover:shadow-[0_20px_40px_-20px_rgba(0,0,0,0.8)]"
                  >
                    <div className="relative aspect-square w-full overflow-hidden rounded-xl">
                      <CoverArt
                        song={song}
                        sizes="(min-width: 1280px) 270px, (min-width: 1024px) 30vw, (min-width: 640px) 45vw, 75vw"
                        priority={idx < 4 ? "eager" : undefined}
                      />
                      <div className="absolute right-2.5 bottom-2.5 flex items-center gap-1 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                        <PlayButton
                          songId={song.id}
                          title={song.title}
                          artist={song.artist?.join(" / ")}
                          coverUrl={getCoverUrl(song)}
                          hasAudio={song.has_audio}
                          className="rounded-full bg-white/90 p-1.5 text-slate-900 shadow-md dark:bg-slate-900/90 dark:text-white"
                          size={13}
                        />
                        <EnqueueButton
                          songId={song.id}
                          title={song.title}
                          artist={song.artist?.join(" / ")}
                          coverUrl={getCoverUrl(song)}
                          hasAudio={song.has_audio}
                          className="rounded-full bg-white/90 p-1.5 text-slate-900 shadow-md dark:bg-slate-900/90 dark:text-white"
                          size={13}
                        />
                        {isLoggedIn && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleFavorite(song.id);
                            }}
                            aria-label="收藏"
                            className={cn(
                              "rounded-full bg-white/90 p-1.5 shadow-md dark:bg-slate-900/90",
                              fav ? "text-rose-500" : "text-slate-600",
                            )}
                          >
                            <Heart
                              size={13}
                              className={fav ? "fill-current" : ""}
                            />
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="mt-3.5 flex flex-1 flex-col justify-between px-1 pb-1">
                      <div>
                        <h3 className="line-clamp-1 font-serif text-[17px] text-slate-900 transition-colors group-hover:text-(--tone) dark:text-slate-100">
                          {song.title}
                        </h3>
                        <p className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">
                          {songCreditLine(song)}
                        </p>
                      </div>

                      <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2.5 text-[11px] text-slate-400 dark:border-white/[0.06] dark:text-slate-500">
                        <span>
                          {song.type?.[0]
                            ? enumLabel(tEnum, "type", song.type[0])
                            : "作品"}
                        </span>
                        <span className="font-mono tabular-nums">
                          {song.year || FILTER_OPTION_UNKNOWN}
                        </span>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="space-y-2.5">
              {pageSongs.map((song) => (
                <div
                  key={song.id}
                  onClick={() => onOpenSong(song.id)}
                  className="group flex cursor-pointer items-center gap-4 rounded-2xl border border-slate-200/75 bg-white px-4 py-3 shadow-2xs transition-all hover:border-(--tone)/35 hover:shadow-md dark:border-white/[0.07] dark:bg-slate-900/65"
                >
                  <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl">
                    <CoverArt song={song} sizes="56px" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate font-serif text-base text-slate-900 transition-colors group-hover:text-(--tone) dark:text-white">
                      {song.title}
                    </h3>
                    <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                      {songCreditLine(song)}
                    </p>
                  </div>
                  {song.type?.[0] && (
                    <span className="hidden rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] text-slate-600 md:inline-block dark:bg-white/[0.08] dark:text-slate-300">
                      {enumLabel(tEnum, "type", song.type[0])}
                    </span>
                  )}
                  <span className="w-12 text-right font-mono text-xs tabular-nums text-slate-400">
                    {song.year || "—"}
                  </span>
                  <span className="hidden w-12 text-right font-mono text-xs tabular-nums text-slate-400 sm:block">
                    {formatTime(song.length)}
                  </span>
                </div>
              ))}
            </div>
          )}

          <Pagination
            className="mt-14"
            currentPage={page}
            totalPages={totalPages}
            onPageChange={onPageChange}
            scrollTarget={listStartRef}
          />
        </section>

        <footer className="mt-24 flex flex-col items-center justify-between gap-4 border-t border-slate-200/70 pt-8 sm:flex-row dark:border-white/[0.08]">
          <SiteMark />
          <div className="flex items-center gap-5 text-xs tracking-widest text-slate-400 dark:text-slate-500">
            {FEATURE_ITEMS.map((item) => (
              <Link
                key={item.id}
                href={item.href}
                className="transition-colors hover:text-(--tone)"
              >
                {item.title}
              </Link>
            ))}
          </div>
        </footer>
      </main>
    </div>
  );
}
