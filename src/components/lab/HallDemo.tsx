"use client";

import { FIELD_LABEL_CLASS } from "@/components/shared/form-field";
import { TEXT_BUTTON_CLASS } from "@/components/shared/text-button";
import TopBar from "@/components/shared/topbar/TopBar";
import { Link } from "@/i18n/navigation";
import type { Song } from "@/lib/types";
import { cn } from "@/lib/utils/utils";
import { getCoverUrl } from "@/lib/utils/utils-song";
import {
  type CoverTone,
  INK_TONE,
  toneFromImage,
} from "@/lib/utils/utils-tone";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import Image from "next/image";
import type React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import css from "./hall.module.css";
import { densityOf, hangRoom, type Placement } from "./hall-layout";

export interface HallRoom {
  year: number;
  songs: Song[];
  featuredId: number | null;
  /** 这一年最常写到的意象 */
  signature: number[];
}

export interface HallImagery {
  id: number;
  name: string;
  /** 写到它的作品数 */
  count: number;
  accent: string;
}

interface HallDemoProps {
  rooms: HallRoom[];
  total: number;
  lyrics: Record<number, string>;
  songImagery: Record<number, number[]>;
  imagery: HallImagery[];
}

const EASE = [0.23, 1, 0.32, 1] as const;
/** 打灯面板里列出的意象数 */
const SEA_SIZE = 40;

interface Hover {
  id: number;
  title: string;
  tone: CoverTone | null;
}

