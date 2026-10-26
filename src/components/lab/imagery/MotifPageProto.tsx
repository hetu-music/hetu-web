"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { Link } from "@/i18n/navigation";
import TopBar from "@/components/shared/topbar/TopBar";
import SiteMark from "@/components/shared/SiteMark";
import { getCoverUrl } from "@/lib/utils/utils-song";
import type { MotifData, MotifEmotion } from "./data";

/** 写法超过这么多先收起 */
const WORDS_FOLDED = 36;
/** 有基调的作品少于这个数，不谈偏向 */
const EMOTION_MIN_SAMPLE = 8;
/** 比全库高出这么多倍、且至少几首，才算偏向 */
const LEAN_LIFT = 1.5;
const LEAN_MIN_COUNT = 3;

const QUADRANTS: Array<{ tone: string; energy: string; label: string }> = [
  { tone: "暗", energy: "抑", label: "暗 · 抑" },
  { tone: "暗", energy: "扬", label: "暗 · 扬" },
  { tone: "明", energy: "扬", label: "明 · 扬" },
  { tone: "明", energy: "抑", label: "明 · 抑" },
];

const pct = (x: number) => `${Math.round(x * 100)}%`;

function isLean(e: MotifEmotion) {
  return (
    e.count >= LEAN_MIN_COUNT && e.base > 0 && e.share / e.base >= LEAN_LIFT
  );
}

function updateParam(id: number | null) {
  const url = new URL(window.location.href);
  url.searchParams.delete("q");
  if (id === null) url.searchParams.delete("w");
  else url.searchParams.set("w", String(id));
  window.history.replaceState(window.history.state, "", url);
}

