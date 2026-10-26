"use client";

import { useIntersection } from "@/hooks/ui/useIntersection";
import { Link, useRouter } from "@/i18n/navigation";
import SiteMark from "@/components/shared/SiteMark";
import TopBar from "@/components/shared/topbar/TopBar";
import { GRAY_PALETTE } from "@/lib/imagery/palette";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronRight } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BracketButton,
  calcFontSize,
  CategoryButton,
  CloudTooltip,
  CloudWord,
  HeroMarquee,
  HeroTitle,
  paletteAt,
  SectionLabel,
  seededShuffle,
  useCloudHover,
  type CloudItem,
} from "./cloud";
import type { MotifData, MotifEmotion } from "./data";

/** 有基调的作品少于这个数，不谈偏向 */
const EMOTION_MIN_SAMPLE = 8;
/** 比全库高出这么多倍、且至少几首，才算偏向 */
const LEAN_LIFT = 1.5;
const LEAN_MIN_COUNT = 3;
/** 每首作品最多列几句 */
const LINES_SHOWN = 3;

const pct = (x: number) => `${Math.round(x * 100)}%`;
const isLean = (e: MotifEmotion) =>
  e.count >= LEAN_MIN_COUNT && e.base > 0 && e.share / e.base >= LEAN_LIFT;

const SECTIONS = [
  { id: "words", label: "写法" },
  { id: "emotion", label: "基调" },
  { id: "cowritten", label: "同写" },
  { id: "works", label: "作品" },
] as const;