export default function HallDemo({
  rooms,
  total,
  lyrics,
  songImagery,
  imagery,
}: HallDemoProps) {
  const [query, setQuery] = useState("");
  const [lamps, setLamps] = useState<number[]>([]);
  const [seekOpen, setSeekOpen] = useState(false);
  const [year, setYear] = useState<number | null>(null);
  const [dir, setDir] = useState<1 | -1>(1);
  const [hover, setHover] = useState<Hover | null>(null);
  const [focusedId, setFocusedId] = useState<number | null>(null);
  const [toneByYear, setToneByYear] = useState<Record<number, CoverTone>>({});

  const imageryById = useMemo(
    () => new Map(imagery.map((i) => [i.id, i])),
    [imagery],
  );
  const allSongs = useMemo(() => rooms.flatMap((r) => r.songs), [rooms]);

  // ── 打灯：搜的词与点亮的意象，命中的亮着，其余暗下去 ──────────────────
  const q = query.trim().toLowerCase();
  const lampOn = q.length > 0 || lamps.length > 0;
  const lit = useMemo(() => {
    if (!lampOn) return null;
    const set = new Set<number>();
    for (const song of allSongs) {
      const hay = [
        song.title,
        song.album,
        ...(song.artist ?? []),
        ...(song.lyricist ?? []),
        ...(song.composer ?? []),
        ...(song.arranger ?? []),
        ...(song.creditAliases ?? []),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      const textOk =
        !q ||
        hay.includes(q) ||
        (lyrics[song.id] ?? "").toLowerCase().includes(q);
      // 灯是加法：点的意象越多，照亮的作品越多
      const lampOk =
        lamps.length === 0 ||
        (songImagery[song.id] ?? []).some((id) => lamps.includes(id));
      if (textOk && lampOk) set.add(song.id);
    }
    return set;
  }, [lampOn, allSongs, q, lyrics, lamps, songImagery]);

  const litByYear = useMemo(
    () =>
      rooms.map((r) => ({
        year: r.year,
        count: lit ? r.songs.filter((s) => lit.has(s.id)).length : 0,
      })),
    [rooms, lit],
  );

  const toggleLamp = useCallback((id: number) => {
    setLamps((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }, []);
  const putOut = useCallback(() => {
    setQuery("");
    setLamps([]);
  }, []);

  // ── 此刻在哪一年：视口中线落在哪间展室 ───────────────────────────────
  const roomEls = useRef(new Map<number, HTMLElement>());
  const mastheadRef = useRef<HTMLElement>(null);
  const yearRef = useRef<number | null>(null);
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const raw = (entry.target as HTMLElement).dataset.year;
          const next = raw ? Number(raw) : null;
          const prev = yearRef.current;
          if (next === prev) continue;
          // 往下滚是往从前走：新的数字从下面翻上来
          setDir(prev === null || (next !== null && next < prev) ? 1 : -1);
          yearRef.current = next;
          setYear(next);
        }
      },
      { rootMargin: "-50% 0px -50% 0px" },
    );
    roomEls.current.forEach((el) => observer.observe(el));
    if (mastheadRef.current) observer.observe(mastheadRef.current);
    return () => observer.disconnect();
  }, []);

  const scrollToYear = (y: number) => {
    roomEls.current.get(y)?.scrollIntoView({ behavior: "smooth" });
  };

  // ── 颜色：当年主作的颜色铺满整页；走近哪幅就换成哪幅的 ─────────────────
  const tone =
    hover?.tone ?? (year !== null ? toneByYear[year] : undefined) ?? INK_TONE;
  const onFeaturedLoad = useCallback((y: number, img: HTMLImageElement) => {
    const t = toneFromImage(img);
    if (t) setToneByYear((prev) => ({ ...prev, [y]: t }));
  }, []);

  const onHover = useCallback(
    (song: Song | null, img?: HTMLImageElement | null) => {
      if (!song) {
        setHover(null);
        return;
      }
      setHover({
        id: song.id,
        title: song.title,
        tone: img ? toneFromImage(img) : null,
      });
    },
    [],
  );

  const roomOfFocused = focusedId
    ? rooms.find((r) => r.songs.some((s) => s.id === focusedId))?.year
    : undefined;

  return (
    <div
      className={cn(
        // 画身后的光与影会伸出版心，横向裁掉，免得窄屏出现横向滚动
        "relative min-h-screen overflow-x-clip bg-[#FAFAFA] dark:bg-[#0B0F19]",
        "[--tone:var(--tone-light)] dark:[--tone:var(--tone-dark)]",
        // 打灯时作品身后那圈光：浅色是暖白，深色取当前的强调色
        "[--pool:rgba(255,250,238,0.95)] dark:[--pool:color-mix(in_oklab,var(--tone)_26%,transparent)]",
      )}
      style={
        {
          "--tone-light": tone.light,
          "--tone-dark": tone.dark,
        } as React.CSSProperties
      }
      onPointerLeave={() => setHover(null)}
    >
      {/* 整页铺一层当年的颜色，换年时缓缓转过去 */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 opacity-45 transition-[background-color] duration-1400 ease-out"
        style={{ backgroundColor: tone.wash }}
      />
      {/* 打灯：展厅的大灯暗下来 */}
      <div
        aria-hidden
        className={cn(
          "pointer-events-none fixed inset-0 bg-slate-900/[0.05] transition-opacity duration-1000 dark:bg-black/45",
          lampOn ? "opacity-100" : "opacity-0",
        )}
      />

      <TopBar
        exit={{ kind: "logo" }}
        pinned={
          <button
            type="button"
            onClick={() => setSeekOpen(!seekOpen)}
            aria-expanded={seekOpen}
            aria-label="寻"
            title="寻"
            className={cn(
              "inline-flex size-10 items-center justify-center font-calligraphy text-2xl leading-none transition-colors",
              seekOpen || lampOn
                ? "text-(--tone)"
                : "text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white",
            )}
          >
            寻
          </button>
        }
      >
        <SeekPanel
          open={seekOpen}
          onClose={() => setSeekOpen(false)}
          query={query}
          setQuery={setQuery}
          lamps={lamps}
          toggleLamp={toggleLamp}
          imagery={imagery}
          lampOn={lampOn}
          litCount={lit?.size ?? 0}
          litByYear={litByYear}
          onYear={(y) => {
            setSeekOpen(false);
            scrollToYear(y);
          }}
          onPutOut={putOut}
        />
        {!seekOpen && lampOn && (
          <LampStrip
            query={query.trim()}
            lamps={lamps.map((id) => imageryById.get(id)).filter((i) => !!i)}
            litCount={lit?.size ?? 0}
            litByYear={litByYear}
            onYear={scrollToYear}
            onToggle={toggleLamp}
            onOpen={() => setSeekOpen(true)}
            onPutOut={putOut}
          />
        )}
      </TopBar>

      <main className="relative z-10">
        {/* 年份大字：铺在作品后面，跟着人走；走近一幅时换成它的题名 */}
        <div aria-hidden className="pointer-events-none sticky top-0 z-0 h-0">
          <div className="absolute inset-x-0 top-0 h-svh overflow-hidden">
            <div className="absolute left-4 top-[calc(var(--nav-h)+3vh)] sm:left-8 md:left-14">
              <AnimatePresence mode="popLayout" initial={false}>
                {hover && !lampOn ? (
                  <motion.p
                    key={`t-${hover.id}`}
                    className="font-serif font-semibold leading-none tracking-tight text-(--tone)/15 whitespace-nowrap"
                    style={{
                      fontSize: `min(clamp(6rem, 19vw, 18rem), calc(90vw / ${Math.max(Array.from(hover.title).length, 1)}))`,
                    }}
                    initial={{ opacity: 0, y: 24 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -12 }}
                    transition={{ duration: 0.6, ease: EASE }}
                  >
                    {hover.title}
                  </motion.p>
                ) : year !== null ? (
                  <motion.div
                    key="year"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.6, ease: EASE }}
                  >
                    <p className="font-serif text-[clamp(6rem,19vw,18rem)] font-semibold leading-none tracking-tight tabular-nums text-(--tone)/15 transition-colors duration-1000">
                      <FlipDigits value={String(year)} dir={dir} />
                    </p>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>
          </div>
        </div>

        <Masthead
          ref={mastheadRef}
          total={total}
          onSeek={() => setSeekOpen(true)}
        />

        {rooms.map((room, ri) => (
          <RoomSection
            key={room.year}
            room={room}
            seed={ri}
            lit={lit}
            lamps={lamps}
            imageryById={imageryById}
            songImagery={songImagery}
            focusedId={roomOfFocused === room.year ? focusedId : null}
            setRef={(el) => {
              if (el) roomEls.current.set(room.year, el);
              else roomEls.current.delete(room.year);
            }}
            onFeaturedLoad={onFeaturedLoad}
            onHover={onHover}
            onFocus={(song, img) => {
              setFocusedId(song.id);
              onHover(song, img);
            }}
          />
        ))}

        <p className="mx-auto max-w-[90rem] px-6 pb-24 pt-10 text-center font-kaiti text-sm text-slate-400 md:px-16 dark:text-slate-500">
          原型只挂了三间展室 · 2020、2016、2012
        </p>
      </main>
    </div>
  );
}

