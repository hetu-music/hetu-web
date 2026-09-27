"use client";

import CommentSheet from "@/components/detail/comments/CommentSheet";
import { CommentsProvider } from "@/components/detail/comments/CommentsContext";
import CommentsSection from "@/components/detail/comments/CommentsSection";
import CreatorNotes from "@/components/detail/CreatorNotes";
import ImageryCaption from "@/components/detail/ImageryCaption";
import LyricsFolio from "@/components/detail/LyricsFolio";
import RelatedWorks from "@/components/detail/RelatedWorks";
import ScoreSection from "@/components/detail/ScoreSection";
import SongColophon from "@/components/detail/SongColophon";
import SongHero from "@/components/detail/SongHero";
import {
  type NavItem,
  ReadingProgress,
  SectionNav,
  SectionSheet,
  useActiveSection,
} from "@/components/detail/SectionNav";
import { InstallButton } from "@/components/pwa/useInstallAction";
import FavoriteButton from "@/components/shared/FavoriteButton";
import ImageModal from "@/components/shared/ImageModal";
import LocaleSwitcher from "@/components/shared/LocaleSwitcher";
import MoreMenu, { type MoreMenuAction } from "@/components/shared/MoreMenu";
import { NAV_BUTTON_CLASS } from "@/components/shared/nav-button";
import FloatingActionButtons from "@/components/shared/FloatingActionButtons";
import ThemeToggle from "@/components/shared/ThemeToggle";
import { useUserContext } from "@/context/UserContext";
import { useScrollTop } from "@/hooks/ui/useScrollTop";
import { usePathname, useRouter } from "@/i18n/navigation";
import type { SongDetailClientProps, SongImageryMark } from "@/lib/types";
import { cn } from "@/lib/utils/utils";
import {
  buildFolio,
  markLines,
  parseNotes,
  pickExcerpt,
} from "@/lib/utils/utils-folio";
import { getCoverUrl, getNmnUrl } from "@/lib/utils/utils-song";
import {
  type CoverTone,
  NEUTRAL_TONE,
  toneFromImage,
} from "@/lib/utils/utils-tone";
import { ArrowLeft, Home, Share2, User } from "lucide-react";
import { useTranslations } from "next-intl";
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
  const [isBackActive, setIsBackActive] = useState(false);

  // ── 正文与意象 ──────────────────────────────────────────────────────────
  const folio = useMemo(
    () =>
      buildFolio(song.lyrics, {
        title: song.title,
        lyricsStart: song.lyrics_start,
      }),
    [song.lyrics, song.title, song.lyrics_start],
  );
  const notes = useMemo(() => parseNotes(song.comment), [song.comment]);
  const anchorCtx = useMemo(
    () => ({ lines: folio.lines, paragraphs: notes?.paragraphs ?? [] }),
    [folio.lines, notes],
  );
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
        const diff =
          (lineStats.get(b.id)?.count ?? 0) - (lineStats.get(a.id)?.count ?? 0);
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
    const items: NavItem[] = [{ id: "info", label: t("folio.sections.cover") }];
    if (notes) items.push({ id: "notes", label: t("folio.sections.notes") });
    items.push({ id: "lyrics", label: t("folio.sections.text") });
    if (song.nmn_status)
      items.push({ id: "score", label: t("sections.score") });
    items.push({ id: "comments", label: t("folio.sections.comments") });
    items.push({ id: "colophon", label: t("folio.sections.colophon") });
    if (imagery.related.length > 0)
      items.push({ id: "related", label: t("folio.sections.related") });
    return items;
  }, [song.nmn_status, imagery.related.length, notes, t]);

  const activeSection = useActiveSection(tocItems);
  const [tocOpen, setTocOpen] = useState(false);

  const goHome = useCallback(() => router.push("/"), [router]);
  const moreActions = useMemo<MoreMenuAction[]>(
    () => [
      {
        key: "share",
        icon: Share2,
        label: t("actions.share"),
        onClick: handleShare,
      },
      { key: "home", icon: Home, label: tNav("home"), onClick: goHome },
    ],
    [t, tNav, handleShare, goHome],
  );

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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-20 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1 sm:gap-3 min-w-0">
            <div className="flex items-center gap-1 -ml-2 shrink-0">
              <button
                onClick={handleBack}
                className={cn(
                  NAV_BUTTON_CLASS,
                  "group",
                  isBackActive && "bg-slate-200/50 dark:bg-slate-800",
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

              {/* 窄屏放不下，回主页收进「更多」 */}
              <div className="hidden md:block w-px h-4 bg-slate-300 dark:bg-slate-700 mx-0.5" />
              <button
                onClick={goHome}
                className={cn(NAV_BUTTON_CLASS, "group hidden md:inline-flex")}
                title={tNav("home")}
              >
                <Home
                  size={20}
                  className="transition-transform group-hover:scale-105 group-active:scale-95"
                />
              </button>
            </div>

            <SectionNav
              items={tocItems}
              active={activeSection}
              title={song.title}
              showTitle={titleOutOfView}
              open={tocOpen}
              onOpenChange={setTocOpen}
            />
          </div>

          <div className="flex items-center gap-0.5 sm:gap-2 shrink-0">
            <FavoriteButton songId={song.id} />
            <button
              onClick={() => openUserPanel("favorites")}
              className={NAV_BUTTON_CLASS}
              title={user ? user.name : tNav("login")}
            >
              <User
                size={20}
                className={user ? "text-blue-500 dark:text-blue-400" : ""}
              />
            </button>

            {/* 宽屏平铺 分享、安装、语言 和 主题切换 */}
            <div className="hidden md:flex items-center gap-2">
              <button
                onClick={handleShare}
                className={NAV_BUTTON_CLASS}
                title={t("actions.share")}
                aria-label={t("actions.share")}
              >
                <Share2 size={20} />
              </button>
              <InstallButton className={NAV_BUTTON_CLASS} />
              <LocaleSwitcher />
              <ThemeToggle />
            </div>

            {/* 窄屏收进「更多」 */}
            <div className="flex md:hidden relative">
              <MoreMenu actions={moreActions} />
            </div>
          </div>
        </div>
        <ImageryCaption
          mark={activeMark}
          lineCount={
            activeImagery !== null
              ? (lineStats.get(activeImagery)?.count ?? 0)
              : 0
          }
          onClose={closeCaption}
        />
        <ReadingProgress />
      </nav>

      <CommentsProvider
        songId={song.id}
        anchorCtx={anchorCtx}
        onSheetOpen={closeCaption}
      >
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

          {notes && <CreatorNotes notes={notes} />}

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
            <ScoreSection
              song={song}
              onOpen={() =>
                setImageModal({
                  src: getNmnUrl(song),
                  alt: `${song.title} - 乐谱`,
                  title: "乐谱",
                })
              }
            />
          )}

          <CommentsSection />

          <SongColophon
            song={song}
            credits={folio.credits}
            notices={folio.notices}
          />

          <RelatedWorks songs={imagery.related} />
        </main>

        <CommentSheet />
      </CommentsProvider>

      <FloatingActionButtons
        showScrollTop={showScrollTop}
        onScrollToTop={scrollToTop}
      />

      <ImageModal
        isOpen={imageModal !== null}
        onClose={() => setImageModal(null)}
        src={imageModal?.src ?? ""}
        alt={imageModal?.alt ?? ""}
        title={imageModal?.title ?? ""}
      />

      <SectionSheet
        items={tocItems}
        active={activeSection}
        open={tocOpen}
        onOpenChange={setTocOpen}
      />
    </div>
  );
};

export default SongDetailClient;
