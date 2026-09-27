"use client";

import ImageryCaption from "@/components/detail/ImageryCaption";
import LyricsFolio from "@/components/detail/LyricsFolio";
import RelatedWorks from "@/components/detail/RelatedWorks";
import SectionHeading from "@/components/detail/SectionHeading";
import SongColophon from "@/components/detail/SongColophon";
import SongHero from "@/components/detail/SongHero";
import TableOfContents, {
  type NavItem,
} from "@/components/detail/TableOfContents";
import FavoriteButton from "@/components/shared/FavoriteButton";
import FloatingActionButtons from "@/components/shared/FloatingActionButtons";
import ImageModal from "@/components/shared/ImageModal";
import LocaleSwitcher from "@/components/shared/LocaleSwitcher";
import MoreMenu from "@/components/shared/MoreMenu";
import ThemeToggle from "@/components/shared/ThemeToggle";
import { useUserContext } from "@/context/UserContext";
import { useScrollTop } from "@/hooks/ui/useScrollTop";
import { usePathname, useRouter } from "@/i18n/navigation";
import type { SongDetailClientProps, SongImageryMark } from "@/lib/types";
import { cn } from "@/lib/utils/utils";
import { buildFolio, markLines, pickExcerpt } from "@/lib/utils/utils-folio";
import { getCoverUrl, getNmnUrl } from "@/lib/utils/utils-song";
import {
  type CoverTone,
  NEUTRAL_TONE,
  toneFromImage,
} from "@/lib/utils/utils-tone";
import { ArrowLeft, Home, User } from "lucide-react";
import { useTranslations } from "next-intl";
import Image from "next/image";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

/** 题签最多展示的意象数 */
const STRIP_LIMIT = 7;