export default function MotifPageProto({
  motif,
  initialWord,
}: {
  motif: MotifData;
  initialWord: number | null;
}) {
  const [word, setWord] = useState<number | null>(initialWord);
  const [wordsOpen, setWordsOpen] = useState(false);

  const selectWord = (id: number | null) => {
    setWord(id);
    updateParam(id);
  };

  const wordName = useMemo(
    () => new Map(motif.words.map((w) => [w.id, w.name])),
    [motif.words],
  );
  const works = word
    ? motif.works.filter((w) => w.wordIds.includes(word))
    : motif.works;
  const shownWords = motif.words.slice(0, wordsOpen ? undefined : WORDS_FOLDED);
  // 选中的写法收在折叠里时也要露出来
  if (word && !shownWords.some((w) => w.id === word)) {
    const w = motif.words.find((x) => x.id === word);
    if (w) shownWords.push(w);
  }
  const maxWord = motif.words[0]?.songCount ?? 1;
  const leans = motif.emotions
    .filter(isLean)
    .sort((a, b) => b.share / b.base - a.share / a.base);
  const enoughEmotion = motif.emotionSample >= EMOTION_MIN_SAMPLE;

  return (
    <div
      className="min-h-screen bg-[#FAFAFA] dark:bg-[#0B0F19] text-slate-800 dark:text-slate-200"
      style={{ ["--tone" as string]: motif.accent }}
    >
      <TopBar exit={{ kind: "back" }} />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-160 opacity-60 dark:opacity-40"
        style={{
          background: `radial-gradient(ellipse 60% 50% at 15% 0%, ${motif.accent}14, transparent 70%)`,
        }}
      />

      <div className="relative max-w-6xl mx-auto px-6 pt-32 md:pt-40 pb-32">
        {/* 卷首 */}
        <header className="lg:grid lg:grid-cols-[22rem_minmax(0,1fr)] lg:gap-x-16">
          <div>
            <p className="text-xs tracking-[0.35em] text-(--tone)">
              <Link
                href="/lab/imagery"
                className="hover:underline underline-offset-4"
              >
                意象
              </Link>
              {motif.path.map((p) => (
                <span key={p}>
                  <span className="mx-2 text-slate-300 dark:text-slate-600">
                    ·
                  </span>
                  {p}
                </span>
              ))}
            </p>
            <h1
              className="mt-6 font-calligraphy text-[7rem] md:text-[9rem] leading-none"
              style={{ color: motif.accent }}
            >
              {motif.name}
            </h1>
          </div>
          <div className="mt-10 lg:mt-0 lg:self-end space-y-4">
            <p className="font-serif text-2xl md:text-3xl text-slate-900 dark:text-slate-50 leading-snug">
              {motif.songCount} 首作品写到{motif.name}，
              <br className="hidden md:block" />有 {motif.words.length} 种写法。
            </p>
            {motif.description ? (
              <p className="max-w-[40em] font-kaiti text-base leading-[2.05] text-slate-700 dark:text-slate-300">
                {motif.description}
              </p>
            ) : (
              <p className="font-kaiti text-sm text-slate-400 dark:text-slate-500">
                （母题说明待补）
              </p>
            )}
          </div>
        </header>

        <div className="mt-20 lg:grid lg:grid-cols-[22rem_minmax(0,1fr)] lg:gap-x-16">
          {/* 左栏：写法、基调、同写 */}
          <aside className="space-y-16 lg:sticky lg:top-[calc(var(--nav-h)+2rem)] lg:self-start lg:max-h-[calc(100vh-var(--nav-h)-4rem)] lg:overflow-y-auto no-scrollbar pb-4">
            <section>
              <Heading label="写法">
                {word !== null && (
                  <button
                    type="button"
                    onClick={() => selectWord(null)}
                    className="text-xs tracking-widest text-(--tone) whitespace-nowrap"
                  >
                    全部
                  </button>
                )}
              </Heading>
              <div className="mt-6 flex flex-wrap items-baseline gap-x-4 gap-y-2.5">
                {shownWords.map((w) => {
                  const active = word === w.id;
                  return (
                    <button
                      key={w.id}
                      type="button"
                      onClick={() => selectWord(active ? null : w.id)}
                      className={`font-serif transition-colors ${
                        active
                          ? "text-(--tone) underline decoration-1 underline-offset-[6px]"
                          : word !== null
                            ? "text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                            : "text-slate-700 dark:text-slate-300 hover:text-(--tone)"
                      }`}
                      style={{
                        fontSize: `${0.85 + 0.55 * Math.sqrt(w.songCount / maxWord)}rem`,
                      }}
                    >
                      {w.name}
                      <span className="ml-1 font-sans text-[10px] text-slate-400 dark:text-slate-500">
                        {w.songCount}
                      </span>
                    </button>
                  );
                })}
              </div>
              {motif.words.length > WORDS_FOLDED && (
                <button
                  type="button"
                  onClick={() => setWordsOpen((o) => !o)}
                  className="mt-4 text-xs tracking-widest text-(--tone)"
                >
                  {wordsOpen ? "收起" : `展开全部 ${motif.words.length} 种`}
                </button>
              )}
            </section>

            <section>
              <Heading label="基调" />
              {enoughEmotion ? (
                <>
                  <p className="mt-6 font-kaiti text-sm leading-[1.85] text-slate-600 dark:text-slate-400">
                    {leans.length > 0 ? (
                      <>
                        写到{motif.name}的歌，偏
                        {leans.slice(0, 2).map((e, i) => (
                          <span key={e.id}>
                            {i > 0 && "、"}
                            <span className="text-(--tone)">{e.name}</span>
                          </span>
                        ))}
                        ：{leans[0].name}占 {pct(leans[0].share)}，全库是{" "}
                        {pct(leans[0].base)}。
                      </>
                    ) : (
                      <>写到{motif.name}的歌，基调与全库相近，没有明显偏向。</>
                    )}
                  </p>
                  <EmotionChart emotions={motif.emotions} />
                  <p className="mt-3 text-[11px] tracking-wider text-slate-400 dark:text-slate-500">
                    按主基调计 · 竖线为全库比例 · {motif.emotionSample} 首
                  </p>
                </>
              ) : (
                <p className="mt-6 font-kaiti text-sm text-slate-400 dark:text-slate-500">
                  写到的作品太少，不看偏向。
                </p>
              )}
            </section>

            {motif.cowritten.length > 0 && (
              <section>
                <Heading label="常与之同写" />
                <div className="mt-6 flex flex-wrap items-baseline gap-x-5 gap-y-3">
                  {motif.cowritten.map((m) => (
                    <Link
                      key={m.id}
                      href={`/lab/imagery/${m.id}`}
                      title={`${m.both} 首同写 · 约为随机的 ${m.lift.toFixed(1)} 倍`}
                      className="group font-calligraphy text-2xl leading-none"
                      style={{ color: m.accent }}
                    >
                      <span className="opacity-80 group-hover:opacity-100">
                        {m.name}
                      </span>
                      <span className="ml-1 font-sans text-[10px] text-slate-400 dark:text-slate-500">
                        {m.both}
                      </span>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {motif.siblings.length > 0 && (
              <section>
                <Heading label={`同属${motif.path.at(-1) ?? ""}`} />
                <p className="mt-6 flex flex-wrap gap-x-4 gap-y-1 font-serif text-sm leading-[2.2] text-slate-500 dark:text-slate-400">
                  {motif.siblings.map((s) => (
                    <Link
                      key={s.id}
                      href={`/lab/imagery/${s.id}`}
                      className="hover:text-(--tone) transition-colors"
                    >
                      {s.name}
                    </Link>
                  ))}
                </p>
              </section>
            )}
          </aside>

          {/* 右栏：作品 */}
          <section className="mt-16 lg:mt-0">
            <Heading
              label={
                word !== null
                  ? `作品 · 写作「${wordName.get(word) ?? ""}」的 ${works.length} 首`
                  : `作品 · ${works.length} 首`
              }
            />
            <ol className="mt-8">
              {works.map((w) => {
                const names = w.wordIds
                  .map((id) => wordName.get(id) ?? "")
                  .filter(Boolean)
                  .sort((a, b) => b.length - a.length);
                return (
                  <li
                    key={w.id}
                    className="grid grid-cols-[3.5rem_minmax(0,1fr)] gap-x-5 py-6 border-b border-slate-200/60 dark:border-slate-800/60"
                  >
                    <Link href={`/song/${w.id}`} className="block">
                      <Image
                        src={getCoverUrl(w)}
                        alt={w.title}
                        width={112}
                        height={112}
                        className="w-14 h-14 rounded-sm object-cover ring-1 ring-slate-900/5 dark:ring-white/10 grayscale-[35%] hover:grayscale-0 transition"
                      />
                    </Link>
                    <div className="min-w-0">
                      <p className="flex items-baseline gap-3">
                        <Link
                          href={`/song/${w.id}`}
                          className="font-serif text-base text-slate-900 dark:text-slate-100 hover:text-(--tone) transition-colors truncate"
                        >
                          {w.title}
                        </Link>
                        {w.year && (
                          <span className="text-xs tracking-wider text-slate-400 dark:text-slate-500">
                            {w.year}
                          </span>
                        )}
                      </p>
                      {w.lines.length > 0 ? (
                        <div className="mt-2 font-serif text-[15px] leading-[2] text-slate-600 dark:text-slate-400">
                          {w.lines.slice(0, 4).map((line, i) => (
                            <p key={i}>
                              <Highlight text={line} names={names} />
                            </p>
                          ))}
                          {w.lines.length > 4 && (
                            <p className="text-xs text-slate-400 dark:text-slate-500">
                              另有 {w.lines.length - 4} 句
                            </p>
                          )}
                        </div>
                      ) : (
                        <p className="mt-2 font-kaiti text-sm text-slate-400 dark:text-slate-500">
                          写作{names.map((n) => `「${n}」`).join("")}
                        </p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>
        </div>

        <footer className="mt-24 pt-8 border-t border-slate-200/70 dark:border-slate-800 text-center">
          <SiteMark />
        </footer>
      </div>
    </div>
  );
}

function Heading({
  label,
  children,
}: {
  label: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-5">
      <h2 className="font-serif text-sm tracking-[0.4em] text-(--tone) whitespace-nowrap">
        {label}
      </h2>
      <span className="flex-1 h-px bg-slate-200 dark:bg-slate-800" />
      {children}
    </div>
  );
}

/** 歌词里标出这个母题的写法（长词优先，「明月光」不拆成「明月」） */
function Highlight({ text, names }: { text: string; names: string[] }) {
  if (names.length === 0) return <>{text}</>;
  const escaped = names.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const parts = text.split(new RegExp(`(${escaped.join("|")})`, "g"));
  return (
    <>
      {parts.map((part, i) =>
        names.includes(part) ? (
          <span key={i} className="text-(--tone)">
            {part}
          </span>
        ) : (
          part
        ),
      )}
    </>
  );
}

/** 十一种基调按明暗 × 扬抑分四组，条长是本母题的比例，竖线是全库比例 */
function EmotionChart({ emotions }: { emotions: MotifEmotion[] }) {
  const max = Math.max(...emotions.flatMap((e) => [e.share, e.base]), 0.01);
  return (
    <div className="mt-6 space-y-5">
      {QUADRANTS.map((q) => {
        const rows = emotions.filter(
          (e) => e.tone === q.tone && e.energy === q.energy,
        );
        if (rows.length === 0) return null;
        return (
          <div key={q.label}>
            <p className="text-[11px] tracking-[0.3em] text-slate-400 dark:text-slate-500">
              {q.label}
            </p>
            <div className="mt-2 space-y-1.5">
              {rows.map((e) => {
                const lean = isLean(e);
                return (
                  <div
                    key={e.id}
                    className="grid grid-cols-[2.5rem_minmax(0,1fr)_2.5rem] items-center gap-3"
                    title={`${e.name}：${e.count} 首，${pct(e.share)}（全库 ${pct(e.base)}）`}
                  >
                    <span
                      className={`font-serif text-sm ${lean ? "text-(--tone)" : "text-slate-600 dark:text-slate-400"}`}
                    >
                      {e.name}
                    </span>
                    <div className="relative h-1.5">
                      <div className="absolute inset-0 rounded-full bg-slate-200/60 dark:bg-slate-800/60" />
                      <div
                        className={`absolute inset-y-0 left-0 rounded-full ${lean ? "bg-(--tone)" : "bg-slate-400/70 dark:bg-slate-500/70"}`}
                        style={{ width: `${(e.share / max) * 100}%` }}
                      />
                      <div
                        className="absolute -top-1 -bottom-1 w-px bg-slate-900/50 dark:bg-white/50"
                        style={{ left: `${(e.base / max) * 100}%` }}
                      />
                    </div>
                    <span
                      className={`text-right text-xs tabular-nums ${lean ? "text-(--tone)" : "text-slate-400 dark:text-slate-500"}`}
                    >
                      {pct(e.share)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
