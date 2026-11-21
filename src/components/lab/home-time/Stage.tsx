"use client";

import CoverArt from "@/components/library/CoverArt";
import SongTitleLink from "@/components/library/SongTitleLink";
import { useUserContext } from "@/context/UserContext";
import type { Song } from "@/lib/types";
import { cn } from "@/lib/utils/utils";
import { formatTime } from "@/lib/utils/utils-common";
import { getCoverUrl } from "@/lib/utils/utils-song";
import { usePlayerStore } from "@/store/player-store";
import { motion, useInView, useReducedMotion } from "framer-motion";
import { Pause, Play } from "lucide-react";
import Image from "next/image";
import { useEffect, useRef } from "react";
import { stripeColor } from "./timeline";

const EASE = [0.23, 1, 0.32, 1] as const;

/** 胶片颗粒：整页一层极淡的噪点 */
const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

export function FilmGrain() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[60] opacity-[0.07] mix-blend-overlay"
      style={{ backgroundImage: GRAIN }}
    />
  );
}

/** 这首歌正在放吗 */
function usePlaying(songId: number) {
  const { currentTrack, isPlaying } = usePlayerStore();
  return isPlaying && currentTrack?.songId === songId;
}

/**
 * 色彩弥散：把封面本身放大、极度模糊，铺在作品后面，像光打在彩色幕布上。
 */
function Diffusion({
  song,
  lit,
  playing,
  className,
}: {
  song: Song;
  lit: boolean;
  playing: boolean;
  className?: string;
}) {
  const color = stripeColor(song);
  return (
    <motion.div
      aria-hidden
      initial={false}
      animate={{
        opacity: !lit ? 0 : playing ? [0.62, 0.95, 0.62] : 0.78,
      }}
      transition={
        playing && lit
          ? { duration: 4.5, ease: "easeInOut", repeat: Infinity }
          : { duration: 1.6, ease: EASE }
      }
      className={cn("pointer-events-none absolute", className)}
    >
      <div
        className="absolute inset-[12%] rounded-full blur-[110px]"
        style={{ background: color }}
      />
      <Image
        src={getCoverUrl(song)}
        alt=""
        fill
        sizes="160px"
        className="scale-110 object-cover opacity-80 blur-[90px] saturate-[1.7]"
      />
    </motion.div>
  );
}

/** 顶光：从上方斜打下来的一束暖白 */
function Spotlight({ lit, at }: { lit: boolean; at: string }) {
  return (
    <motion.div
      aria-hidden
      initial={false}
      animate={{ opacity: lit ? 1 : 0 }}
      transition={{ duration: 1.4, ease: EASE }}
      className="pointer-events-none absolute inset-0"
      style={{
        background: `radial-gradient(ellipse 28% 70% at ${at} -8%, rgba(255,244,224,0.13), rgba(255,244,224,0.04) 45%, transparent 75%)`,
      }}
    />
  );
}

/** 试听：会员才有音频，其他人只显示时长 */
function Listen({ song }: { song: Song }) {
  const { user, loaded } = useUserContext();
  const { currentTrack, play, toggle } = usePlayerStore();
  const playing = usePlaying(song.id);
  const canPlay = loaded && !!user?.hasBenefits && song.has_audio;

  return (
    <div className="flex items-center gap-4">
      {canPlay && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (currentTrack?.songId === song.id) toggle();
            else
              play({
                songId: song.id,
                title: song.title,
                artist: song.artist?.join(" / "),
                coverUrl: getCoverUrl(song),
              });
          }}
          className="group flex items-center gap-4 text-xs tracking-[0.35em] text-white/70 transition-colors hover:text-white"
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-full ring-1 ring-white/25 transition-all duration-500 group-hover:ring-white/70">
            {playing ? (
              <Pause size={15} className="fill-current" />
            ) : (
              <Play size={15} className="ml-0.5 fill-current" />
            )}
          </span>
          {playing ? "正在播放" : "试听"}
        </button>
      )}
      {song.length ? (
        <span className="text-xs tabular-nums tracking-widest text-white/30">
          {formatTime(song.length)}
        </span>
      ) : null}
    </div>
  );
}

