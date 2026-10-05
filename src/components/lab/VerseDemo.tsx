"use client";

import { FIELD_LABEL_CLASS } from "@/components/shared/form-field";
import { TEXT_BUTTON_CLASS } from "@/components/shared/text-button";
import TopBar from "@/components/shared/topbar/TopBar";
import { Link, useRouter } from "@/i18n/navigation";
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

export interface VerseLine {
  text: string;
  /** 这一句写到的意象 */
  imagery: number[];
}

export interface VerseSong {
  id: number;
  title: string;
  year: number | null;
  artist: string[];
  type: string | null;
  hascover: boolean;
  /** 去重后的逐句歌词 */
  lines: VerseLine[];
  /** 代表句在 lines 里的位置；没有词的歌为 -1 */
  rep: number;
}

export interface VerseRoom {
  year: number;
  songs: VerseSong[];
  featuredId: number | null;
}

export interface VerseImagery {
  id: number;
  name: string;
  accent: string;
  count: number;
}

const EASE = [0.23, 1, 0.32, 1] as const;
/** 竖排一列最多放几个字，超出的围绕命中处截一段 */
const COLUMN_CHARS = 16;
const SEA_SIZE = 36;
const RESULT_LIMIT = 6;

const CN_DIGITS = "〇一二三四五六七八九";
const cnCount = (n: number) => {
  if (n < 10) return CN_DIGITS[n];
  const tens = Math.floor(n / 10);
  const ones = n % 10;
  return `${tens === 1 ? "" : CN_DIGITS[tens]}十${ones ? CN_DIGITS[ones] : ""}`;
};

/** 墙上这一首显示哪一句、哪些字要点亮 */
interface Shown {
  text: string;
  marks: { word: string; color: string }[];
}

/** 把一句按要点亮的字切开 */
function segment(text: string, marks: Shown["marks"]) {
  const colors: (string | null)[] = Array.from(text, () => null);
  // 长的词先占位，免得「明月」被「月」拆开
  for (const { word, color } of [...marks].sort(
    (a, b) => b.word.length - a.word.length,
  )) {
    if (!word) continue;
    let from = 0;
    for (;;) {
      const at = text.indexOf(word, from);
      if (at < 0) break;
      for (let i = at; i < at + word.length; i++) colors[i] ??= color;
      from = at + word.length;
    }
  }
  const out: { s: string; color: string | null }[] = [];
  Array.from(text).forEach((ch, i) => {
    const last = out[out.length - 1];
    if (last && last.color === colors[i]) last.s += ch;
    else out.push({ s: ch, color: colors[i] });
  });
  return out;
}

/** 太长的一句：以第一个要点亮的字为中心截一段 */
function windowed(text: string, marks: Shown["marks"]): string {
  const chars = Array.from(text);
  if (chars.length <= COLUMN_CHARS) return text;
  const hit = marks
    .map((m) => text.indexOf(m.word))
    .filter((i) => i >= 0)
    .sort((a, b) => a - b)[0];
  const center = hit ?? 0;
  const start = Math.max(
    0,
    Math.min(center - 4, chars.length - COLUMN_CHARS + 1),
  );
  const piece = chars.slice(start, start + COLUMN_CHARS - 1).join("");
  return `${start > 0 ? "…" : ""}${piece}${start + COLUMN_CHARS - 1 < chars.length ? "…" : ""}`;
}

