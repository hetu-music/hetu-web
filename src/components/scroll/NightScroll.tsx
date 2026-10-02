"use client";

import SongPlayActions from "@/components/shared/SongPlayActions";
import TopBar from "@/components/shared/topbar/TopBar";
import { Link } from "@/i18n/navigation";
import type { LibraryImagery, LibraryImageryItem, Song } from "@/lib/types";
import { cn } from "@/lib/utils/utils";
import { bumpNavDepth } from "@/lib/utils/utils-nav";
import { getCoverUrl } from "@/lib/utils/utils-song";
import { INK_TONE } from "@/lib/utils/utils-tone";
import { useTranslations } from "next-intl";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { Camera, EngineWork, ScrollEngine } from "./engine";
import { BAND_HEIGHT, layoutScroll, yearAt } from "./layout";

/** 年份题字的字号（卷面单位） */
const INSCRIPTION_SIZE = 420;
/** 推近后的说明里最多列几个意象 */
const MARK_LIMIT = 6;

/**
 * 夜展长卷：全部作品挂在一卷横向铺开的夜色里，从右往左读。
 * 滚轮、拖动沿卷平移；点一幅，镜头推近，其余的画退进暗处；Esc 或点暗处退回远观。
 * 画面由 WebGL 画（engine.ts），题字与说明是 DOM，按镜头位置对齐。
 */