/** 年份逐位翻动：只有变了的那一位动，左边的先动 */
function FlipDigits({ value, dir }: { value: string; dir: 1 | -1 }) {
  return (
    <span className="inline-flex">
      {Array.from(value).map((digit, i) => (
        <span key={i} className="inline-grid overflow-hidden pb-[0.06em]">
          <AnimatePresence initial={false} custom={dir}>
            <motion.span
              key={digit}
              custom={dir}
              className="[grid-area:1/1]"
              variants={{
                enter: (d: number) => ({ y: d > 0 ? "100%" : "-100%" }),
                center: { y: "0%" },
                exit: (d: number) => ({ y: d > 0 ? "-100%" : "100%" }),
              }}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 1.1, ease: EASE, delay: i * 0.08 }}
            >
              {digit}
            </motion.span>
          </AnimatePresence>
        </span>
      ))}
    </span>
  );
}

function Masthead({
  ref,
  total,
  onSeek,
}: {
  ref: React.Ref<HTMLElement>;
  total: number;
  onSeek: () => void;
}) {
  return (
    <section
      ref={ref}
      className="relative mx-auto flex min-h-[86svh] max-w-[90rem] flex-col justify-end px-6 pb-[14vh] pt-(--nav-h) md:px-16"
    >
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1.2, ease: EASE, delay: 0.2 }}
        className="md:ml-[calc(100%/12*5)]"
      >
        <p className="text-xs tracking-[0.35em] text-(--tone) transition-colors duration-1000">
          河图作品勘鉴 · 凡 {total} 首
        </p>
        <h1 className="mt-6 font-serif text-[clamp(4.5rem,11vw,9.5rem)] font-semibold leading-none tracking-tight text-slate-900 dark:text-slate-50">
          谣歌
        </h1>
        <p className="mt-8 font-kaiti text-lg leading-relaxed text-slate-600 md:text-xl dark:text-slate-400">
          你一定想知道，戏里讲了什么故事……
        </p>
        <div className="mt-14 flex flex-wrap items-baseline gap-x-10 gap-y-4">
          <button
            type="button"
            onClick={onSeek}
            className="group inline-flex items-baseline gap-3 text-left"
          >
            <span className="font-calligraphy text-2xl leading-none text-(--tone)">
              寻
            </span>
            <span className="font-kaiti text-[15px] text-slate-500 transition-colors group-hover:text-slate-800 dark:text-slate-400 dark:group-hover:text-slate-200">
              为想看的作品打一盏灯
            </span>
          </button>
          <span className="flex items-baseline gap-6 text-xs tracking-[0.3em] text-slate-400 dark:text-slate-500">
            别卷
            <Link
              href="/story/qjtx"
              className="font-serif text-[15px] tracking-wider text-slate-700 transition-colors hover:text-(--tone) dark:text-slate-300"
            >
              倾尽天下
            </Link>
            <Link
              href="/imagery"
              className="font-serif text-[15px] tracking-wider text-slate-700 transition-colors hover:text-(--tone) dark:text-slate-300"
            >
              意象
            </Link>
          </span>
        </div>
      </motion.div>
    </section>
  );
}