function credits(song: Song): string[] {
  const out: string[] = [];
  const add = (label: string, v: string[] | null | undefined) => {
    if (v?.length) out.push(`${label}  ${v.join("、")}`);
  };
  add("词", song.lyricist);
  add("曲", song.composer);
  add("编", song.arranger);
  add("唱", song.artist);
  return out;
}

// ─────────────────────────────────────────────────────────────

/**
 * 开场：全黑，一束光慢慢打开，照亮最近的一件作品；左边是题名与前言。
 */
export function Overture({
  song,
  total,
  onOpenSong,
  onEnter,
  onCollection,
}: {
  song: Song;
  total: number;
  onOpenSong: (id: number) => void;
  onEnter: () => void;
  onCollection: () => void;
}) {
  const reduce = useReducedMotion();
  const playing = usePlaying(song.id);
  const t = (delay: number, duration = 1.6) => ({
    duration: reduce ? 0 : duration,
    delay: reduce ? 0 : delay,
    ease: EASE,
  });

  return (
    <section className="relative flex min-h-svh items-center overflow-hidden pt-(--nav-h)">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={t(0.9, 2.4)}
        className="absolute inset-0"
      >
        <Diffusion
          song={song}
          lit
          playing={playing}
          className="right-[-12%] top-1/2 h-[120vmin] w-[120vmin] -translate-y-1/2 md:right-[-4%]"
        />
      </motion.div>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={t(0.2, 1.8)}
        className="absolute inset-0"
      >
        <Spotlight lit at="72%" />
      </motion.div>

      <div className="relative mx-auto grid w-full max-w-7xl items-center gap-14 px-6 py-16 md:grid-cols-[1fr_1fr] md:gap-20">
        <div className="order-2 md:order-1">
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={t(1.6, 1.2)}
            className="text-xs tracking-[0.5em] text-white/45"
          >
            河图 · 作品勘鉴
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={t(1.8, 1.4)}
            className="mt-6 font-serif text-6xl leading-none font-semibold tracking-tight tabular-nums text-white sm:text-7xl xl:text-[7.5rem]"
          >
            2007
            <span className="mx-[0.2em] font-light text-white/25">—</span>
            <br className="sm:hidden" />
            2026
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={t(2.4, 1.6)}
            className="mt-10 max-w-md font-kaiti text-lg leading-[2] text-white/60"
          >
            从二〇〇七年的第一首，唱到二〇二六年的这一首。 二十年，{total}{" "}
            首歌。 灯一盏一盏亮起来，每一年，挑一首听。
          </motion.p>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={t(3, 1.2)}
            className="mt-12 flex items-center gap-10 text-xs tracking-[0.35em]"
          >
            <button
              type="button"
              onClick={onEnter}
              className="text-white/85 transition-colors hover:text-white"
            >
              入场 ↓
            </button>
            <button
              type="button"
              onClick={onCollection}
              className="text-white/40 transition-colors hover:text-white/80"
            >
              全部馆藏
            </button>
          </motion.div>
        </div>

        <motion.figure
          initial={{ opacity: 0, filter: "brightness(0.15)" }}
          animate={{ opacity: 1, filter: "brightness(1)" }}
          transition={t(0.6, 2.6)}
          className="order-1 mx-auto w-full max-w-[min(420px,70vw)] md:order-2"
        >
          <div
            onClick={() => onOpenSong(song.id)}
            className="relative aspect-square cursor-pointer shadow-[0_50px_120px_-30px_rgba(0,0,0,0.95)]"
          >
            <CoverArt song={song} sizes="420px" priority="high" />
          </div>
          <figcaption className="mt-5 flex items-baseline justify-between gap-4 text-xs tracking-[0.3em] text-white/40">
            <span>此刻在展</span>
            <span className="font-serif text-sm tracking-wider text-white/75">
              {song.title}
            </span>
          </figcaption>
        </motion.figure>
      </div>

      {/* 暗角 */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_45%,rgba(0,0,0,0.6)_100%)]"
      />
    </section>
  );
}

/**
 * 一件展品：进到画面中央时灯亮起，离开时灯暗下去。
 * 版式只有一种：左边作品，右边年份与说明牌。
 */
