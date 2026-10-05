"use client";

import PlayButton from "@/components/shared/PlayButton";
import SiteMark from "@/components/shared/SiteMark";
import { TEXT_BUTTON_CLASS } from "@/components/shared/text-button";
import TopBar from "@/components/shared/topbar/TopBar";
import { useFavorites } from "@/context/FavoritesContext";
import { Link } from "@/i18n/navigation";
import type { Song } from "@/lib/types";
import { cn } from "@/lib/utils/utils";
import { getCoverUrl } from "@/lib/utils/utils-song";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, X } from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export interface ProtoImagery {
  id: number;
  name: string;
  accent: string;
  /** 写到它的作品数 */
  count: number;
}

export interface ProtoNote {
  body: string;
  /** 批注所引的那句词；对整首的评点为空 */
  quote: string | null;
}

export interface ProtoQuestion {
  title: string;
  stem: string;
  options: { text: string; imageryIds: number[]; label: string }[];
}

interface HomeProtoProps {
  songs: Song[];
  total: number;
  songImagery: Record<number, number[]>;
  imagery: ProtoImagery[];
  notes: Record<number, ProtoNote>;
  question: ProtoQuestion;
  storySongId: number | null;
}

const EASE = [0.23, 1, 0.32, 1] as const;
/** 朱砂：倾尽天下那条红线 */
const CINNABAR = "#c8402f";
/** 灯台上直接列出的意象数 */
const LAMP_IMAGERY = 9;
/** 「灯下」最多先挂几幅，其余到墙上看 */
const GATHER_LIMIT = 18;

/** 一盏灯：从哪里来、照亮哪些作品 */
type Lamp =
  | { kind: "imagery"; id: number }
  | { kind: "quiz"; option: number }
  | { kind: "mine" }
  | { kind: "person"; name: string };

const lampKey = (l: Lamp) =>
  l.kind === "imagery"
    ? `i${l.id}`
    : l.kind === "quiz"
      ? "quiz"
      : l.kind === "mine"
        ? "mine"
        : `p${l.name}`;

const credits = (s: Song) => [
  ...(s.artist ?? []),
  ...(s.lyricist ?? []),
  ...(s.composer ?? []),
  ...(s.arranger ?? []),
];