function RoomSection({
  room,
  seed,
  lit,
  lamps,
  imageryById,
  songImagery,
  focusedId,
  setRef,
  onFeaturedLoad,
  onHover,
  onFocus,
}: {
  room: HallRoom;
  seed: number;
  lit: Set<number> | null;
  lamps: number[];
  imageryById: Map<number, HallImagery>;
  songImagery: Record<number, number[]>;
  focusedId: number | null;
  setRef: (el: HTMLElement | null) => void;
  onFeaturedLoad: (year: number, img: HTMLImageElement) => void;
  onHover: (song: Song | null, img?: HTMLImageElement | null) => void;
  onFocus: (song: Song, img: HTMLImageElement | null) => void;
}) {
  const density = densityOf(room.songs.length);
  const featuredIndex = room.songs.findIndex((s) => s.id === room.featuredId);
  const rows = useMemo(
    () => hangRoom(room.songs.length, featuredIndex, seed),
    [room.songs.length, featuredIndex, seed],
  );
  const signature = room.signature
    .map((id) => imageryById.get(id)?.name)
    .filter(Boolean);

  return (
    <section
      ref={setRef}
      data-year={room.year}
      data-focus={focusedId ? "" : undefined}
      className={cn(
        css.room,
        "relative mx-auto max-w-[90rem] scroll-mt-(--nav-h) px-6 md:px-16",
        // 安静的年份：墙上大片空着
        density === "sparse"
          ? "flex min-h-[150svh] flex-col justify-center py-[20vh]"
          : "pb-[16vh] pt-[34vh]",
      )}
    >
      <h2 className="sr-only">{room.year}</h2>
      {/* 展签：首数与这一年的意象，写在大字下面一点 */}
      <p className="mb-16 flex items-baseline gap-5 md:mb-24 md:ml-[calc(100%/12*7)]">
        <span className="text-xs tracking-[0.3em] text-slate-400 tabular-nums dark:text-slate-500">
          {room.year} · {room.songs.length} 首
        </span>
        {signature.length > 0 && (
          <span className="flex gap-3 font-calligraphy text-xl leading-none text-(--tone) transition-colors duration-1000">
            {signature.map((name) => (
              <span key={name}>{name}</span>
            ))}
          </span>
        )}
      </p>

      <div
        className={cn(
          "grid grid-cols-6 gap-x-4 md:block",
          density === "dense" ? "gap-y-10" : "gap-y-14",
        )}
      >
        {rows.map((row, ri) => (
          <div
            key={ri}
            className={cn(
              "contents md:grid md:grid-cols-12 md:items-start md:gap-x-6",
              ri > 0 && (density === "dense" ? "md:mt-16" : "md:mt-24"),
            )}
          >
            {row.map(({ index, place }) => {
              const song = room.songs[index];
              const lamped = (songImagery[song.id] ?? [])
                .filter((id) => lamps.includes(id))
                .map((id) => imageryById.get(id))
                .filter((i) => !!i);
              return (
                <Work
                  key={song.id}
                  song={song}
                  place={place}
                  lit={lit ? lit.has(song.id) : null}
                  lamped={lit?.has(song.id) ? lamped : []}
                  marks={
                    place.featured
                      ? (songImagery[song.id] ?? [])
                          .map((id) => imageryById.get(id))
                          .filter((i) => !!i)
                          .sort((a, b) => a.count - b.count)
                          .slice(0, 3)
                      : []
                  }
                  focused={focusedId === song.id}
                  onLoadTone={
                    song.id === room.featuredId
                      ? (img) => onFeaturedLoad(room.year, img)
                      : undefined
                  }
                  onHover={onHover}
                  onFocus={onFocus}
                />
              );
            })}
          </div>
        ))}
      </div>
    </section>
  );
}