export default function NightScroll({
  songs,
  imagery,
}: {
  songs: Song[];
  imagery: LibraryImagery;
}) {
  const t = useTranslations("library");
  const tCommon = useTranslations("common");
  const tEnum = useTranslations("enums");

  const hostRef = useRef<HTMLDivElement>(null);
  const inscriptionRef = useRef<HTMLDivElement>(null);
  const hoverLabelRef = useRef<HTMLDivElement>(null);
  const yearRef = useRef<HTMLSpanElement>(null);
  const progressRef = useRef<HTMLSpanElement>(null);
  const engineRef = useRef<ScrollEngine | null>(null);

  const [hovered, setHovered] = useState<number | null>(null);
  const [focused, setFocused] = useState<number | null>(null);
  const [touched, setTouched] = useState(false);
  const [ready, setReady] = useState(false);

  const songById = useMemo(() => new Map(songs.map((s) => [s.id, s])), [songs]);
  const imageryById = useMemo(
    () => new Map(imagery.items.map((i) => [i.id, i])),
    [imagery.items],
  );
  const layout = useMemo(
    () =>
      layoutScroll(
        songs.map((s) => ({
          id: s.id,
          year: s.year ?? null,
          hasCover: s.hascover === true,
          weight: imagery.bySong[s.id]?.length ?? 0,
        })),
      ),
    [songs, imagery.bySong],
  );
  const placementById = useMemo(
    () => new Map(layout.placements.map((p) => [p.id, p])),
    [layout],
  );

  // 镜头每动一帧：题字层跟着平移缩放，悬停题名贴到那幅画下，左下角写当前年份
  // 每帧都要读到最新的悬停，记在 ref 里（由 onHover 同时写入）
  const hoveredRef = useRef<number | null>(null);
  const lastYear = useRef<string>("");
  const onFrame = useCallback(
    (cam: Camera, view: { width: number; height: number }) => {
      const tx = view.width / 2 - cam.x * cam.zoom;
      const ty = view.height / 2 - cam.y * cam.zoom;
      if (inscriptionRef.current) {
        inscriptionRef.current.style.transform = `translate(${tx}px, ${ty}px) scale(${cam.zoom})`;
      }
      const label = hoverLabelRef.current;
      const id = hoveredRef.current;
      const p = id !== null ? placementById.get(id) : undefined;
      if (label && p) {
        label.style.transform = `translate(${tx + (p.x + p.size / 2) * cam.zoom}px, ${ty + (p.y + p.size) * cam.zoom + 14}px) translateX(-50%)`;
      }
      const span = yearAt(layout, cam.x);
      const text = span?.year ? String(span.year) : tCommon("unknown");
      if (yearRef.current && text !== lastYear.current) {
        yearRef.current.textContent = text;
        lastYear.current = text;
      }
      if (progressRef.current) {
        const ratio = Math.min(1, Math.max(0, cam.x / layout.width));
        progressRef.current.style.transform = `scaleX(${ratio})`;
      }
    },
    [layout, placementById, tCommon],
  );

  // 挂上 WebGL 画面
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let cancelled = false;
    let engine: ScrollEngine | null = null;

    const works = new Map<number, EngineWork>(
      songs.map((s) => [
        s.id,
        {
          id: s.id,
          title: s.title,
          coverUrl: s.hascover === true ? getCoverUrl(s) : null,
        },
      ]),
    );
    // 素笺上的题名用站内的衬线体
    const probe = document.createElement("span");
    probe.className = "font-serif";
    document.body.appendChild(probe);
    const serifFont = getComputedStyle(probe).fontFamily;
    probe.remove();

    void import("./engine").then(async ({ createScrollEngine }) => {
      if (cancelled) return;
      engine = await createScrollEngine(
        host,
        layout,
        works,
        {
          onHover: (id) => {
            hoveredRef.current = id;
            setHovered(id);
          },
          onFocus: setFocused,
          onFrame,
          onInteract: () => setTouched(true),
        },
        { serifFont },
      );
      if (cancelled) {
        engine.destroy();
        return;
      }
      engineRef.current = engine;
      setReady(true);
    });

    return () => {
      cancelled = true;
      engine?.destroy();
      engineRef.current = null;
    };
    // 画面只建一次；onFrame 用 ref 取最新的悬停
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout]);

  const focusedSong = focused !== null ? songById.get(focused) : undefined;
  const hoveredSong =
    hovered !== null && focused === null ? songById.get(hovered) : undefined;

  return (
    <div
      // 底色与顶栏的深色一致，免得顶栏下沿出现一道色差；四周再由暗角压深
      className="dark fixed inset-0 overflow-hidden bg-[#0B0F19] text-slate-200 select-none [--tone:var(--tone-dark)]"
      style={{ "--tone-dark": INK_TONE.dark } as React.CSSProperties}
    >
      <TopBar exit={{ kind: "logo" }} />

      {/* 卷上的字：引首题名与年份题字，随镜头移动；推近时退淡 */}
      <div
        ref={inscriptionRef}
        aria-hidden
        className={cn(
          "pointer-events-none absolute left-0 top-0 origin-top-left transition-opacity duration-1000",
          // 镜头就位之前不显示，免得先闪一下没对齐的字
          !ready
            ? "opacity-0"
            : focused !== null
              ? "opacity-30"
              : "opacity-100",
        )}
      >
        {/* 镜头就位后才挂上，题名的入场动画才不会在看不见的时候就放完 */}
        {ready && (
          <Frontispiece
            from={layout.frontispiece.from}
            to={layout.frontispiece.to}
            count={songs.filter((s) => !s.dispute_note).length}
          />
        )}
        {layout.years.map((span) => (
          <span
            key={span.year ?? "unknown"}
            className="absolute whitespace-nowrap font-serif font-semibold tabular-nums leading-none text-white/[0.045]"
            style={{
              left: (span.from + span.to) / 2,
              top: BAND_HEIGHT / 2,
              fontSize: INSCRIPTION_SIZE,
              transform: "translate(-50%, -50%)",
              letterSpacing: "-0.02em",
            }}
          >
            {span.year ?? tCommon("unknown")}
          </span>
        ))}
      </div>

      {/* WebGL 画面 */}
      <div ref={hostRef} className="absolute inset-0" />

      {/* 四周压暗，像展厅的灯只照着中间 */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_45%,rgba(0,0,0,0.55)_100%)]"
      />

      {/* 悬停：画下浮出题名 */}
      <div
        ref={hoverLabelRef}
        aria-hidden
        className={cn(
          "pointer-events-none absolute left-0 top-0 whitespace-nowrap font-serif text-sm tracking-[0.2em] text-slate-200 transition-opacity duration-500",
          hoveredSong ? "opacity-100" : "opacity-0",
        )}
      >
        {hoveredSong?.title}
      </div>

      {/* 推近：说明 */}
      <NearCaption
        song={focusedSong}
        marks={
          focusedSong
            ? (imagery.bySong[focusedSong.id] ?? [])
                .map((id) => imageryById.get(id))
                .filter((i): i is LibraryImageryItem => !!i)
                .sort((a, b) => a.songCount - b.songCount || a.id - b.id)
                .slice(0, MARK_LIMIT)
            : []
        }
        typeLabel={(v) => (tEnum.has(`type.${v}`) ? tEnum(`type.${v}`) : v)}
        onStep={(d) => engineRef.current?.step(d)}
        onClose={() => engineRef.current?.unfocus()}
      />

      {/* 左下：此刻看到哪一年，与一道全卷的细线 */}
      <div
        className={cn(
          "pointer-events-none absolute bottom-8 left-6 md:left-10 flex items-end gap-5 transition-opacity duration-1000",
          ready && focused === null ? "opacity-100" : "opacity-0",
        )}
      >
        <span
          ref={yearRef}
          className="font-serif text-3xl tabular-nums text-slate-300"
        />
        <span className="mb-2 block h-px w-28 bg-white/10">
          <span
            ref={progressRef}
            className="block h-px w-full origin-left bg-(--tone)"
          />
        </span>
      </div>

      {/* 操作提示，动过一次就收起 */}
      <p
        className={cn(
          "pointer-events-none absolute bottom-24 md:bottom-8 inset-x-0 text-center text-xs tracking-[0.35em] text-slate-500 transition-opacity duration-1000",
          ready && !touched ? "opacity-100 delay-[2500ms]" : "opacity-0",
        )}
      >
        {t("scroll.hint")}
      </p>

      {/* 给读屏与搜索引擎的作品清单 */}
      <nav className="sr-only" aria-label={t("hero.title")}>
        <ul>
          {songs.map((s) => (
            <li key={s.id}>
              <Link href={`/song/${s.id}`}>{s.title}</Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}

/**
 * 引首：手卷开卷处写题名的一段。尺寸都是卷面单位，随镜头缩放。
 * 题名用刻本大字，右上一行眉题，左边竖排题词（读卷从右往左，题词在题名之后）。
 */
function Frontispiece({
  from,
  to,
  count,
}: {
  from: number;
  to: number;
  count: number;
}) {
  const t = useTranslations("library.hero");
  const motto = t("defaultDesc")
    .split(/[，,\s]+/)
    .filter(Boolean);
  const center = (from + to) / 2;
  return (
    <div
      className="absolute"
      style={{
        left: center,
        top: BAND_HEIGHT / 2,
        transform: "translate(-50%, -50%)",
      }}
    >
      <div className="relative flex items-center" style={{ gap: 110 }}>
        {/* 题词：竖排，逐列错落 */}
        <div
          className="flex flex-row-reverse items-start animate-in fade-in duration-[2000ms] fill-mode-both motion-reduce:animate-none"
          style={{ gap: 34, animationDelay: "1300ms" }}
        >
          {motto.map((col, i) => (
            <span
              key={i}
              className="font-calligraphy leading-none text-slate-300/70 [writing-mode:vertical-rl]"
              style={{
                fontSize: 58,
                letterSpacing: "0.35em",
                marginTop: i * 150,
              }}
            >
              {col}
            </span>
          ))}
        </div>
        <div>
          <p
            className="whitespace-nowrap text-(--tone) animate-in fade-in duration-[1600ms] fill-mode-both motion-reduce:animate-none"
            style={{
              fontSize: 30,
              letterSpacing: "0.4em",
              animationDelay: "700ms",
            }}
          >
            {t("eyebrow", { count })}
          </p>
          <h1
            className="whitespace-nowrap font-calligraphy leading-none text-slate-50 animate-in fade-in slide-in-from-bottom-4 duration-[1800ms] ease-page fill-mode-both motion-reduce:animate-none"
            style={{ fontSize: 520, marginTop: 40, animationDelay: "200ms" }}
          >
            {t("title")}
          </h1>
        </div>
      </div>
    </div>
  );
}

function NearCaption({
  song,
  marks,
  typeLabel,
  onStep,
  onClose,
}: {
  song: Song | undefined;
  marks: LibraryImageryItem[];
  typeLabel: (type: string) => string;
  onStep: (direction: -1 | 1) => void;
  onClose: () => void;
}) {
  const t = useTranslations("library");
  // 换下一幅时说明先淡出再淡入，内容跟着镜头到了才换
  const [shown, setShown] = useState<Song | undefined>(undefined);
  useEffect(() => {
    if (!song) return;
    const timer = setTimeout(() => setShown(song), 650);
    return () => clearTimeout(timer);
  }, [song]);
  // 镜头还在路上（或已退回远观）时，旧的说明先淡出
  const visible = !!song && shown === song;

  const credits = shown
    ? [
        shown.lyricist?.length &&
          `${t("catalog.lyricist")} ${shown.lyricist.join(" / ")}`,
        shown.composer?.length &&
          `${t("catalog.composer")} ${shown.composer.join(" / ")}`,
        shown.artist?.length && shown.artist.join(" / "),
      ].filter(Boolean)
    : [];
  const eyebrow = shown
    ? [shown.year, ...(shown.type ?? []).slice(0, 2).map(typeLabel)].filter(
        Boolean,
      )
    : [];

  return (
    <aside
      aria-hidden={!song}
      className={cn(
        "absolute z-10 transition-[opacity,translate] duration-700 ease-page",
        // 宽屏在右侧，窄屏在下方
        "inset-x-6 bottom-10 md:inset-x-auto md:bottom-auto md:left-[62%] md:right-10 md:top-1/2 md:-translate-y-1/2",
        visible && song
          ? "opacity-100 translate-x-0"
          : "pointer-events-none opacity-0 md:translate-x-3",
      )}
    >
      {shown && (
        <>
          <p className="text-xs tracking-[0.35em] text-(--tone)">
            {eyebrow.join(" · ")}
          </p>
          <h2 className="mt-4 font-serif text-4xl md:text-5xl xl:text-6xl font-semibold leading-[1.1] tracking-tight text-slate-50 text-balance">
            {shown.title}
          </h2>
          {credits.length > 0 && (
            <p className="mt-5 text-sm leading-relaxed text-slate-400">
              {credits.join("　")}
            </p>
          )}
          {marks.length > 0 && (
            <p className="mt-8 flex flex-wrap gap-x-5 gap-y-2 font-calligraphy text-2xl leading-none text-slate-300">
              {marks.map((m) => (
                <span key={m.id}>{m.name}</span>
              ))}
            </p>
          )}
          <div className="mt-10 flex items-center gap-6 text-xs tracking-widest">
            <Link
              href={`/song/${shown.id}`}
              onClick={bumpNavDepth}
              className="text-(--tone) hover:opacity-75 transition-opacity"
            >
              {t("wall.open")}
            </Link>
            <SongPlayActions song={shown} />
          </div>
          <div className="mt-8 flex items-center gap-4 text-xs tracking-widest text-slate-500">
            <button
              type="button"
              onClick={() => onStep(1)}
              className="hover:text-slate-200 transition-colors"
            >
              {t("scroll.newer")}
            </button>
            <span aria-hidden className="text-slate-700">
              ·
            </span>
            <button
              type="button"
              onClick={() => onStep(-1)}
              className="hover:text-slate-200 transition-colors"
            >
              {t("scroll.older")}
            </button>
            <span aria-hidden className="text-slate-700">
              ·
            </span>
            <button
              type="button"
              onClick={onClose}
              className="hover:text-slate-200 transition-colors"
            >
              {t("scroll.back")}
            </button>
          </div>
        </>
      )}
    </aside>
  );
}