export default function VerseDemo({
  rooms,
  total,
  imagery,
}: {
  rooms: VerseRoom[];
  total: number;
  imagery: VerseImagery[];
}) {
  const [query, setQuery] = useState("");
  const [lamps, setLamps] = useState<number[]>([]);
  const [seekOpen, setSeekOpen] = useState(false);
  const [active, setActive] = useState<Record<number, number>>({});
  const [tone, setTone] = useState<CoverTone>(INK_TONE);

  const imageryById = useMemo(
    () => new Map(imagery.map((i) => [i.id, i])),
    [imagery],
  );
  const allSongs = useMemo(() => rooms.flatMap((r) => r.songs), [rooms]);

  // ── 搜与灯：命中的歌亮着，并把显示的那句换成命中的那句 ────────────────
  const q = query.trim().toLowerCase();
  const lampOn = q.length > 0 || lamps.length > 0;

  const view = useMemo(() => {
    const shown = new Map<number, Shown>();
    const lit = new Set<number>();
    for (const song of allSongs) {
      const rep = song.lines[song.rep]?.text ?? "";
      let text = rep;
      let marks: Shown["marks"] = [];
      let textOk = true;
      let lampOk = true;
      if (q) {
        const at = song.lines.findIndex((l) =>
          l.text.toLowerCase().includes(q),
        );
        const byName = [song.title, ...song.artist]
          .join(" ")
          .toLowerCase()
          .includes(q);
        textOk = at >= 0 || byName;
        if (at >= 0) {
          text = song.lines[at].text;
          marks = [{ word: query.trim(), color: "var(--tone)" }];
        }
      }
      if (lamps.length > 0) {
        const at = song.lines.findIndex((l) =>
          l.imagery.some((id) => lamps.includes(id)),
        );
        lampOk = at >= 0;
        if (at >= 0 && !(q && marks.length > 0)) {
          const line = song.lines[at];
          text = line.text;
          marks = line.imagery
            .filter((id) => lamps.includes(id))
            .map((id) => imageryById.get(id))
            .filter((i) => !!i)
            .map((i) => ({ word: i.name, color: i.accent }));
        }
      }
      if (lampOn && textOk && lampOk) lit.add(song.id);
      shown.set(song.id, { text: windowed(text, marks), marks });
    }
    return { shown, lit };
  }, [allSongs, q, query, lamps, lampOn, imageryById]);

  const litByYear = rooms.map((r) => ({
    year: r.year,
    count: r.songs.filter((s) => view.lit.has(s.id)).length,
  }));

  const toggleLamp = useCallback((id: number) => {
    setLamps((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }, []);
  const putOut = useCallback(() => {
    setQuery("");
    setLamps([]);
  }, []);

  const roomEls = useRef(new Map<number, HTMLElement>());
  const scrollToYear = (year: number) =>
    roomEls.current
      .get(year)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });

  const setRoomActive = useCallback((year: number, id: number) => {
    setActive((prev) => (prev[year] === id ? prev : { ...prev, [year]: id }));
  }, []);
  const onToneImage = useCallback((img: HTMLImageElement) => {
    const t = toneFromImage(img);
    if (t) setTone(t);
  }, []);

  return (
    <div
      className="relative min-h-screen overflow-x-clip bg-[#FAFAFA] dark:bg-[#0B0F19] [--tone:var(--tone-light)] dark:[--tone:var(--tone-dark)]"
      style={
        {
          "--tone-light": tone.light,
          "--tone-dark": tone.dark,
        } as React.CSSProperties
      }
    >
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
          results={allSongs.filter((s) => view.lit.has(s.id))}
          shown={view.shown}
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
            litCount={view.lit.size}
            litByYear={litByYear}
            onYear={scrollToYear}
            onToggle={toggleLamp}
            onPutOut={putOut}
          />
        )}
      </TopBar>

      <Opening
        rooms={rooms}
        total={total}
        query={query}
        setQuery={setQuery}
        results={allSongs.filter((s) => view.lit.has(s.id))}
        shown={view.shown}
        onTone={onToneImage}
        onSeeAll={() => scrollToYear(rooms[0].year)}
      />

      {rooms.map((room) => (
        <Room
          key={room.year}
          room={room}
          activeId={active[room.year] ?? room.featuredId}
          setActive={(id) => setRoomActive(room.year, id)}
          shown={view.shown}
          lit={lampOn ? view.lit : null}
          onTone={onToneImage}
          setRef={(el) => {
            if (el) roomEls.current.set(room.year, el);
            else roomEls.current.delete(room.year);
          }}
        />
      ))}

      <p className="mx-auto max-w-[90rem] px-6 pb-24 pt-8 text-center font-kaiti text-sm text-slate-400 md:px-16 dark:text-slate-500">
        原型只挂了两间展室 · 二〇一六、二〇一二
      </p>
    </div>
  );
}