function syncWordParam(id: number | null) {
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
  const router = useRouter();
  const palette = paletteAt(motif.palette);
  const [word, setWord] = useState<number | null>(initialWord);
  const [mounted, setMounted] = useState(false);
  const [seed, setSeed] = useState(0);
  const [activeSection, setActiveSection] = useState<string>("words");
  const [leaving, setLeaving] = useState<number | null>(null);
  const { ref: headerRef, entry } = useIntersection<HTMLElement>({
    threshold: 0.05,
  });

  useEffect(() => {
    requestAnimationFrame(() => {
      setMounted(true);
      setSeed(Math.floor(Math.random() * 2147483647));
    });
  }, []);

  // 筛选栏上标出读到了哪一节
  useEffect(() => {
    const els = SECTIONS.map((s) => document.getElementById(s.id)).filter(
      (el): el is HTMLElement => el !== null,
    );
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting);
        if (visible.length > 0) setActiveSection(visible[0].target.id);
      },
      { rootMargin: "-30% 0px -60% 0px" },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  const selectWord = useCallback((id: number | null) => {
    setWord(id);
    syncWordParam(id);
  }, []);

  const jumpTo = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    const navH = 80 + 56;
    window.scrollTo({
      top: el.getBoundingClientRect().top + window.scrollY - navH,
      behavior: "smooth",
    });
  };

  // ── 写法云 ──
  const wordItems: CloudItem[] = useMemo(
    () =>
      motif.words.map((w) => ({
        id: w.id,
        name: w.name,
        count: w.songCount,
        palette: motif.palette,
      })),
    [motif],
  );
  const maxWord = motif.words[0]?.songCount ?? 1;
  const wordById = useMemo(
    () => new Map(motif.words.map((w) => [w.id, w])),
    [motif.words],
  );
  const wordHover = useCloudHover(
    useCallback(
      (id: number) => {
        const w = wordById.get(id);
        return w ? { text: `${w.songCount} 首`, accent: palette.accent } : null;
      },
      [wordById, palette.accent],
    ),
    false,
  );

  // ── 基调 ──
  const leans = motif.emotions
    .filter(isLean)
    .sort((a, b) => b.share / b.base - a.share / a.base);
  const enoughEmotion = motif.emotionSample >= EMOTION_MIN_SAMPLE;

  // ── 同写 ──
  const coItems: CloudItem[] = motif.cowritten.map((m) => ({
    id: m.id,
    name: m.name,
    count: m.both,
    palette: m.palette,
  }));
  const coById = new Map(motif.cowritten.map((m) => [m.id, m]));
  const coHover = useCloudHover(
    useCallback(
      (id: number) => {
        const m = motif.cowritten.find((x) => x.id === id);
        return m
          ? {
              text: `${m.both} 首同写 · 随机的 ${m.lift.toFixed(1)} 倍`,
              accent: paletteAt(m.palette).accent,
            }
          : null;
      },
      [motif.cowritten],
    ),
    leaving !== null,
  );

  // ── 作品 ──
  const works = word
    ? motif.works.filter((w) => w.wordIds.includes(word))
    : motif.works;

  const marqueeRows = useMemo(() => {
    const names = motif.words.map((w) => w.name);
    const pool: string[] = [];
    while (pool.length < 90 && names.length > 0) pool.push(...names);
    const sample = seededShuffle(pool, seed).slice(0, 90);
    return [sample.slice(0, 30), sample.slice(30, 60), sample.slice(60, 90)];
  }, [motif.words, seed]);

  return (
    <div className="min-h-screen bg-[#FAFAFA] dark:bg-[#0B0F19] text-slate-800 dark:text-slate-200">
      <TopBar exit={{ kind: "back" }} />

      {/* ── 卷首 ── */}
      <header
        ref={headerRef}
        className="relative overflow-hidden pt-32 pb-14 px-6 text-center"
      >
        <div className="relative z-10">
          <HeroMarquee
            rows={marqueeRows}
            running={entry?.isIntersecting ?? true}
            tint={palette.accent}
          />
          <p
            className={`font-serif text-xs tracking-[0.4em] pl-[0.4em] text-slate-400 dark:text-slate-500 mb-6 ${mounted ? "hero-unroll" : "opacity-0"}`}
          >
            <Link
              href="/lab/imagery"
              className="hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
            >
              意象
            </Link>
            {motif.path.map((p) => (
              <span key={p}> · {p}</span>
            ))}
          </p>
          <HeroTitle
            text={motif.name}
            mounted={mounted}
            className={`font-calligraphy text-8xl md:text-[10rem] leading-none mb-8 flex justify-center items-center gap-6 ${palette.text}`}
            style={{
              textShadow: `0 0 40px ${palette.accent}33, 0 0 90px ${palette.accent}1a`,
            }}
          />
          <p
            className={`font-kaiti text-base md:text-xl text-slate-500 dark:text-slate-400 tracking-[0.4em] pl-[0.4em] ${mounted ? "hero-unroll" : "opacity-0"}`}
            style={{ animationDelay: "1200ms" }}
          >
            {motif.songCount} 首作品 · {motif.words.length} 种写法
          </p>
          {motif.description && (
            <p
              className={`mx-auto mt-6 max-w-xl font-kaiti text-base leading-[2] text-slate-600 dark:text-slate-300 ${mounted ? "hero-unroll" : "opacity-0"}`}
              style={{ animationDelay: "1800ms" }}
            >
              {motif.description}
            </p>
          )}
        </div>
      </header>

      {/* ── 分节导航 ── */}
      <div className="sticky top-(--nav-h) z-20 bg-[#FAFAFA]/40 dark:bg-[#0B0F19]/40 backdrop-blur-2xl border-b border-slate-200/10 dark:border-slate-800/20">
        <div className="max-w-5xl mx-auto px-6 py-2.5 flex items-center gap-8 overflow-x-auto no-scrollbar mask-linear-fade-edges">
          <div className="min-w-2" />
          {SECTIONS.filter(
            (s) => s.id !== "cowritten" || motif.cowritten.length > 0,
          ).map((s, i) => (
            <div key={s.id} className="flex items-center gap-8">
              {i > 0 && (
                <div className="w-[0.5px] h-3 bg-slate-200/50 dark:bg-slate-800/30 rotate-12" />
              )}
              <CategoryButton
                label={s.label}
                isActive={activeSection === s.id}
                onClick={() => jumpTo(s.id)}
                accentColor={palette.accent}
              />
            </div>
          ))}
          {word !== null && (
            <div className="ml-auto pl-6">
              <BracketButton
                label={`${wordById.get(word)?.name ?? ""} ×`}
                size="text-[13px]"
                isActive
                onClick={() => selectWord(null)}
                accentColor={palette.accent}
              />
            </div>
          )}
          <div className="min-w-2" />
        </div>
      </div>

      <main
        className={`max-w-4xl mx-auto px-6 sm:px-8 pt-8 pb-24 ${mounted ? "" : "opacity-0"}`}
        style={
          mounted
            ? {
                animation: "main-fade-in 1s ease-out both",
                animationDelay: "400ms",
              }
            : undefined
        }
      >
        {/* 写法 */}
        <section id="words" className="scroll-mt-40">
          <SectionLabel
            label={word !== null ? "点同一个词取消筛选" : "写法"}
            accent={palette.accent}
          />
          <div
            className="flex flex-wrap justify-center items-center gap-x-8 gap-y-5 py-4"
            onMouseOver={wordHover.onMouseOver}
            onMouseLeave={wordHover.onMouseLeave}
            onClick={(e) => {
              const btn = (e.target as HTMLElement).closest<HTMLElement>(
                "button[data-item-id]",
              );
              if (!btn) return;
              const id = Number(btn.dataset.itemId);
              selectWord(word === id ? null : id);
            }}
          >
            {wordItems.map((item, i) => (
              <CloudWord
                key={item.id}
                item={item}
                fontSize={calcFontSize(item.count, maxWord, 0.95, 1.6)}
                index={i}
                rowIndex={i % 8}
                selectedId={word}
                dimTo={0.25}
                label={`${item.name}，${item.count} 首`}
              />
            ))}
          </div>
          <CloudTooltip hover={wordHover.hover} />
        </section>

        {/* 基调 */}
        <section id="emotion" className="mt-20 scroll-mt-40">
          <SectionLabel label="基调" accent={palette.accent} />
          {enoughEmotion ? (
            <>
              <p className="text-center font-kaiti text-base text-slate-500 dark:text-slate-400 tracking-wider">
                {leans.length > 0 ? (
                  <>
                    写到{motif.name}的歌，多是
                    {leans.slice(0, 2).map((e, i) => (
                      <span key={e.id}>
                        {i > 0 && "、"}
                        <span className={palette.text}>{e.name}</span>
                      </span>
                    ))}
                    ——{leans[0].name}占 {pct(leans[0].share)}，全库只有{" "}
                    {pct(leans[0].base)}
                  </>
                ) : (
                  <>写到{motif.name}的歌，基调与全库相近，没有明显偏向</>
                )}
              </p>
              <EmotionField emotions={motif.emotions} palette={motif.palette} />
              <p className="mt-2 text-center text-[11px] tracking-[0.2em] text-slate-400 dark:text-slate-600">
                按主基调计 · 字越大占比越高 · 着色的是比全库明显偏多的 ·{" "}
                {motif.emotionSample} 首
              </p>
            </>
          ) : (
            <p className="text-center font-kaiti text-sm py-6 text-slate-400 dark:text-slate-500">
              写到的作品太少，不看偏向
            </p>
          )}
        </section>

        {/* 同写 */}
        {motif.cowritten.length > 0 && (
          <section id="cowritten" className="mt-20 scroll-mt-40">
            <SectionLabel label="常与之同写" accent={palette.accent} />
            <div
              className="flex flex-wrap justify-center items-center gap-x-10 gap-y-6 py-4"
              onMouseOver={coHover.onMouseOver}
              onMouseLeave={coHover.onMouseLeave}
              onClick={(e) => {
                const btn = (e.target as HTMLElement).closest<HTMLElement>(
                  "button[data-item-id]",
                );
                if (!btn) return;
                const id = Number(btn.dataset.itemId);
                if (!coById.has(id)) return;
                coHover.clear();
                setLeaving(id);
                setTimeout(() => router.push(`/lab/imagery/${id}`), 450);
              }}
            >
              {coItems.map((item, i) => (
                <CloudWord
                  key={item.id}
                  item={item}
                  fontSize={calcFontSize(
                    item.count,
                    Math.max(...coItems.map((c) => c.count)),
                    1.4,
                    1.2,
                  )}
                  index={i}
                  rowIndex={i}
                  selectedId={leaving}
                  label={`${item.name}，${item.count} 首同写`}
                />
              ))}
            </div>
            <CloudTooltip hover={coHover.hover} />
          </section>
        )}

        {/* 作品 */}
        <section id="works" className="mt-20 scroll-mt-40">
          <SectionLabel
            label={
              word !== null
                ? `写作「${wordById.get(word)?.name ?? ""}」的 ${works.length} 首`
                : `${works.length} 首作品`
            }
            accent={palette.accent}
          />
          <div className="flex flex-col -mx-6 relative">
            <AnimatePresence mode="popLayout" initial={false}>
              {works.map((w, i) => {
                const names = w.wordIds
                  .map((id) => wordById.get(id)?.name ?? "")
                  .filter(Boolean)
                  .sort((a, b) => b.length - a.length);
                return (
                  <motion.div
                    key={w.id}
                    layout
                    initial={{ opacity: 0, y: 20 }}
                    animate={{
                      opacity: 1,
                      y: 0,
                      transition: {
                        delay: Math.min(i, 20) * 0.02,
                        duration: 0.5,
                        ease: [0.23, 1, 0.32, 1],
                      },
                    }}
                    exit={{
                      opacity: 0,
                      scale: 0.98,
                      transition: { duration: 0.2 },
                    }}
                  >
                    <Link
                      href={`/song/${w.id}`}
                      className="flex items-center justify-between gap-4 py-5 px-6 border-b border-slate-100/80 dark:border-slate-800/50 hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors group"
                    >
                      <div className="min-w-0">
                        <div className="flex items-baseline gap-3">
                          <span className="font-serif text-[15px] text-slate-700 dark:text-slate-200 group-hover:text-slate-900 dark:group-hover:text-white transition-colors tracking-wide truncate">
                            {w.title}
                          </span>
                          <span className="shrink-0 text-[11px] text-slate-400 dark:text-slate-500 tracking-wide">
                            {[w.year, w.lyricist?.join(" · ")]
                              .filter(Boolean)
                              .join("  ·  ")}
                          </span>
                        </div>
                        {w.lines.length > 0 && (
                          <div className="mt-2 font-kaiti text-[15px] leading-[1.9] text-slate-500 dark:text-slate-400">
                            {w.lines.slice(0, LINES_SHOWN).map((line, li) => (
                              <p key={li}>
                                <Highlight
                                  text={line}
                                  names={names}
                                  className={palette.text}
                                />
                              </p>
                            ))}
                            {w.lines.length > LINES_SHOWN && (
                              <p className="text-[11px] text-slate-400 dark:text-slate-600 tracking-wider">
                                另 {w.lines.length - LINES_SHOWN} 句
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                      <ChevronRight
                        size={14}
                        className="shrink-0 text-slate-300 dark:text-slate-600 group-hover:text-slate-400 transition-all duration-300 group-hover:translate-x-0.5"
                      />
                    </Link>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </section>

        {/* 同类 */}
        {motif.siblings.length > 0 && (
          <section className="mt-20">
            <SectionLabel
              label={`同属${motif.path.at(-1) ?? ""}`}
              accent={palette.accent}
            />
            <div className="flex flex-wrap justify-center gap-x-6 gap-y-3">
              {motif.siblings.map((s) => (
                <BracketButton
                  key={s.id}
                  label={s.name}
                  count={s.songCount}
                  isActive={false}
                  onClick={() => router.push(`/lab/imagery/${s.id}`)}
                  accentColor={palette.accent}
                  size="text-[13px]"
                />
              ))}
            </div>
          </section>
        )}
      </main>

      <footer className="max-w-5xl mx-auto px-8 pb-12">
        <div className="border-t border-slate-100 dark:border-slate-800 pt-8 text-center">
          <SiteMark />
        </div>
      </footer>
    </div>
  );
}

/** 歌词里标出这个母题的写法（长词优先，「明月光」不拆成「明月」） */
function Highlight({
  text,
  names,
  className,
}: {
  text: string;
  names: string[];
  className: string;
}) {
  if (names.length === 0) return <>{text}</>;
  const escaped = names.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const parts = text.split(new RegExp(`(${escaped.join("|")})`, "g"));
  return (
    <>
      {parts.map((part, i) =>
        names.includes(part) ? (
          <span key={i} className={className}>
            {part}
          </span>
        ) : (
          part
        ),
      )}
    </>
  );
}

/**
 * 基调落在明暗 × 扬抑的四个象限里，像一小片词云：
 * 字号是这个母题的作品里该基调的占比，比全库明显偏多的着门类色，其余灰
 */
function EmotionField({
  emotions,
  palette,
}: {
  emotions: MotifEmotion[];
  palette: number;
}) {
  const maxShare = Math.max(...emotions.map((e) => e.share), 0.01);
  const items: Array<CloudItem & { e: MotifEmotion }> = emotions.map((e) => ({
    id: e.id,
    name: e.name,
    count: e.count,
    palette: isLean(e) ? palette : -1,
    e,
  }));
  const hover = useCloudHover(
    useCallback(
      (id: number) => {
        const e = emotions.find((x) => x.id === id);
        if (!e) return null;
        return {
          text: `${e.count} 首 · ${pct(e.share)}，全库 ${pct(e.base)}`,
          accent: (isLean(e) ? paletteAt(palette) : GRAY_PALETTE).accent,
        };
      },
      [emotions, palette],
    ),
    false,
  );
  const cell = (tone: string, energy: string) =>
    items.filter((x) => x.e.tone === tone && x.e.energy === energy);
  const quadrants = [
    cell("暗", "扬"),
    cell("明", "扬"),
    cell("暗", "抑"),
    cell("明", "抑"),
  ];
  const axis =
    "absolute text-[11px] tracking-[0.3em] text-slate-300 dark:text-slate-700 font-serif select-none";

  return (
    <div className="relative mx-auto mt-10 max-w-2xl px-8 py-10">
      {/* 十字轴 */}
      <div className="absolute left-8 right-8 top-1/2 h-px bg-linear-to-r from-transparent via-slate-200 dark:via-slate-800 to-transparent" />
      <div className="absolute top-6 bottom-6 left-1/2 w-px bg-linear-to-b from-transparent via-slate-200 dark:via-slate-800 to-transparent" />
      <span className={`${axis} left-1/2 top-0 -translate-x-1/2`}>扬</span>
      <span className={`${axis} left-1/2 bottom-0 -translate-x-1/2`}>抑</span>
      <span className={`${axis} left-0 top-1/2 -translate-y-1/2`}>暗</span>
      <span className={`${axis} right-0 top-1/2 -translate-y-1/2`}>明</span>

      <div
        className="grid grid-cols-2 gap-y-10"
        onMouseOver={hover.onMouseOver}
        onMouseLeave={hover.onMouseLeave}
      >
        {quadrants.map((list, qi) => (
          <div
            key={qi}
            className="flex flex-wrap justify-center items-center content-center gap-x-6 gap-y-4 min-h-28 px-4"
          >
            {list.map((item, i) => (
              <CloudWord
                key={item.id}
                item={item}
                fontSize={
                  item.e.count === 0
                    ? 0.95
                    : calcFontSize(item.e.share * 100, maxShare * 100, 1, 1.9)
                }
                index={qi * 3 + i}
                rowIndex={i}
                selectedId={null}
                label={`${item.name}，${pct(item.e.share)}`}
              />
            ))}
          </div>
        ))}
      </div>
      <CloudTooltip hover={hover.hover} />
    </div>
  );
}