function Work({
  song,
  place,
  lit,
  lamped,
  marks,
  focused,
  onLoadTone,
  onHover,
  onFocus,
}: {
  song: Song;
  place: Placement;
  lit: boolean | null;
  /** 照亮它的那几盏灯 */
  lamped: HallImagery[];
  /** 主作下面写几个意象 */
  marks: HallImagery[];
  focused: boolean;
  onLoadTone?: (img: HTMLImageElement) => void;
  onHover: (song: Song | null, img?: HTMLImageElement | null) => void;
  onFocus: (song: Song, img: HTMLImageElement | null) => void;
}) {
  const pointerType = useRef("mouse");
  const hasCover = song.hascover === true;
  const meta = [song.artist?.join(" / "), song.type?.[0]]
    .filter(Boolean)
    .join(" · ");
  const big = place.featured;

  return (
    <figure
      data-lit={lit === null ? undefined : String(lit)}
      data-focused={focused ? "" : undefined}
      className={cn(
        css.work,
        "relative min-w-0 [grid-column:var(--mc)] mt-(--mo) md:[grid-column:var(--c)] md:mt-(--o)",
      )}
      style={
        {
          "--c": `${place.c} / span ${place.s}`,
          "--o": `${place.o}rem`,
          "--mc": `${place.mc} / span ${place.ms}`,
          "--mo": `${place.mo}rem`,
        } as React.CSSProperties
      }
    >
      <Link
        href={`/song/${song.id}`}
        className="group block outline-none"
        onPointerDown={(e) => (pointerType.current = e.pointerType)}
        onPointerEnter={(e) => {
          if (e.pointerType === "mouse")
            onHover(song, e.currentTarget.querySelector("img"));
        }}
        onClick={(e) => {
          // 窄屏：第一下聚焦，第二下才进去
          if (pointerType.current !== "mouse" && !focused) {
            e.preventDefault();
            onFocus(song, e.currentTarget.querySelector("img"));
          }
        }}
      >
        <div className={cn(big && css.featured)}>
          <div className={cn(css.reveal, "relative")}>
            {/* 打灯时身后的一圈光 */}
            <div
              aria-hidden
              className={cn(
                css.pool,
                "pointer-events-none absolute -inset-[28%]",
              )}
              style={{
                background:
                  "radial-gradient(closest-side, var(--pool), transparent)",
              }}
            />
            {/* 挂画的影子：光从上面来，影子落在画的下方 */}
            <div
              aria-hidden
              className={cn(
                "absolute inset-0 rounded-[3px] shadow-[0_30px_50px_-28px_rgba(15,23,42,0.55)] transition-shadow duration-1000 group-hover:shadow-[0_40px_60px_-28px_rgba(15,23,42,0.6)] dark:shadow-[0_30px_50px_-20px_rgba(0,0,0,0.9)]",
              )}
            />
            <div
              className={cn(
                "relative aspect-square overflow-hidden rounded-[3px] ring-1 ring-slate-900/5 group-focus-visible:ring-2 group-focus-visible:ring-(--tone) dark:ring-white/10",
                hasCover
                  ? "bg-slate-200 dark:bg-slate-800"
                  : "bg-[#f1eee8] dark:bg-[#131a2a]",
              )}
            >
              {hasCover ? (
                <div
                  className={cn(
                    css.drift,
                    "absolute inset-x-0 -top-[7%] h-[114%]",
                  )}
                >
                  <Image
                    src={getCoverUrl(song)}
                    alt={song.title}
                    fill
                    sizes={
                      big
                        ? "(min-width: 768px) 45vw, 95vw"
                        : "(min-width: 768px) 25vw, 60vw"
                    }
                    onLoad={
                      onLoadTone
                        ? (e) => onLoadTone(e.currentTarget)
                        : undefined
                    }
                    className="object-cover saturate-[.85] transition-[scale,filter] duration-1000 ease-page group-hover:scale-[1.03] group-hover:saturate-100"
                  />
                </div>
              ) : (
                // 没有封面：一张素笺，题名竖排
                <span className="absolute inset-0 flex justify-center pt-[14%]">
                  <span
                    className={cn(
                      "font-serif tracking-[0.3em] text-slate-500 [writing-mode:vertical-rl] dark:text-slate-400",
                      big ? "text-2xl" : "text-sm md:text-base",
                    )}
                  >
                    {song.title}
                  </span>
                </span>
              )}
            </div>
          </div>
        </div>

        <figcaption className={big ? "mt-6" : "mt-4"}>
          <p
            className={cn(
              "flex min-w-0 items-baseline gap-3 font-serif transition-colors duration-700",
              big
                ? "text-lg text-slate-900 dark:text-slate-50"
                : "text-[13px] text-slate-600 group-hover:text-slate-900 md:text-sm dark:text-slate-400 dark:group-hover:text-slate-50",
            )}
          >
            <span className="truncate">{song.title}</span>
            {lamped.length > 0 && (
              <span className="flex shrink-0 gap-2 font-calligraphy text-base leading-none">
                {lamped.map((l) => (
                  <span key={l.id} style={{ color: l.accent }}>
                    {l.name}
                  </span>
                ))}
              </span>
            )}
          </p>
          {meta && (
            <p
              className={cn(
                "mt-1 truncate text-[11px] tracking-wider text-slate-400 transition-[opacity,translate] duration-700 ease-page dark:text-slate-500",
                !big &&
                  "-translate-y-0.5 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:opacity-100",
                focused && "translate-y-0 opacity-100",
              )}
            >
              {meta}
            </p>
          )}
          {marks.length > 0 && (
            <p className="mt-4 flex gap-4 font-calligraphy text-xl leading-none text-slate-500 dark:text-slate-400">
              {marks.map((m) => (
                <span key={m.id}>{m.name}</span>
              ))}
            </p>
          )}
        </figcaption>
      </Link>
    </figure>
  );
}