// ── 一幅画 ────────────────────────────────────────────────────────────────

/** 画框：换歌时新画淡入，旧画淡出；没有封面的挂一张素笺 */
function Frame({
  song,
  sizes,
  priority,
  onTone,
  className,
}: {
  song: VerseSong;
  sizes: string;
  priority?: boolean;
  onTone?: (img: HTMLImageElement) => void;
  className?: string;
}) {
  return (
    <div className={cn("relative aspect-square", className)}>
      <AnimatePresence initial={false}>
        <motion.div
          key={song.id}
          className="absolute inset-0"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.7, ease: EASE }}
        >
          <div className="absolute inset-0 rounded-[3px] shadow-[0_36px_60px_-34px_rgba(15,23,42,0.55)] dark:shadow-[0_36px_60px_-26px_rgba(0,0,0,0.9)]" />
          <div
            className={cn(
              "relative size-full overflow-hidden rounded-[3px] ring-1 ring-slate-900/5 dark:ring-white/10",
              song.hascover
                ? "bg-slate-200 dark:bg-slate-800"
                : "bg-[#f1eee8] dark:bg-[#141b2b]",
            )}
          >
            {song.hascover ? (
              <Image
                src={getCoverUrl(song)}
                alt={song.title}
                fill
                sizes={sizes}
                priority={priority}
                onLoad={onTone ? (e) => onTone(e.currentTarget) : undefined}
                className="object-cover"
              />
            ) : (
              <span className="absolute inset-0 flex justify-center pt-[12%]">
                <span className="font-serif text-2xl tracking-[0.3em] text-slate-500 [writing-mode:vertical-rl] dark:text-slate-400">
                  {song.title}
                </span>
              </span>
            )}
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function Verse({ shown }: { shown: Shown }) {
  return (
    <>
      {segment(shown.text, shown.marks).map((seg, i) =>
        seg.color ? (
          <span key={i} style={{ color: seg.color }}>
            {seg.s}
          </span>
        ) : (
          <span key={i}>{seg.s}</span>
        ),
      )}
    </>
  );
}

// ── 开场 ──────────────────────────────────────────────────────────────────