export function Exhibit({
  song,
  index,
  count,
  onOpenSong,
  onActive,
}: {
  song: Song;
  index: number;
  count: number;
  onOpenSong: (id: number) => void;
  onActive: (index: number) => void;
}) {
  const ref = useRef<HTMLElement>(null);
  const lit = useInView(ref, { amount: 0.55 });
  const playing = usePlaying(song.id);
  const album =
    song.album && song.album !== song.title ? `收于《${song.album}》` : null;

  useEffect(() => {
    if (lit) onActive(index);
  }, [lit, index, onActive]);

  return (
    <section
      ref={ref}
      id={`ex${song.year}`}
      className="relative flex min-h-[92svh] items-center overflow-hidden py-24"
    >
      <Diffusion
        song={song}
        lit={lit}
        playing={playing}
        className="left-[-20%] top-1/2 h-[100vmin] w-[100vmin] -translate-y-1/2 md:left-[2%]"
      />
      <Spotlight lit={lit} at="30%" />

      <div className="relative mx-auto grid w-full max-w-7xl items-center gap-12 px-6 md:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] md:gap-24">
        <motion.div
          initial={false}
          animate={{
            filter: lit
              ? "brightness(1) saturate(1)"
              : "brightness(0.22) saturate(0.4)",
            scale: lit ? 1 : 0.97,
          }}
          transition={{ duration: 1.5, ease: EASE }}
          onClick={() => onOpenSong(song.id)}
          className="relative w-full max-w-[500px] cursor-pointer justify-self-center shadow-[0_50px_120px_-30px_rgba(0,0,0,0.95)] md:justify-self-end"
        >
          <div className="relative aspect-square">
            <CoverArt song={song} sizes="(min-width: 768px) 500px, 88vw" />
          </div>
        </motion.div>

        <motion.div
          initial={false}
          animate={{ opacity: lit ? 1 : 0.12, y: lit ? 0 : 14 }}
          transition={{ duration: 1.2, ease: EASE, delay: lit ? 0.35 : 0 }}
        >
          <p className="font-serif text-7xl leading-none tracking-tight tabular-nums text-white/90 md:text-8xl">
            {song.year}
          </p>
          <p className="mt-4 text-[11px] tabular-nums tracking-[0.45em] text-white/30">
            {String(index + 1).padStart(2, "0")} / {count}
          </p>

          <div className="mt-12 h-px w-10 bg-white/25" />

          <h3 className="mt-8 font-serif text-3xl leading-snug text-white md:text-4xl">
            <SongTitleLink
              songId={song.id}
              onNavigate={() => onOpenSong(song.id)}
            >
              {song.title}
            </SongTitleLink>
          </h3>
          <p className="mt-3 text-xs tabular-nums tracking-[0.3em] text-white/40">
            {song.date?.replaceAll("-", ".")}
            {song.type?.[0] ? ` · ${song.type[0]}` : ""}
          </p>
          <ul className="mt-7 space-y-1.5 text-sm leading-6 text-white/60">
            {credits(song).map((c) => (
              <li key={c}>{c}</li>
            ))}
            {album && <li className="text-white/40">{album}</li>}
          </ul>

          <div className="mt-10">
            <Listen song={song} />
          </div>
        </motion.div>
      </div>
    </section>
  );
}

/** 展线：右侧一列年份，当前那一年亮着；最后通到馆藏 */
export function ExhibitRail({
  years,
  active,
  visible,
  onJump,
  onCollection,
}: {
  years: number[];
  active: number;
  visible: boolean;
  onJump: (year: number) => void;
  onCollection: () => void;
}) {
  return (
    <nav
      aria-label="展线"
      className={cn(
        "fixed right-6 top-1/2 z-40 hidden -translate-y-1/2 flex-col items-end gap-1.5 transition-opacity duration-700 lg:flex",
        visible ? "opacity-100" : "pointer-events-none opacity-0",
      )}
    >
      {years.map((y, i) => (
        <button
          key={y}
          type="button"
          onClick={() => onJump(y)}
          className={cn(
            "flex items-center gap-2 font-serif text-[11px] tabular-nums tracking-wider transition-colors duration-500",
            i === active ? "text-white" : "text-white/20 hover:text-white/60",
          )}
        >
          {i === active && <span className="h-px w-4 bg-white/70" />}
          {y}
        </button>
      ))}
      <button
        type="button"
        onClick={onCollection}
        className="mt-3 text-[11px] tracking-[0.3em] text-white/35 transition-colors hover:text-white/80"
      >
        馆藏
      </button>
    </nav>
  );
}
