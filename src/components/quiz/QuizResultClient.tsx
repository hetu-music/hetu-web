"use client";

import CoverArt from "@/components/library/CoverArt";
import AppNavbar from "@/components/shared/AppNavbar";
import EnqueueButton from "@/components/shared/EnqueueButton";
import PlayButton from "@/components/shared/PlayButton";
import { Link, useRouter } from "@/i18n/navigation";
import type { QuizResultView } from "@/lib/quiz/views";
import { getCoverUrl } from "@/lib/utils/utils-song";
import { motion } from "framer-motion";
import { Check, Link2, RotateCcw } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useState } from "react";

interface Props {
  result: QuizResultView;
}

const EASE = [0.16, 1, 0.3, 1] as const;
/** 倾向条的满格对应的 z 分数 */
const Z_RANGE = 2.5;

function fadeUp(delay: number) {
  return {
    initial: { opacity: 0, y: 16 },
    animate: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.8, ease: EASE, delay },
    },
  };
}

export default function QuizResultClient({ result }: Props) {
  const t = useTranslations("quiz");
  const tSite = useTranslations("common.site");
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const siteName = tSite("name");

  const copyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // 剪贴板不可用（如非安全上下文）时静默失败
    }
  }, []);

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-slate-800 dark:bg-[#0B0F19] dark:text-slate-200">
      <AppNavbar
        title={
          <>
            {siteName.substring(0, 2)}
            <span className="mx-2 h-5 w-[2px] translate-y-[1.5px] rounded-full bg-blue-600" />
            {siteName.substring(2)}
          </>
        }
        onTitleClick={() => router.push("/")}
      />

      <main className="mx-auto max-w-3xl px-6 pb-40 pt-32">
        {/* ── 气韵 ── */}
        <motion.header {...fadeUp(0)} className="text-center">
          <p className="pl-[0.5em] font-serif text-sm tracking-[0.5em] text-slate-400 dark:text-slate-500">
            {t("result.eyebrow")}
          </p>
          <h1 className="mt-8 font-calligraphy text-7xl text-slate-900 md:text-8xl dark:text-white">
            {result.persona.motto}
          </h1>
          {result.secondary && (
            <p className="mt-6 pl-[0.3em] font-serif text-sm tracking-[0.3em] text-[#9A6B2F] dark:text-[#D4A259]">
              {t("result.secondary", { motto: result.secondary.motto })}
            </p>
          )}
          <p className="mx-auto mt-8 max-w-md font-kaiti text-lg leading-loose text-slate-600 dark:text-slate-400">
            {result.persona.description}
          </p>
        </motion.header>

        {/* ── 意象与倾向 ── */}
        <motion.section
          {...fadeUp(0.2)}
          className="mt-20 grid gap-12 border-t border-slate-200/70 pt-12 md:grid-cols-[1fr_1.4fr] dark:border-slate-800/70"
        >
          <div>
            <h2 className="font-serif text-xs tracking-[0.3em] text-slate-400 dark:text-slate-500">
              {t("result.imagery")}
            </h2>
            <div className="mt-5 flex flex-wrap gap-x-5 gap-y-3">
              {result.imagery.map((name) => (
                <span
                  key={name}
                  className="font-calligraphy text-3xl text-slate-800 dark:text-slate-100"
                >
                  {name}
                </span>
              ))}
            </div>
          </div>

          <div>
            <h2 className="font-serif text-xs tracking-[0.3em] text-slate-400 dark:text-slate-500">
              {t("result.profile")}
            </h2>
            <ul className="mt-5 space-y-2.5">
              {result.profile.map((p) => {
                const ratio = Math.min(Math.abs(p.z) / Z_RANGE, 1) * 50;
                const positive = p.z >= 0;
                return (
                  <li key={p.key} className="flex items-center gap-4">
                    <span className="w-10 shrink-0 font-serif text-sm text-slate-600 dark:text-slate-400">
                      {p.label}
                    </span>
                    <div className="relative h-1.5 flex-1 rounded-full bg-slate-100 dark:bg-slate-800/70">
                      <span className="absolute inset-y-[-3px] left-1/2 w-px bg-slate-300 dark:bg-slate-700" />
                      <motion.span
                        className={
                          positive
                            ? "absolute inset-y-0 left-1/2 rounded-full bg-[#9A6B2F] dark:bg-[#D4A259]"
                            : "absolute inset-y-0 right-1/2 rounded-full bg-slate-300 dark:bg-slate-600"
                        }
                        initial={{ width: 0 }}
                        animate={{ width: `${ratio}%` }}
                        transition={{ duration: 1, ease: EASE, delay: 0.4 }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </motion.section>

        {/* ── 契合歌曲 ── */}
        <section className="mt-20 border-t border-slate-200/70 pt-12 dark:border-slate-800/70">
          <motion.h2
            {...fadeUp(0.3)}
            className="font-serif text-xs tracking-[0.3em] text-slate-400 dark:text-slate-500"
          >
            {t("result.matches")}
          </motion.h2>

          <ol className="mt-6 space-y-4">
            {result.matches.map((m, i) => {
              const song = m.song;
              const artist = song.artist?.join(" / ");
              return (
                <motion.li
                  key={song.id}
                  {...fadeUp(0.4 + i * 0.1)}
                  className="group flex gap-5 rounded-sm border border-slate-200/70 bg-white/60 p-4 transition-colors hover:border-slate-300 md:p-5 dark:border-slate-800/70 dark:bg-slate-900/40 dark:hover:border-slate-700"
                >
                  <Link
                    href={`/song/${song.id}`}
                    className="h-20 w-20 shrink-0 md:h-24 md:w-24"
                  >
                    <CoverArt song={song} className="rounded-sm" />
                  </Link>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <Link
                          href={`/song/${song.id}`}
                          className="block truncate font-serif text-lg text-slate-900 transition-colors hover:text-[#9A6B2F] md:text-xl dark:text-slate-50 dark:hover:text-[#D4A259]"
                        >
                          {song.title}
                        </Link>
                        <p className="mt-0.5 truncate text-xs text-slate-400 dark:text-slate-500">
                          {[artist, song.album].filter(Boolean).join(" · ")}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <span className="font-serif text-2xl text-[#9A6B2F] tabular-nums dark:text-[#D4A259]">
                          {m.percent}
                        </span>
                        <span className="ml-0.5 text-xs text-slate-400">%</span>
                        <p className="text-[10px] tracking-widest text-slate-400 dark:text-slate-500">
                          {t("result.match")}
                        </p>
                      </div>
                    </div>

                    {m.reasons.length > 0 && (
                      <p className="mt-2 font-serif text-xs tracking-wider text-slate-500 dark:text-slate-400">
                        {t("result.reasons", {
                          reasons: m.reasons.join(" · "),
                        })}
                      </p>
                    )}

                    {m.lines.length > 0 && (
                      <div className="mt-3 space-y-1 border-l-2 border-[#9A6B2F]/30 pl-3 dark:border-[#D4A259]/30">
                        {m.lines.map((line) => (
                          <p
                            key={line}
                            className="font-kaiti text-[15px] leading-relaxed text-slate-600 dark:text-slate-300"
                          >
                            {line}
                          </p>
                        ))}
                      </div>
                    )}

                    <div className="mt-3 flex items-center gap-2">
                      <PlayButton
                        songId={song.id}
                        title={song.title}
                        artist={artist}
                        coverUrl={getCoverUrl(song)}
                        hasAudio={song.has_audio}
                        className="rounded-full border border-slate-200 p-1.5 dark:border-slate-700"
                      />
                      <EnqueueButton
                        songId={song.id}
                        title={song.title}
                        artist={artist}
                        coverUrl={getCoverUrl(song)}
                        hasAudio={song.has_audio}
                        className="rounded-full border border-slate-200 p-1.5 dark:border-slate-700"
                      />
                    </div>
                  </div>
                </motion.li>
              );
            })}
          </ol>
        </section>

        {/* ── 操作 ── */}
        <motion.div
          {...fadeUp(1)}
          className="mt-16 flex flex-wrap items-center justify-center gap-4"
        >
          <Link
            href="/quiz"
            className="flex items-center gap-2 border border-slate-300 px-6 py-2.5 font-serif text-sm tracking-[0.3em] text-slate-700 transition-colors hover:border-[#9A6B2F] hover:text-[#9A6B2F] dark:border-slate-700 dark:text-slate-200 dark:hover:border-[#D4A259] dark:hover:text-[#D4A259]"
          >
            <RotateCcw size={14} />
            {t("result.retry")}
          </Link>
          <button
            onClick={copyLink}
            className="flex items-center gap-2 border border-slate-300 px-6 py-2.5 font-serif text-sm tracking-[0.3em] text-slate-700 transition-colors hover:border-[#9A6B2F] hover:text-[#9A6B2F] dark:border-slate-700 dark:text-slate-200 dark:hover:border-[#D4A259] dark:hover:text-[#D4A259]"
          >
            {copied ? <Check size={14} /> : <Link2 size={14} />}
            {copied ? t("result.copied") : t("result.share")}
          </button>
        </motion.div>

        <p className="mt-10 text-center font-serif text-xs tracking-wider text-slate-400 dark:text-slate-600">
          {t("result.method")}
        </p>
      </main>
    </div>
  );
}