function Opening({
  rooms,
  total,
  query,
  setQuery,
  results,
  shown,
  onTone,
  onSeeAll,
}: {
  rooms: VerseRoom[];
  total: number;
  query: string;
  setQuery: (q: string) => void;
  results: VerseSong[];
  shown: Map<number, Shown>;
  onTone: (img: HTMLImageElement) => void;
  onSeeAll: () => void;
}) {
  const router = useRouter();
  const candidates = useMemo(
    () => rooms.flatMap((r) => r.songs).filter((s) => s.hascover && s.rep >= 0),
    [rooms],
  );
  // 每次打开换一首；挂载后才抽，免得服务端与客户端不一致
  const [pick, setPick] = useState<VerseSong | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 随机只能在客户端做
    setPick(candidates[Math.floor(Math.random() * candidates.length)] ?? null);
  }, [candidates]);

  const line = pick ? pick.lines[pick.rep].text : "";
  const phrases = line.split(/[\s，,]+/).filter(Boolean);

  return (
    <section className="relative mx-auto flex min-h-svh max-w-[90rem] flex-col px-6 pt-(--nav-h) md:px-16">
      <p className="pt-8 text-xs tracking-[0.35em] text-slate-400 md:pt-10 dark:text-slate-500">
        河图作品勘鉴 · 凡 {total} 首
      </p>

      <div className="flex flex-1 items-center justify-center py-10">
        {pick && (
          <Link
            href={`/song/${pick.id}`}
            className="group flex items-start gap-8 md:gap-16"
          >
            <motion.div
              initial={{ opacity: 0, scale: 1.02 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 1.4, ease: EASE }}
              className="w-[52vw] max-w-[26rem] md:w-[30vw]"
            >
              <Frame
                song={pick}
                sizes="(min-width: 768px) 30vw, 52vw"
                priority
                onTone={onTone}
              />
            </motion.div>
            {/* 一句词，竖排，一个字一个字显出来 */}
            <div className="flex gap-5 md:gap-8">
              <p
                aria-label={line}
                className="flex flex-row-reverse gap-3 font-serif text-[1.65rem] leading-none tracking-[0.2em] text-slate-900 md:gap-5 md:text-[clamp(2rem,3.2vw,3rem)] dark:text-slate-50"
              >
                {phrases.map((phrase, pi) => (
                  <span key={pi} className="[writing-mode:vertical-rl]">
                    {Array.from(phrase).map((ch, ci) => {
                      const index = phrases.slice(0, pi).join("").length + ci;
                      return (
                        <motion.span
                          key={ci}
                          aria-hidden
                          initial={{ opacity: 0, filter: "blur(6px)" }}
                          animate={{ opacity: 1, filter: "blur(0px)" }}
                          transition={{
                            duration: 1.2,
                            ease: EASE,
                            delay: 0.6 + index * 0.11,
                          }}
                        >
                          {ch}
                        </motion.span>
                      );
                    })}
                  </span>
                ))}
              </p>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{
                  duration: 1,
                  delay: 0.8 + Array.from(line).length * 0.11,
                }}
                className="self-end text-xs tracking-[0.35em] text-slate-400 [writing-mode:vertical-rl] transition-colors group-hover:text-(--tone) dark:text-slate-500"
              >
                {pick.title} · {pick.year}
              </motion.p>
            </div>
          </Link>
        )}
      </div>

      {/* 搜索就放在开场：凭一句词找歌，是最常见的来意 */}
      <div className="mx-auto w-full max-w-md pb-14">
        <div className="relative">
          <label className="block border-b border-slate-300 transition-colors focus-within:border-(--tone) dark:border-slate-700">
            <span className="sr-only">寻</span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && results[0])
                  router.push(`/song/${results[0].id}`);
              }}
              placeholder="寻一首歌、一个名字、一句词"
              className="w-full bg-transparent pb-2.5 text-center font-serif text-lg text-slate-900 outline-none placeholder:text-slate-400 md:text-xl dark:text-slate-50 dark:placeholder:text-slate-600 [&::-webkit-search-cancel-button]:hidden"
            />
          </label>
          <AnimatePresence>
            {query.trim() && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.3, ease: EASE }}
                className="absolute inset-x-0 top-full z-20 mt-2 rounded-xl border border-slate-200/70 bg-[#FAFAFA] p-2 shadow-[0_16px_40px_-12px_rgba(15,23,42,0.25)] dark:border-slate-800 dark:bg-[#0B0F19]"
              >
                <ResultList results={results} shown={shown} />
                {results.length > 0 && (
                  <button
                    type="button"
                    onClick={onSeeAll}
                    className="mt-1 w-full rounded-lg px-3 py-2 text-left text-xs tracking-[0.2em] text-(--tone) transition-colors hover:bg-slate-100 dark:hover:bg-slate-900"
                  >
                    到墙上看这 {results.length} 首 ↓
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <p className="mt-4 text-center text-[11px] tracking-[0.3em] text-slate-400 dark:text-slate-500">
          往下 · {rooms[0].year}
        </p>
      </div>
    </section>
  );
}