// ── 打灯 ──────────────────────────────────────────────────────────────────

function LitSummary({
  litCount,
  litByYear,
  onYear,
}: {
  litCount: number;
  litByYear: { year: number; count: number }[];
  onYear: (year: number) => void;
}) {
  return (
    <>
      <span className="tabular-nums text-(--tone)">亮 {litCount} 首</span>
      {litByYear
        .filter((y) => y.count > 0)
        .map((y) => (
          <button
            key={y.year}
            type="button"
            onClick={() => onYear(y.year)}
            className="tabular-nums transition-colors hover:text-slate-800 dark:hover:text-slate-200"
          >
            {y.year} · {y.count}
          </button>
        ))}
    </>
  );
}

function SeekPanel({
  open,
  onClose,
  query,
  setQuery,
  lamps,
  toggleLamp,
  imagery,
  lampOn,
  litCount,
  litByYear,
  onYear,
  onPutOut,
}: {
  open: boolean;
  onClose: () => void;
  query: string;
  setQuery: (q: string) => void;
  lamps: number[];
  toggleLamp: (id: number) => void;
  imagery: HallImagery[];
  lampOn: boolean;
  litCount: number;
  litByYear: { year: number; count: number }[];
  onYear: (year: number) => void;
  onPutOut: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => inputRef.current?.focus(), 250);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  // 已点亮的总在最前；其余按写到的作品数
  const sea = useMemo(() => {
    const top = imagery.slice(0, SEA_SIZE);
    const pinned = imagery.filter(
      (i) => lamps.includes(i.id) && !top.some((t) => t.id === i.id),
    );
    return [...pinned, ...top];
  }, [imagery, lamps]);
  const max = imagery[0]?.count ?? 1;

  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.div
          key="seek"
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.45, ease: EASE }}
          className="overflow-hidden"
        >
          <div className="thin-scrollbar max-h-[calc(100dvh-var(--nav-h)-2rem)] overflow-y-auto overscroll-contain border-t border-slate-200/50 dark:border-slate-800/50">
            <div className="mx-auto max-w-[90rem] px-6 pb-10 pt-8 md:px-16 md:pt-10">
              <div className="flex items-end gap-6">
                <label className="min-w-0 flex-1 border-b border-slate-300 transition-colors focus-within:border-(--tone) dark:border-slate-700">
                  <span className="sr-only">寻</span>
                  <input
                    ref={inputRef}
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="寻一首歌、一个名字、一句词"
                    className="w-full bg-transparent pb-3 font-serif text-2xl text-slate-900 outline-none placeholder:text-slate-300 md:text-4xl dark:text-slate-50 dark:placeholder:text-slate-600 [&::-webkit-search-cancel-button]:hidden"
                  />
                </label>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="收起"
                  className="mb-3 shrink-0 p-1 text-slate-400 transition-colors hover:text-slate-700 dark:hover:text-slate-200"
                >
                  <X size={20} />
                </button>
              </div>

              <p className="mt-4 flex min-h-5 flex-wrap items-baseline gap-x-4 gap-y-2 text-xs tracking-[0.2em] text-slate-400 dark:text-slate-500">
                {lampOn ? (
                  <>
                    <LitSummary
                      litCount={litCount}
                      litByYear={litByYear}
                      onYear={onYear}
                    />
                    <span aria-hidden>·</span>
                    <button
                      type="button"
                      onClick={onPutOut}
                      className={TEXT_BUTTON_CLASS}
                    >
                      熄灯
                    </button>
                  </>
                ) : (
                  <span className="font-kaiti text-sm tracking-normal">
                    写一个词，或者点亮几个意象：照到的作品留在原处亮着，其余的暗下去
                  </span>
                )}
              </p>

              <h3 className={cn(FIELD_LABEL_CLASS, "mt-10")}>意象</h3>
              <div className="mt-5 flex flex-wrap items-baseline gap-x-5 gap-y-3 md:gap-x-7">
                {sea.map((item) => {
                  const on = lamps.includes(item.id);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => toggleLamp(item.id)}
                      aria-pressed={on}
                      title={`${item.name} · ${item.count}`}
                      className={cn(
                        "font-calligraphy leading-none transition-colors duration-300",
                        !on &&
                          "text-slate-400 hover:text-slate-800 dark:text-slate-500 dark:hover:text-slate-200",
                      )}
                      style={{
                        fontSize: `${1.05 + 1.5 * Math.sqrt(item.count / max)}rem`,
                        color: on ? item.accent : undefined,
                      }}
                    >
                      {item.name}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** 面板收起后，点着的灯留在顶栏下沿 */
function LampStrip({
  query,
  lamps,
  litCount,
  litByYear,
  onYear,
  onToggle,
  onOpen,
  onPutOut,
}: {
  query: string;
  lamps: HallImagery[];
  litCount: number;
  litByYear: { year: number; count: number }[];
  onYear: (year: number) => void;
  onToggle: (id: number) => void;
  onOpen: () => void;
  onPutOut: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: EASE }}
      className="border-t border-slate-200/50 dark:border-slate-800/50"
    >
      <div className="no-scrollbar mx-auto flex h-11 max-w-[90rem] items-center gap-x-4 overflow-x-auto whitespace-nowrap px-6 text-xs tracking-[0.2em] text-slate-400 md:px-16 dark:text-slate-500">
        <button
          type="button"
          onClick={onOpen}
          className="flex items-baseline gap-3 text-slate-700 dark:text-slate-200"
        >
          {query && (
            <span className="font-serif tracking-wider">「{query}」</span>
          )}
        </button>
        {lamps.map((l) => (
          <button
            key={l.id}
            type="button"
            onClick={() => onToggle(l.id)}
            title="熄掉这盏"
            className="font-calligraphy text-lg leading-none tracking-normal transition-opacity hover:opacity-60"
            style={{ color: l.accent }}
          >
            {l.name}
          </button>
        ))}
        <span aria-hidden>·</span>
        <LitSummary litCount={litCount} litByYear={litByYear} onYear={onYear} />
        <span aria-hidden>·</span>
        <button type="button" onClick={onPutOut} className={TEXT_BUTTON_CLASS}>
          熄灯
        </button>
      </div>
    </motion.div>
  );
}