const SongDetailClient: React.FC<SongDetailClientProps> = ({
  song,
  imagery,
}) => {
  const router = useRouter();
  const pathname = usePathname();
  const t = useTranslations("song");
  const tNav = useTranslations("common.nav");
  const { user, loaded: userLoaded } = useUserContext();
  const hasBenefits = userLoaded && !!user?.hasBenefits;

  const { showScrollTop, scrollToTop } = useScrollTop();
  const [tone, setTone] = useState<CoverTone | null>(null);
  const [activeImagery, setActiveImagery] = useState<number | null>(null);
  const [imageModal, setImageModal] = useState<{
    src: string;
    alt: string;
    title: string;
  } | null>(null);
  const [scoreFailed, setScoreFailed] = useState(false);
  const [isBackActive, setIsBackActive] = useState(false);

  // ── 正文与意象 ──────────────────────────────────────────────────────────
  const folio = useMemo(() => buildFolio(song.lyrics), [song.lyrics]);
  const marked = useMemo(
    () => markLines(folio.lines, imagery.marks),
    [folio.lines, imagery.marks],
  );
  const markById = useMemo(
    () => new Map(imagery.marks.map((m) => [m.id, m])),
    [imagery.marks],
  );
  const excerpt = useMemo(
    () => pickExcerpt(folio.lines, marked),
    [folio.lines, marked],
  );

  // 每个意象在本曲写到的句数与首次出现位置
  const lineStats = useMemo(() => {
    const stats = new Map<number, { count: number; first: number }>();
    marked.forEach((line, i) => {
      for (const id of line.ids) {
        const s = stats.get(id);
        if (s) s.count += 1;
        else stats.set(id, { count: 1, first: i });
      }
    });
    return stats;
  }, [marked]);

  // 题签：只列正文里找得到的意象；本曲写得多的在前，同数时全库少见的在前
  const stripMarks = useMemo(() => {
    return imagery.marks
      .filter((m) => lineStats.has(m.id))
      .sort((a, b) => {
        const diff = lineStats.get(b.id)!.count - lineStats.get(a.id)!.count;
        return diff !== 0 ? diff : a.songCount - b.songCount;
      })
      .slice(0, STRIP_LIMIT);
  }, [imagery.marks, lineStats]);
  const visibleImageryCount = lineStats.size;

  const selectImagery = useCallback((id: number | null) => {
    setActiveImagery(id);
  }, []);

  const selectFromStrip = useCallback(
    (id: number) => {
      setActiveImagery((prev) => (prev === id ? null : id));
      const first = lineStats.get(id)?.first;
      const lyrics = document.getElementById("lyrics");
      if (first === undefined || !lyrics) return;
      // 滚到该意象第一次出现的那一句附近
      const row = lyrics.querySelectorAll("[data-folio-line]")[first];
      const target = row ?? lyrics;
      const top =
        target.getBoundingClientRect().top +
        window.scrollY -
        window.innerHeight * 0.3;
      window.scrollTo({ top, behavior: "smooth" });
    },
    [lineStats],
  );

  const closeCaption = useCallback(() => setActiveImagery(null), []);
  const activeMark: SongImageryMark | null =
    activeImagery !== null ? (markById.get(activeImagery) ?? null) : null;

  // ── 导航栏标题：卷首的大标题滚出视口后才出现 ─────────────────────────────
  const titleRef = useRef<HTMLHeadingElement>(null);
  const [titleOutOfView, setTitleOutOfView] = useState(false);
  useEffect(() => {
    const el = titleRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setTitleOutOfView(!entry.isIntersecting),
      { rootMargin: "-80px 0px 0px 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // ── 其他交互 ────────────────────────────────────────────────────────────
  const openUserPanel = (tab: "account" | "favorites" = "favorites") => {
    if (!user) {
      const next = encodeURIComponent(pathname + window.location.search);
      router.push(`/login?next=${next}`);
      return;
    }
    const d = parseInt(
      sessionStorage.getItem("__hetu_web_nav_depth") || "0",
      10,
    );
    sessionStorage.setItem("__hetu_web_nav_depth", String(d + 1));
    router.push(`/profile?tab=${tab}`);
  };

  const handleBack = () => {
    setIsBackActive(true);
    // 通过 sessionStorage 中的导航深度判断是否有站内历史
    // 该值由主页面在 router.push 前递增，确保 SPA 导航也能正确追踪
    const navDepth = parseInt(
      sessionStorage.getItem("__hetu_web_nav_depth") || "0",
      10,
    );
    if (navDepth > 0) {
      sessionStorage.setItem("__hetu_web_nav_depth", String(navDepth - 1));
      router.back();
    } else {
      router.push("/");
    }
  };

  const handleShare = useCallback(async () => {
    const artistText = song.artist ? ` - ${song.artist.join("、")}` : "";
    const shareData = {
      title: t("shareTitle"),
      text: t("shareText", { title: song.title, artist: artistText }),
      url: window.location.href,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch {
        console.warn(t("shareCancel"));
      }
    } else {
      try {
        await navigator.clipboard.writeText(window.location.href);
        alert(t("copySuccess"));
      } catch {
        console.warn(t("copyError"));
      }
    }
  }, [song.title, song.artist, t]);

  const handleCoverLoad = useCallback((img: HTMLImageElement) => {
    setTone(toneFromImage(img) ?? NEUTRAL_TONE);
  }, []);

  const tocItems = useMemo<NavItem[]>(() => {
    const items: NavItem[] = [
      { id: "info", label: t("folio.sections.cover") },
      { id: "lyrics", label: t("folio.sections.text") },
    ];
    if (song.nmn_status)
      items.push({ id: "score", label: t("folio.sections.appendix") });
    items.push({ id: "colophon", label: t("folio.sections.colophon") });
    if (imagery.related.length > 0)
      items.push({ id: "related", label: t("folio.sections.related") });
    return items;
  }, [song.nmn_status, imagery.related.length, t]);

  const appliedTone = tone ?? NEUTRAL_TONE;

  return (
    <div
      className="relative min-h-screen overflow-x-clip bg-[#FAFAFA] dark:bg-[#0B0F19] transition-colors duration-500 [--tone:var(--tone-light)] dark:[--tone:var(--tone-dark)]"
      style={
        {
          "--tone-light": appliedTone.light,
          "--tone-dark": appliedTone.dark,
        } as React.CSSProperties
      }
    >
      {/* 封面取色铺底：取到颜色后缓缓晕开 */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[900px] transition-opacity duration-[1400ms] ease-out"
        style={{
          opacity: tone ? 1 : 0,
          background: `radial-gradient(ellipse 70% 55% at 18% 0%, ${appliedTone.wash}, transparent 70%), radial-gradient(ellipse 50% 40% at 95% 10%, ${appliedTone.wash}, transparent 70%)`,
        }}
      />

      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#FAFAFA]/80 dark:bg-[#0B0F19]/80 backdrop-blur-md border-b border-slate-200/50 dark:border-slate-800/50">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4 min-w-0">
            <div className="flex items-center gap-1 -ml-2">
              <button
                onClick={handleBack}
                className={cn(
                  "p-2 rounded-full transition-colors text-slate-600 dark:text-slate-400 group",
                  isBackActive
                    ? "bg-slate-200/50 dark:bg-slate-800"
                    : "hover:bg-slate-200/50 dark:hover:bg-slate-800",
                )}
                title={tNav("back")}
              >
                <ArrowLeft
                  size={20}
                  className={cn(
                    "transition-transform",
                    isBackActive
                      ? "-translate-x-0.5"
                      : "group-hover:-translate-x-0.5",
                  )}
                />
              </button>

              <div className="w-px h-4 bg-slate-300 dark:bg-slate-700 mx-0.5" />

              <button
                onClick={() => router.push("/")}
                className="p-2 rounded-full transition-colors text-slate-600 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-slate-800 group"
                title={tNav("home")}
              >
                <Home
                  size={20}
                  className="transition-transform group-hover:scale-105 group-active:scale-95"
                />
              </button>
            </div>
            <div
              className={cn(
                "text-lg font-semibold text-slate-900 dark:text-white tracking-tight hidden sm:block font-serif truncate transition-all duration-500",
                titleOutOfView
                  ? "opacity-100 translate-y-0"
                  : "opacity-0 translate-y-1 pointer-events-none",
              )}
              aria-hidden={!titleOutOfView}
            >
              {song.title}
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              onClick={() => openUserPanel("favorites")}
              className="relative p-2 rounded-full hover:bg-slate-200/50 dark:hover:bg-slate-800 transition-colors text-slate-600 dark:text-slate-400"
              title={user ? user.name : tNav("login")}
            >
              <User
                size={20}
                className={user ? "text-blue-500 dark:text-blue-400" : ""}
              />
            </button>

            {/* PC端显示的 语言 和 主题切换 */}
            <div className="hidden md:flex items-center gap-2">
              <LocaleSwitcher />
              <ThemeToggle />
            </div>

            {/* 移动端显示的“更多”下拉菜单 */}
            <div className="flex md:hidden relative">
              <MoreMenu />
            </div>
          </div>
        </div>
      </nav>

      <main className="relative pt-32 md:pt-40 pb-32 max-w-6xl mx-auto px-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <SongHero
          song={song}
          titleRef={titleRef}
          stripMarks={stripMarks}
          imageryTotal={visibleImageryCount}
          excerpt={excerpt}
          activeImagery={activeImagery}
          showPlayer={hasBenefits}
          onSelectImagery={selectFromStrip}
          onCoverLoad={handleCoverLoad}
          onOpenCover={() =>
            setImageModal({
              src: getCoverUrl(song),
              alt: song.album || song.title,
              title: `${song.title} - 封面`,
            })
          }
        />

        <LyricsFolio
          songId={song.id}
          rawLyrics={song.lyrics}
          lines={folio.lines}
          marked={marked}
          markById={markById}
          activeImagery={activeImagery}
          onSelectImagery={selectImagery}
        />

        {song.nmn_status && (
          <section id="score" className="py-16 md:py-20">
            <SectionHeading
              label={`${t("folio.sections.appendix")} · ${t("sections.score")}`}
            />
            <div className="mt-12 lg:ml-[26rem]">
              {scoreFailed ? (
                <p className="py-16 text-center text-sm text-slate-400">
                  {t("scoreLoadError")}
                </p>
              ) : (
                <button
                  type="button"
                  onClick={() =>
                    setImageModal({
                      src: getNmnUrl(song),
                      alt: `${song.title} - 乐谱`,
                      title: "乐谱",
                    })
                  }
                  className="group relative block w-full max-h-[28rem] overflow-hidden rounded-md bg-white ring-1 ring-slate-900/5 dark:ring-white/10"
                >
                  <Image
                    src={getNmnUrl(song)}
                    alt="Score"
                    width={800}
                    height={600}
                    className="w-full h-auto dark:opacity-90"
                    onError={() => setScoreFailed(true)}
                  />
                  <span className="absolute inset-x-0 bottom-0 h-32 bg-linear-to-t from-white via-white/80 to-transparent flex items-end justify-center pb-5">
                    <span className="text-xs tracking-[0.3em] text-slate-500 group-hover:text-slate-900 transition-colors">
                      {t("zoomScore")}
                    </span>
                  </span>
                </button>
              )}
            </div>
          </section>
        )}

        <SongColophon song={song} credits={folio.credits} />

        <RelatedWorks songs={imagery.related} />
      </main>

      <ImageryCaption
        mark={activeMark}
        lineCount={
          activeImagery !== null
            ? (lineStats.get(activeImagery)?.count ?? 0)
            : 0
        }
        onClose={closeCaption}
      />

      <FloatingActionButtons
        showScrollTop={showScrollTop}
        onScrollToTop={scrollToTop}
        onShare={handleShare}
      >
        <FavoriteButton songId={song.id} variant="icon" />
      </FloatingActionButtons>

      <ImageModal
        isOpen={imageModal !== null}
        onClose={() => setImageModal(null)}
        src={imageModal?.src ?? ""}
        alt={imageModal?.alt ?? ""}
        title={imageModal?.title ?? ""}
      />

      <TableOfContents items={tocItems} />
    </div>
  );
};

export default SongDetailClient;