function ResultList({
  results,
  shown,
}: {
  results: VerseSong[];
  shown: Map<number, Shown>;
}) {
  if (results.length === 0)
    return (
      <p className="px-3 py-3 font-kaiti text-sm text-slate-400 dark:text-slate-500">
        没有找到
      </p>
    );
  return (
    <ul>
      {results.slice(0, RESULT_LIMIT).map((song) => {
        const s = shown.get(song.id);
        return (
          <li key={song.id}>
            <Link
              href={`/song/${song.id}`}
              className="flex items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-slate-100 dark:hover:bg-slate-900"
            >
              <span className="relative size-9 shrink-0 overflow-hidden rounded-[2px] bg-slate-200 dark:bg-slate-800">
                {song.hascover && (
                  <Image
                    src={getCoverUrl(song)}
                    alt=""
                    fill
                    sizes="36px"
                    className="object-cover"
                  />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-serif text-sm text-slate-900 dark:text-slate-100">
                  {song.title}
                  <span className="ml-2 text-[11px] tracking-wider text-slate-400 dark:text-slate-500">
                    {song.year}
                  </span>
                </span>
                {s?.text && (
                  <span className="block truncate font-kaiti text-[13px] text-slate-500 dark:text-slate-400">
                    <Verse shown={s} />
                  </span>
                )}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

// ── 一间展室：一幅画，一面词 ──────────────────────────────────────────────

function Room({
  room,
  activeId,
  setActive,
  shown,
  lit,
  onTone,
  setRef,
}: {
  room: VerseRoom;
  activeId: number | null;
  setActive: (id: number) => void;
  shown: Map<number, Shown>;
  lit: Set<number> | null;
  onTone: (img: HTMLImageElement) => void;
  setRef: (el: HTMLElement | null) => void;
}) {
  const activeSong = room.songs.find((s) => s.id === activeId) ?? room.songs[0];
  const pointerType = useRef("mouse");

  return (
    <section
      ref={setRef}
      className="relative mx-auto max-w-[90rem] scroll-mt-(--nav-h) px-6 pb-[18vh] pt-[14vh] md:px-16"
    >
      <h2 className="flex items-baseline gap-5">
        <span className="font-serif text-4xl font-semibold tabular-nums tracking-tight text-slate-900 md:text-5xl dark:text-slate-50">
          {room.year}
        </span>
        <span className="text-xs tracking-[0.3em] text-slate-400 dark:text-slate-500">
          {cnCount(room.songs.length)}首
        </span>
      </h2>

      {/* 窄屏：画框吸在顶栏下面，点哪一行就换成哪一首 */}
      <div className="sticky top-(--nav-h) z-20 -mx-6 mt-8 flex items-center gap-4 bg-[#FAFAFA]/92 px-6 py-3 backdrop-blur-sm md:hidden dark:bg-[#0B0F19]/92">
        <Frame song={activeSong} sizes="80px" className="w-20 shrink-0" />
        <div className="min-w-0">
          <p className="truncate font-serif text-base text-slate-900 dark:text-slate-50">
            {activeSong.title}
          </p>
          <p className="mt-1 truncate text-[11px] tracking-wider text-slate-400 dark:text-slate-500">
            {[activeSong.artist.join(" / "), activeSong.type]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
      </div>

      <div className="md:mt-14 md:grid md:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] md:gap-x-20">
        <div className="hidden md:block">
          <div className="sticky top-[calc(var(--nav-h)+3rem)]">
            <Frame song={activeSong} sizes="22rem" onTone={onTone} />
            <div className="mt-6">
              <p className="font-serif text-lg text-slate-900 dark:text-slate-50">
                {activeSong.title}
              </p>
              <p className="mt-1.5 text-[11px] tracking-wider text-slate-400 dark:text-slate-500">
                {[activeSong.artist.join(" / "), activeSong.type]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
          </div>
        </div>

        {/* 词墙：一首一列，从右往左读；窄屏一首一行 */}
        <ul className="mt-2 flex flex-col md:mt-0 md:flex-row-reverse md:flex-wrap md:gap-x-5 md:gap-y-16">
          {room.songs.map((song, i) => {
            const s = shown.get(song.id);
            const isLit = lit ? lit.has(song.id) : null;
            const isActive = song.id === activeSong.id;
            return (
              <motion.li
                key={song.id}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-10% 0px" }}
                transition={{
                  duration: 0.9,
                  ease: EASE,
                  delay: (i % 20) * 0.04,
                }}
              >
                <Link
                  href={`/song/${song.id}`}
                  onPointerDown={(e) => (pointerType.current = e.pointerType)}
                  onPointerEnter={(e) => {
                    if (e.pointerType === "mouse") setActive(song.id);
                  }}
                  onFocus={() => setActive(song.id)}
                  onClick={(e) => {
                    // 窄屏：第一下换画，第二下才进去
                    if (pointerType.current !== "mouse" && !isActive) {
                      e.preventDefault();
                      setActive(song.id);
                    }
                  }}
                  className={cn(
                    "group flex items-baseline justify-between gap-4 border-b border-slate-200/60 py-3.5 outline-none transition-[opacity,color] duration-700 md:h-[29rem] md:flex-col md:items-center md:justify-between md:border-0 md:py-0 dark:border-slate-800/60",
                    isLit === false && "opacity-25",
                  )}
                >
                  <span
                    className={cn(
                      "font-serif text-[17px] leading-relaxed transition-colors duration-500 md:text-[1.3rem] md:leading-none md:tracking-[0.14em] md:[writing-mode:vertical-rl]",
                      s?.text
                        ? isActive
                          ? "text-slate-950 dark:text-white"
                          : "text-slate-600 group-hover:text-slate-950 dark:text-slate-400 dark:group-hover:text-white"
                        : "text-slate-400 dark:text-slate-600",
                    )}
                  >
                    {s?.text ? <Verse shown={s} /> : song.title}
                  </span>
                  <span
                    className={cn(
                      "shrink-0 text-[11px] tracking-[0.25em] transition-colors duration-500 md:[writing-mode:vertical-rl]",
                      isActive
                        ? "text-(--tone)"
                        : "text-slate-400 dark:text-slate-500",
                    )}
                  >
                    {s?.text ? song.title : ""}
                  </span>
                </Link>
              </motion.li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

// ── 寻 ────────────────────────────────────────────────────────────────────

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
  results,
  shown,
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
  imagery: VerseImagery[];
  lampOn: boolean;
  results: VerseSong[];
  shown: Map<number, Shown>;
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
                      litCount={results.length}
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
                    写一个词，或者点亮几个意象：墙上照到的字会亮起来
                  </span>
                )}
              </p>

              {query.trim() && (
                <div className="mt-6 max-w-xl">
                  <ResultList results={results} shown={shown} />
                </div>
              )}

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
                        "font-serif leading-none transition-colors duration-300",
                        !on &&
                          "text-slate-400 hover:text-slate-800 dark:text-slate-500 dark:hover:text-slate-200",
                      )}
                      style={{
                        fontSize: `${1 + 1.1 * Math.sqrt(item.count / max)}rem`,
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
  onPutOut,
}: {
  query: string;
  lamps: VerseImagery[];
  litCount: number;
  litByYear: { year: number; count: number }[];
  onYear: (year: number) => void;
  onToggle: (id: number) => void;
  onPutOut: () => void;
}) {
  return (
    <div className="border-t border-slate-200/50 dark:border-slate-800/50">
      <div className="no-scrollbar mx-auto flex h-11 max-w-[90rem] items-center gap-x-4 overflow-x-auto whitespace-nowrap px-6 text-xs tracking-[0.2em] text-slate-400 md:px-16 dark:text-slate-500">
        {query && (
          <span className="font-serif tracking-wider text-slate-700 dark:text-slate-200">
            「{query}」
          </span>
        )}
        {lamps.map((l) => (
          <button
            key={l.id}
            type="button"
            onClick={() => onToggle(l.id)}
            title="熄掉这盏"
            className="font-serif text-base leading-none tracking-normal transition-opacity hover:opacity-60"
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
    </div>
  );
}
