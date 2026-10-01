"use client";

import { CommentsProvider } from "@/components/detail/comments/CommentsContext";
import CommentSheet from "@/components/detail/comments/CommentSheet";
import CommentsSection from "@/components/detail/comments/CommentsSection";
import CreatorNotes from "@/components/detail/CreatorNotes";
import DisputeNotice from "@/components/detail/DisputeNotice";
import ImageryCaption from "@/components/detail/ImageryCaption";
import LyricsFolio from "@/components/detail/LyricsFolio";
import RelatedWorks from "@/components/detail/RelatedWorks";
import ScoreSection from "@/components/detail/ScoreSection";
import {
  jumpTo,
  type NavItem,
  ReadingProgress,
  useActiveSection,
} from "@/components/detail/SectionNav";
import SongColophon from "@/components/detail/SongColophon";
import SongHero from "@/components/detail/SongHero";
import FavoriteButton from "@/components/shared/FavoriteButton";
import FloatingActionButtons from "@/components/shared/FloatingActionButtons";
import ImageModal from "@/components/shared/ImageModal";
import TopBar, { type TopBarAction } from "@/components/shared/topbar/TopBar";
import { PlaceNav } from "@/components/shared/topbar/parts";
import { useUserContext } from "@/context/UserContext";
import { useScrollTop } from "@/hooks/ui/useScrollTop";
import type { SongDetailClientProps, SongImageryMark } from "@/lib/types";
import { buildFolio, markLines, parseNotes } from "@/lib/utils/utils-folio";
import { getCoverUrl, getNmnUrl } from "@/lib/utils/utils-song";
import {
  type CoverTone,
  NEUTRAL_TONE,
  toneFromImage,
} from "@/lib/utils/utils-tone";
import { Share2 } from "lucide-react";
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
  excerpt,
}) => {
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
  // 窄屏放不下歌名：卷首时显示「目录」，滚过题名后显示当前章节
  const activeLabel = tocItems.find((i) => i.id === activeSection)?.label;
  const topBarActions = useMemo<TopBarAction[]>(
    () => [
      {
        key: "share",
        icon: Share2,
        label: tNav("share"),
        onClick: handleShare,
      },
    ],
    [tNav, handleShare],
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
        className="pointer-events-none absolute inset-x-0 top-0 h-225 transition-opacity duration-1400 ease-out"
        style={{
          opacity: tone ? 1 : 0,
          background: `radial-gradient(ellipse 70% 55% at 18% 0%, ${appliedTone.wash}, transparent 70%), radial-gradient(ellipse 50% 40% at 95% 10%, ${appliedTone.wash}, transparent 70%)`,
        }}
      />

      <TopBar
        exit={{ kind: "back" }}
        nav={
          <PlaceNav
            title={song.title}
            label={titleOutOfView && activeLabel ? activeLabel : t("folio.toc")}
            items={tocItems}
            active={activeSection}
            onSelect={(id) => jumpTo(tocItems, id)}
            menuTitle={t("folio.toc")}
          />
        }
        pinned={<FavoriteButton songId={song.id} />}
        actions={topBarActions}
      >
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
      </TopBar>

      <CommentsProvider
        songId={song.id}
        anchorCtx={anchorCtx}
        onSheetOpen={closeCaption}
      >
        <main className="relative pt-32 md:pt-40 pb-32 max-w-6xl mx-auto px-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
          {song.dispute_note && <DisputeNotice note={song.dispute_note} />}

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
                title: t("coverTitle", { title: song.title }),
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
                  alt: t("scoreTitle", { title: song.title }),
                  title: t("scoreTitle", { title: song.title }),
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
    </div>
  );
};

export default SongDetailClient;