export default function HomeProto({
  songs,
  total,
  songImagery,
  imagery,
  notes,
  question,
  storySongId,
}: HomeProtoProps) {
  const { favorites, isLoggedIn } = useFavorites();
  const [query, setQuery] = useState("");
  const [lamps, setLamps] = useState<Lamp[]>([]);
  const searchRef = useRef<HTMLInputElement>(null);

  // ── 歌词索引：第一次搜的时候才去拉 ─────────────────────────────────────
  const [lyrics, setLyrics] = useState<Map<number, string> | null>(null);
  const lyricsRequested = useRef(false);
  useEffect(() => {
    if (!query.trim() || lyricsRequested.current) return;
    lyricsRequested.current = true;
    fetch("/api/public/songs/lyrics-index")
      .then((r) => r.json())
      .then((rows: { id: number; l: string }[]) =>
        setLyrics(new Map(rows.map((r) => [r.id, r.l.toLowerCase()]))),
      )
      // 拉不到就只按题名与署名搜
      .catch(() => setLyrics(new Map()));
  }, [query]);

  const imageryById = useMemo(
    () => new Map(imagery.map((i) => [i.id, i])),
    [imagery],
  );

  // ── 灯：同一类的灯相加，不同类的灯相交 ─────────────────────────────────
  const q = query.trim().toLowerCase();
  const lampOn = q.length > 0 || lamps.length > 0;
  const lit = useMemo(() => {
    if (!lampOn) return null;
    const sets: Set<number>[] = [];
    if (q) {
      sets.push(
        new Set(
          songs
            .filter(
              (s) =>
                [s.title, s.album, ...credits(s), ...(s.creditAliases ?? [])]
                  .filter(Boolean)
                  .join(" ")
                  .toLowerCase()
                  .includes(q) || lyrics?.get(s.id)?.includes(q),
            )
            .map((s) => s.id),
        ),
      );
    }
    const imageryLamps = lamps.flatMap((l) =>
      l.kind === "imagery"
        ? [l.id]
        : l.kind === "quiz"
          ? question.options[l.option].imageryIds
          : [],
    );
    if (imageryLamps.length > 0)
      sets.push(
        new Set(
          songs
            .filter((s) =>
              (songImagery[s.id] ?? []).some((id) => imageryLamps.includes(id)),
            )
            .map((s) => s.id),
        ),
      );
    if (lamps.some((l) => l.kind === "mine")) sets.push(new Set(favorites));
    const people = lamps.flatMap((l) => (l.kind === "person" ? [l.name] : []));
    if (people.length > 0)
      sets.push(
        new Set(
          songs
            .filter((s) => credits(s).some((n) => people.includes(n)))
            .map((s) => s.id),
        ),
      );
    if (sets.length === 0) return null;
    const [firstSet, ...rest] = sets;
    return new Set([...firstSet].filter((id) => rest.every((s) => s.has(id))));
  }, [lampOn, q, songs, lyrics, lamps, question, songImagery, favorites]);

  const toggleLamp = useCallback((lamp: Lamp) => {
    setLamps((prev) => {
      const key = lampKey(lamp);
      const without = prev.filter((l) => lampKey(l) !== key);
      // 测验同时只答一个选项：换答案就是换灯
      if (lamp.kind === "quiz") {
        const same = prev.find(
          (l) => l.kind === "quiz" && l.option === lamp.option,
        );
        return same ? without : [...without, lamp];
      }
      return without.length < prev.length ? without : [...prev, lamp];
    });
  }, []);
  const putOut = useCallback(() => {
    setQuery("");
    setLamps([]);
  }, []);
  const lampLabel = (l: Lamp) =>
    l.kind === "imagery"
      ? imageryById.get(l.id)?.name
      : l.kind === "quiz"
        ? `${question.title} · ${question.options[l.option].label}`
        : l.kind === "mine"
          ? "我的收藏"
          : l.name;

  // ── 展室：按年分，每年挑一幅主作 ───────────────────────────────────────
  const rooms = useMemo(() => {
    const byYear = new Map<number | null, Song[]>();
    for (const s of songs) {
      const y = s.year ?? null;
      byYear.set(y, [...(byYear.get(y) ?? []), s]);
    }
    return [...byYear.entries()].map(([year, list]) => {
      const covered = list.filter((s) => s.hascover === true);
      // 有评点的优先，其次写到的意象最多
      const featured = [...covered].sort(
        (a, b) =>
          Number(!!notes[b.id]) - Number(!!notes[a.id]) ||
          (songImagery[b.id]?.length ?? 0) - (songImagery[a.id]?.length ?? 0),
      )[0];
      const tally = new Map<number, number>();
      for (const s of list)
        for (const id of songImagery[s.id] ?? [])
          tally.set(id, (tally.get(id) ?? 0) + 1);
      const signature = [...tally.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 2)
        .map(([id]) => imageryById.get(id)?.name)
        .filter(Boolean) as string[];
      return {
        year,
        key: year === null ? "unknown" : String(year),
        covered: featured
          ? [featured, ...covered.filter((s) => s.id !== featured.id)]
          : covered,
        featuredId: featured?.id ?? null,
        plain: list.filter((s) => s.hascover !== true),
        count: list.length,
        signature,
      };
    });
  }, [songs, notes, songImagery, imageryById]);
  const maxCount = Math.max(...rooms.map((r) => r.count));

  // 此刻在哪一年：视口中线落在哪间
  const roomEls = useRef(new Map<string, HTMLElement>());
  const [currentRoom, setCurrentRoom] = useState<string | null>(null);
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries)
          if (e.isIntersecting)
            setCurrentRoom((e.target as HTMLElement).dataset.room ?? null);
      },
      { rootMargin: "-45% 0px -55% 0px" },
    );
    roomEls.current.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);
  const goRoom = (key: string) =>
    roomEls.current.get(key)?.scrollIntoView({ behavior: "smooth" });

  const litSongs = lit ? songs.filter((s) => lit.has(s.id)) : [];
  const storySong = songs.find((s) => s.id === storySongId) ?? null;

  return (
    <div className="relative min-h-screen overflow-x-clip bg-[#FAFAFA] dark:bg-[#0B0F19]">
      <TopBar
        exit={{ kind: "logo" }}
        pinned={
          <button
            type="button"
            onClick={() => {
              window.scrollTo({ top: 0, behavior: "smooth" });
              setTimeout(() => searchRef.current?.focus(), 500);
            }}
            aria-label="寻"
            title="寻"
            className={cn(
              "inline-flex size-10 items-center justify-center font-calligraphy text-2xl leading-none transition-colors",
              lampOn
                ? "text-(--tone)"
                : "text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white",
            )}
          >
            寻
          </button>
        }
      >
        {lampOn && (
          <LampStrip
            query={query.trim()}
            lamps={lamps}
            label={lampLabel}
            count={litSongs.length}
            onClearQuery={() => setQuery("")}
            onToggle={toggleLamp}
            onPutOut={putOut}
          />
        )}
      </TopBar>

      {/* ── 序厅 ── */}
      <section className="mx-auto grid min-h-svh max-w-[90rem] items-center gap-x-16 gap-y-12 px-6 pb-16 pt-[calc(var(--nav-h)+3rem)] md:px-16 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <div>
          <p className="text-xs tracking-[0.35em] text-(--tone)">
            作品勘鉴 · 凡 {total} 首
          </p>
          <h1 className="mt-6 font-serif text-[clamp(4.5rem,10vw,8.5rem)] font-semibold leading-none tracking-tight text-slate-900 dark:text-slate-50">
            谣歌
          </h1>
          <p className="mt-6 font-kaiti text-lg text-slate-600 md:text-xl dark:text-slate-400">
            你一定想知道，戏里讲了什么故事……
          </p>

          {/* 灯台：搜、意象、答一题、我的 */}
          <div className="mt-14 max-w-xl">
            <label className="block border-b border-slate-300 transition-colors focus-within:border-(--tone) dark:border-slate-700">
              <span className="sr-only">寻</span>
              <input
                ref={searchRef}
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="寻一首歌、一个名字、一句词"
                className="w-full bg-transparent pb-3 font-serif text-xl text-slate-900 outline-none placeholder:text-slate-400 md:text-2xl dark:text-slate-50 dark:placeholder:text-slate-600 [&::-webkit-search-cancel-button]:hidden"
              />
            </label>
            <LampDesk
              imagery={imagery.slice(0, LAMP_IMAGERY)}
              lamps={lamps}
              onToggle={toggleLamp}
              question={question}
              mine={isLoggedIn}
            />
          </div>
        </div>

        {storySong && <StoryCard compact />}
      </section>

      {/* ── 灯下：照亮的作品先汇在这里 ── */}
      <AnimatePresence initial={false}>
        {lit && (
          <motion.section
            key="gather"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.6, ease: EASE }}
            className="overflow-hidden"
          >
            <div className="mx-auto max-w-[90rem] px-6 pb-20 md:px-16">
              <p className="flex items-baseline gap-4 border-t border-slate-200/70 pt-8 dark:border-slate-800">
                <span className="font-serif text-xl text-slate-900 dark:text-slate-50">
                  灯下
                </span>
                <span className="text-xs tracking-[0.3em] text-slate-400 dark:text-slate-500">
                  亮 {litSongs.length} 首
                  {litSongs.length > GATHER_LIMIT && " · 其余在墙上亮着"}
                </span>
              </p>
              {litSongs.length === 0 ? (
                <p className="mt-8 font-kaiti text-[15px] text-slate-400 dark:text-slate-500">
                  这盏灯下没有作品
                </p>
              ) : (
                <ul className="mt-8 grid grid-cols-3 gap-x-4 gap-y-8 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-9">
                  {litSongs.slice(0, GATHER_LIMIT).map((s) => (
                    <li key={s.id}>
                      <Link href={`/song/${s.id}`} className="group block">
                        <Cover song={s} sizes="140px" small />
                        <p className="mt-2 truncate font-serif text-[13px] text-slate-600 group-hover:text-slate-900 dark:text-slate-400 dark:group-hover:text-slate-50">
                          {s.title}
                        </p>
                        <p className="text-[10px] tracking-wider text-slate-400 dark:text-slate-500">
                          {s.year}
                        </p>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      {/* ── 展厅：左边时间索引，右边按年分间 ── */}
      <div className="mx-auto max-w-[90rem] px-6 md:px-16 lg:grid lg:grid-cols-[9rem_minmax(0,1fr)] lg:gap-x-16">
        <nav aria-label="年份" className="hidden lg:block">
          <ol className="sticky top-[calc(var(--nav-h)+2.5rem)] space-y-[3px] py-2">
            {rooms.map((room) => {
              const here = currentRoom === room.key;
              const litHere = lit
                ? room.covered.concat(room.plain).filter((s) => lit.has(s.id))
                    .length
                : 0;
              return (
                <li key={room.key}>
                  <button
                    type="button"
                    onClick={() => goRoom(room.key)}
                    className="group flex w-full items-center gap-3 py-0.5 text-left"
                  >
                    <span
                      className={cn(
                        "w-11 shrink-0 font-serif tabular-nums transition-all duration-500",
                        here
                          ? "text-lg text-slate-900 dark:text-slate-50"
                          : "text-xs text-slate-400 group-hover:text-slate-700 dark:text-slate-500 dark:group-hover:text-slate-300",
                        lit && litHere === 0 && !here && "opacity-40",
                      )}
                    >
                      {room.year ?? "未详"}
                    </span>
                    {/* 当年作品数：一道细线 */}
                    <span className="relative h-px flex-1">
                      <span
                        className={cn(
                          "absolute inset-y-0 left-0 transition-colors duration-500",
                          here
                            ? "bg-slate-700 dark:bg-slate-300"
                            : "bg-slate-300 dark:bg-slate-700",
                        )}
                        style={{ width: `${(room.count / maxCount) * 100}%` }}
                      />
                      {lit && litHere > 0 && (
                        <span
                          className="absolute inset-y-[-1px] left-0 bg-(--tone)"
                          style={{ width: `${(litHere / maxCount) * 100}%` }}
                        />
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>

        <main>
          {rooms.map((room, ri) => (
            <Room
              key={room.key}
              room={room}
              index={ri}
              lit={lit}
              notes={notes}
              storySong={
                storySong && storySong.year === room.year ? storySong : null
              }
              setRef={(el) => {
                if (el) roomEls.current.set(room.key, el);
                else roomEls.current.delete(room.key);
              }}
              onPerson={(name) => toggleLamp({ kind: "person", name })}
            />
          ))}
        </main>
      </div>

      {/* ── 尾厅 ── */}
      <footer className="mx-auto max-w-[90rem] border-t border-slate-200/70 px-6 py-16 md:px-16 dark:border-slate-800">
        <div className="flex flex-wrap items-baseline gap-x-10 gap-y-4 text-xs tracking-[0.3em] text-slate-400 dark:text-slate-500">
          <span>别卷</span>
          <Link
            href="/story/qjtx"
            className="font-serif text-[15px] tracking-wider text-slate-700 hover:text-(--tone) dark:text-slate-300"
          >
            倾尽天下
          </Link>
          <Link
            href="/imagery"
            className="font-serif text-[15px] tracking-wider text-slate-700 hover:text-(--tone) dark:text-slate-300"
          >
            意象
          </Link>
          <Link
            href="/quiz"
            className="font-serif text-[15px] tracking-wider text-slate-700 hover:text-(--tone) dark:text-slate-300"
          >
            寻曲
          </Link>
        </div>
        <SiteMark className="mt-12" />
      </footer>
    </div>
  );
}

// ── 灯台 ──────────────────────────────────────────────────────────────────

function LampDesk({
  imagery,
  lamps,
  onToggle,
  question,
  mine,
}: {
  imagery: ProtoImagery[];
  lamps: Lamp[];
  onToggle: (lamp: Lamp) => void;
  question: ProtoQuestion;
  mine: boolean;
}) {
  const [asking, setAsking] = useState(false);
  const answered = lamps.find((l) => l.kind === "quiz");
  const on = (lamp: Lamp) => lamps.some((l) => lampKey(l) === lampKey(lamp));

  return (
    <div className="mt-6">
      <div className="flex flex-wrap items-baseline gap-x-5 gap-y-3">
        <span className="text-xs tracking-[0.3em] text-slate-400 dark:text-slate-500">
          灯
        </span>
        {imagery.map((item) => {
          const active = on({ kind: "imagery", id: item.id });
          return (
            <button
              key={item.id}
              type="button"
              aria-pressed={active}
              onClick={() => onToggle({ kind: "imagery", id: item.id })}
              title={`${item.count} 首写到`}
              className={cn(
                "font-serif text-lg leading-none transition-colors duration-300",
                !active &&
                  "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white",
              )}
              style={{ color: active ? item.accent : undefined }}
            >
              {item.name}
            </button>
          );
        })}
        <span
          aria-hidden
          className="h-3 w-px self-center bg-slate-300 dark:bg-slate-700"
        />
        <button
          type="button"
          aria-expanded={asking}
          onClick={() => setAsking(!asking)}
          className={cn(
            "font-kaiti text-[15px] transition-colors",
            asking || answered
              ? "text-(--tone)"
              : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white",
          )}
        >
          答一题
        </button>
        {mine && (
          <button
            type="button"
            aria-pressed={on({ kind: "mine" })}
            onClick={() => onToggle({ kind: "mine" })}
            className={cn(
              "font-kaiti text-[15px] transition-colors",
              on({ kind: "mine" })
                ? "text-(--tone)"
                : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white",
            )}
          >
            我的收藏
          </button>
        )}
      </div>

      {/* 寻曲的第一题：答了就是一盏灯 */}
      <div
        className={cn(
          "grid transition-[grid-template-rows] duration-500 ease-page",
          asking ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        <div className="min-h-0 overflow-hidden" inert={!asking}>
          <div className="pt-8">
            <p className="text-xs tracking-[0.3em] text-slate-400 dark:text-slate-500">
              寻曲 · 第一问 · {question.title}
            </p>
            <p className="mt-3 font-kaiti text-lg text-slate-800 dark:text-slate-200">
              {question.stem}
            </p>
            <ol className="mt-4 space-y-2">
              {question.options.map((o, i) => {
                const chosen =
                  answered?.kind === "quiz" && answered.option === i;
                return (
                  <li key={i}>
                    <button
                      type="button"
                      aria-pressed={chosen}
                      onClick={() => onToggle({ kind: "quiz", option: i })}
                      className={cn(
                        "text-left font-kaiti text-[15px] transition-colors",
                        chosen
                          ? "text-(--tone)"
                          : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white",
                      )}
                    >
                      {o.text}
                    </button>
                  </li>
                );
              })}
            </ol>
            <Link
              href="/quiz"
              className="mt-5 inline-flex items-center gap-1.5 text-xs tracking-widest text-(--tone) hover:opacity-75"
            >
              答完十二问，寻一首懂你的歌
              <ArrowRight size={13} />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

/** 面板收起后，点着的灯留在顶栏下沿；点一盏就熄掉它 */
function LampStrip({
  query,
  lamps,
  label,
  count,
  onClearQuery,
  onToggle,
  onPutOut,
}: {
  query: string;
  lamps: Lamp[];
  label: (l: Lamp) => string | undefined;
  count: number;
  onClearQuery: () => void;
  onToggle: (l: Lamp) => void;
  onPutOut: () => void;
}) {
  return (
    <div className="border-t border-slate-200/50 dark:border-slate-800/50">
      <div className="no-scrollbar mx-auto flex h-11 max-w-[90rem] items-center gap-x-4 overflow-x-auto whitespace-nowrap px-6 text-xs tracking-[0.2em] text-slate-400 md:px-16 dark:text-slate-500">
        <span>灯</span>
        {query && (
          <button
            type="button"
            onClick={onClearQuery}
            className="inline-flex items-center gap-1 font-serif text-sm tracking-wider text-slate-700 hover:opacity-60 dark:text-slate-200"
          >
            「{query}」
            <X size={11} />
          </button>
        )}
        {lamps.map((l) => (
          <button
            key={lampKey(l)}
            type="button"
            onClick={() => onToggle(l)}
            className="inline-flex items-center gap-1 font-serif text-sm tracking-wider text-slate-700 hover:opacity-60 dark:text-slate-200"
          >
            {label(l)}
            <X size={11} />
          </button>
        ))}
        <span aria-hidden>·</span>
        <span className="tabular-nums text-(--tone)">亮 {count} 首</span>
        <span aria-hidden>·</span>
        <button type="button" onClick={onPutOut} className={TEXT_BUTTON_CLASS}>
          熄灯
        </button>
      </div>
    </div>
  );
}

// ── 作品 ──────────────────────────────────────────────────────────────────

function Cover({
  song,
  sizes,
  small,
}: {
  song: Song;
  sizes: string;
  small?: boolean;
}) {
  return (
    <div className="relative aspect-square">
      <div
        aria-hidden
        className={cn(
          "absolute inset-0 rounded-[3px] transition-shadow duration-700",
          small
            ? "shadow-[0_14px_24px_-16px_rgba(15,23,42,0.5)]"
            : "shadow-[0_26px_44px_-28px_rgba(15,23,42,0.55)] group-hover:shadow-[0_34px_54px_-28px_rgba(15,23,42,0.6)] dark:shadow-[0_26px_44px_-20px_rgba(0,0,0,0.9)]",
        )}
      />
      <div className="relative size-full overflow-hidden rounded-[3px] bg-slate-200 ring-1 ring-slate-900/5 dark:bg-slate-800 dark:ring-white/10">
        <Image
          src={getCoverUrl(song)}
          alt={song.title}
          fill
          sizes={sizes}
          className="object-cover saturate-[.9] transition-[scale,filter] duration-700 ease-page group-hover:scale-[1.03] group-hover:saturate-100"
        />
      </div>
    </div>
  );
}

interface RoomData {
  year: number | null;
  key: string;
  covered: Song[];
  featuredId: number | null;
  plain: Song[];
  count: number;
  signature: string[];
}

function Room({
  room,
  index,
  lit,
  notes,
  storySong,
  setRef,
  onPerson,
}: {
  room: RoomData;
  index: number;
  lit: Set<number> | null;
  notes: Record<number, ProtoNote>;
  storySong: Song | null;
  setRef: (el: HTMLElement | null) => void;
  onPerson: (name: string) => void;
}) {
  const dim = (id: number) =>
    lit && !lit.has(id) ? "opacity-[0.12] grayscale" : "opacity-100";
  // 主作左右交替挂，免得每间都一个样
  const featuredRight = index % 2 === 1;

  return (
    <section
      ref={setRef}
      data-room={room.key}
      className="scroll-mt-[calc(var(--nav-h)+1rem)] border-t border-slate-200/70 pb-24 pt-14 dark:border-slate-800"
    >
      <header className="flex items-baseline gap-5">
        <h2 className="font-serif text-4xl font-semibold tabular-nums tracking-tight text-slate-900 md:text-5xl dark:text-slate-50">
          {room.year ?? "未详"}
        </h2>
        <span className="text-xs tracking-[0.3em] text-slate-400 dark:text-slate-500">
          {room.count} 首
        </span>
        {room.signature.length > 0 && (
          <span className="font-serif text-base tracking-[0.2em] text-(--tone)">
            {room.signature.join(" ")}
          </span>
        )}
      </header>

      {room.covered.length > 0 && (
        <ul className="mt-10 grid grid-flow-dense grid-cols-2 gap-x-5 gap-y-10 sm:grid-cols-3 md:gap-x-8 xl:grid-cols-5">
          {room.covered.map((song) => {
            const featured = song.id === room.featuredId;
            const note = featured ? notes[song.id] : undefined;
            return (
              <li
                key={song.id}
                className={cn(
                  "transition-[opacity,filter] duration-700",
                  dim(song.id),
                  featured &&
                    cn(
                      "col-span-2 row-span-2",
                      featuredRight && "sm:col-start-2 xl:col-start-4",
                    ),
                )}
              >
                <Link href={`/song/${song.id}`} className="group block">
                  <Cover
                    song={song}
                    sizes={
                      featured
                        ? "(min-width: 1280px) 440px, 90vw"
                        : "(min-width: 1280px) 220px, 45vw"
                    }
                  />
                </Link>
                <div className={featured ? "mt-5" : "mt-3"}>
                  <div className="flex items-center justify-between gap-2">
                    <Link
                      href={`/song/${song.id}`}
                      className={cn(
                        "min-w-0 truncate font-serif transition-colors hover:text-(--tone)",
                        featured
                          ? "text-lg text-slate-900 dark:text-slate-50"
                          : "text-[13px] text-slate-600 md:text-sm dark:text-slate-400",
                      )}
                    >
                      {song.title}
                    </Link>
                    {featured && (
                      <PlayButton
                        songId={song.id}
                        title={song.title}
                        artist={song.artist?.join(" / ")}
                        coverUrl={getCoverUrl(song)}
                        hasAudio={song.has_audio}
                        className="-mr-2 shrink-0"
                      />
                    )}
                  </div>
                  {featured && (
                    <>
                      {/* 署名：点一个名字，就点亮他参与的作品 */}
                      <p className="mt-1.5 flex flex-wrap gap-x-3 text-[11px] tracking-wider text-slate-400 dark:text-slate-500">
                        {[...new Set(credits(song))].slice(0, 4).map((n) => (
                          <button
                            key={n}
                            type="button"
                            onClick={() => onPerson(n)}
                            title={`点亮 ${n} 参与的作品`}
                            className="transition-colors hover:text-(--tone)"
                          >
                            {n}
                          </button>
                        ))}
                      </p>
                      {note && (
                        <blockquote className="mt-4 max-w-[26em] border-l border-slate-300 pl-3 dark:border-slate-700">
                          {note.quote && (
                            <p className="font-serif text-[13px] text-slate-400 dark:text-slate-500">
                              「{note.quote}」
                            </p>
                          )}
                          <p className="font-kaiti text-[15px] leading-relaxed text-slate-600 dark:text-slate-300">
                            {note.body}
                          </p>
                        </blockquote>
                      )}
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {storySong && <StoryCard song={storySong} />}

      {/* 没有封面的作品不挂空画框，写成一行 */}
      {room.plain.length > 0 && (
        <p className="mt-12 flex flex-wrap items-baseline gap-x-3 gap-y-2 text-xs tracking-[0.3em] text-slate-400 dark:text-slate-500">
          此外
          {room.plain.map((song) => (
            <Link
              key={song.id}
              href={`/song/${song.id}`}
              className={cn(
                "font-serif text-sm tracking-wider text-slate-600 transition-[opacity,color] duration-700 hover:text-(--tone) dark:text-slate-400",
                dim(song.id),
              )}
            >
              {song.title}
            </Link>
          ))}
        </p>
      )}
    </section>
  );
}

// ── 特展 ──────────────────────────────────────────────────────────────────

/**
 * 倾尽天下：序厅里是「当前特展」，展厅里挂在它所属的那一年。
 * 插画缓缓推近，一缕朱砂线从左往右画过。
 */
function StoryCard({ song, compact }: { song?: Song; compact?: boolean }) {
  return (
    <Link
      href="/story/qjtx"
      className={cn(
        "group block",
        !compact &&
          "mt-16 grid gap-8 border-y border-slate-200/70 py-10 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] md:items-end dark:border-slate-800",
      )}
    >
      <div
        className={cn(
          "relative overflow-hidden rounded-[3px] ring-1 ring-slate-900/5 dark:ring-white/10",
          compact ? "aspect-[4/5]" : "aspect-[16/9]",
        )}
      >
        <motion.div
          className="absolute inset-0"
          animate={{ scale: [1.02, 1.09] }}
          transition={{
            duration: 20,
            ease: "easeInOut",
            repeat: Infinity,
            repeatType: "reverse",
          }}
        >
          <Image
            src={compact ? "/story/qjtx/31.avif" : "/story/qjtx/22.avif"}
            alt=""
            fill
            sizes={compact ? "(min-width: 1024px) 36vw, 90vw" : "60vw"}
            className="object-cover"
          />
        </motion.div>
        <svg
          aria-hidden
          viewBox="0 0 400 300"
          preserveAspectRatio="none"
          className="absolute inset-0 size-full"
        >
          <motion.path
            d="M -10 210 C 80 180, 140 250, 210 196 S 330 110, 410 140"
            fill="none"
            stroke={CINNABAR}
            strokeWidth={1.6}
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: [0, 1, 1], opacity: [0.9, 0.9, 0] }}
            transition={{
              duration: 6.5,
              times: [0, 0.6, 1],
              ease: EASE,
              repeat: Infinity,
              repeatDelay: 1.5,
              delay: 1,
            }}
          />
        </svg>
        {compact && (
          <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/70 via-black/30 to-transparent p-6 pt-24">
            <p className="text-[11px] tracking-[0.35em] text-white/70">
              当前特展 · 长卷
            </p>
            <p className="mt-2 flex items-center gap-2 font-serif text-3xl font-semibold text-white">
              倾尽天下
              <ArrowRight
                size={20}
                className="opacity-0 transition-[opacity,translate] duration-500 -translate-x-1 group-hover:translate-x-0 group-hover:opacity-80"
              />
            </p>
            <p className="mt-1 font-kaiti text-sm text-white/75">
              一曲长歌，倾尽天下
            </p>
          </div>
        )}
      </div>
      {!compact && song && (
        <div>
          <p className="text-xs tracking-[0.35em] text-(--tone)">
            特展 · {song.year}
          </p>
          <p className="mt-3 font-serif text-4xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
            倾尽天下
          </p>
          <p className="mt-4 font-kaiti text-lg leading-relaxed text-slate-600 dark:text-slate-400">
            一曲长歌，倾尽天下。随一缕红线，走进这首歌里的故事。
          </p>
          <p className="mt-6 inline-flex items-center gap-1.5 text-xs tracking-widest text-(--tone)">
            走进长卷
            <ArrowRight
              size={13}
              className="transition-transform group-hover:translate-x-0.5"
            />
          </p>
        </div>
      )}
    </Link>
  );
}
