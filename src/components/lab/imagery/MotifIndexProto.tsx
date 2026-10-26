"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { Link } from "@/i18n/navigation";
import TopBar from "@/components/shared/topbar/TopBar";
import SiteMark from "@/components/shared/SiteMark";
import type { IndexData, IndexMotif, IndexWord } from "./data";

type View = "motifs" | "words";

/** 字号按作品数的平方根铺开：高频不至于压倒一切，低频也看得见 */
function scale(count: number, max: number, min: number, top: number) {
  return min + (top - min) * Math.sqrt(count / max);
}

export default function MotifIndexProto({
  data,
  initialView,
}: {
  data: IndexData;
  initialView: View;
}) {
  const [view, setView] = useState<View>(initialView);
  const [l1, setL1] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const q = useDeferredValue(query.trim());

  const maxMotif = useMemo(
    () =>
      Math.max(...data.groups.flatMap((g) => g.motifs.map((m) => m.songCount))),
    [data.groups],
  );
  const maxWord = data.words[0]?.songCount ?? 1;

  const groups = data.groups.filter((g) => l1 === null || g.l1 === l1);
  const lit = (m: IndexMotif) =>
    !q || m.name.includes(q) || m.words.some((w) => w.includes(q));
  const litCount = q
    ? groups.reduce((s, g) => s + g.motifs.filter(lit).length, 0)
    : null;

  const words = useMemo(
    () =>
      data.words.filter(
        (w) => (l1 === null || w.l1 === l1) && (!q || w.name.includes(q)),
      ),
    [data.words, l1, q],
  );

  return (
    <div className="min-h-screen bg-[#FAFAFA] dark:bg-[#0B0F19] text-slate-800 dark:text-slate-200">
      <TopBar exit={{ kind: "logo" }} />

      <header className="pt-32 md:pt-40 pb-14 px-6 text-center">
        <h1 className="font-serif text-5xl md:text-7xl text-slate-900 dark:text-slate-50 tracking-[0.3em] pl-[0.3em]">
          意象
        </h1>
        <p className="mt-6 font-kaiti text-base md:text-lg text-slate-500 dark:text-slate-400 tracking-[0.2em]">
          {data.songCount} 首作品 · {data.motifCount} 个母题 ·{" "}
          {data.words.length} 种写法
        </p>
      </header>

      {/* 筛选栏：门类 · 搜索 · 视图 */}
      <div className="sticky top-(--nav-h) z-20 bg-[#FAFAFA]/80 dark:bg-[#0B0F19]/80 backdrop-blur-xl border-b border-slate-200/40 dark:border-slate-800/40">
        <div className="max-w-6xl mx-auto px-6 py-3 flex flex-wrap items-center gap-x-8 gap-y-3">
          <div className="flex items-center gap-6">
            <FilterButton
              label="全部"
              active={l1 === null}
              onClick={() => setL1(null)}
            />
            {data.l1.map((c) => (
              <FilterButton
                key={c.id}
                label={c.name}
                accent={c.accent}
                active={l1 === c.id}
                onClick={() => setL1(l1 === c.id ? null : c.id)}
              />
            ))}
          </div>
          <div className="flex-1 min-w-40">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={
                view === "motifs" ? "找一个词，看它属于哪个母题" : "筛选词"
              }
              className="w-full max-w-72 bg-transparent border-b border-slate-200 dark:border-slate-700 focus:border-(--tone) outline-none py-1 font-serif text-sm placeholder:text-slate-400 dark:placeholder:text-slate-600 placeholder:font-kaiti"
            />
          </div>
          <div className="flex items-center gap-3 text-xs tracking-widest">
            <ViewButton
              label="母题"
              active={view === "motifs"}
              onClick={() => setView("motifs")}
            />
            <span className="w-px h-3 bg-slate-300 dark:bg-slate-700" />
            <ViewButton
              label="全部词"
              active={view === "words"}
              onClick={() => setView("words")}
            />
          </div>
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-6 py-16 min-h-[50vh]">
        {view === "motifs" ? (
          <>
            {litCount !== null && (
              <p className="mb-10 font-kaiti text-sm text-slate-500 dark:text-slate-400">
                {litCount > 0
                  ? `「${q}」见于 ${litCount} 个母题`
                  : `没有母题收了「${q}」这种写法`}
              </p>
            )}
            <div className="space-y-12 md:space-y-14">
              {groups.map((g, gi) => (
                <section key={g.id}>
                  {/* 换门类时起一道题头 */}
                  {g.l1 !== groups[gi - 1]?.l1 && (
                    <L1Heading
                      name={data.l1.find((c) => c.id === g.l1)?.name ?? ""}
                      accent={g.accent}
                      count={groups
                        .filter((x) => x.l1 === g.l1)
                        .reduce((s, x) => s + x.motifs.length, 0)}
                      first={gi === 0}
                    />
                  )}
                  <div className="grid md:grid-cols-[9rem_minmax(0,1fr)] gap-x-10 gap-y-4">
                    <div className="md:pt-2">
                      <h2
                        className="font-serif text-sm font-bold tracking-[0.4em]"
                        style={{ color: g.accent }}
                      >
                        {g.name}
                      </h2>
                      <p className="mt-1 text-xs tracking-[0.2em] text-slate-400 dark:text-slate-500">
                        {g.motifs.length} 个母题
                      </p>
                    </div>
                    <div className="flex flex-wrap items-baseline gap-x-6 gap-y-3">
                      {g.motifs.map((m) => {
                        const on = lit(m);
                        return (
                          <Link
                            key={m.id}
                            href={`/lab/imagery/${m.id}${q && on && !m.name.includes(q) ? `?q=${encodeURIComponent(q)}` : ""}`}
                            title={`${m.name} · ${m.songCount} 首`}
                            className="group relative font-calligraphy leading-none transition-opacity duration-500"
                            style={{
                              fontSize: `${scale(m.songCount, maxMotif, 1.05, 3.4)}rem`,
                              color: g.accent,
                              opacity: on
                                ? 0.45 +
                                  0.55 * Math.sqrt(m.songCount / maxMotif)
                                : 0.08,
                            }}
                          >
                            <span className="group-hover:opacity-100">
                              {m.name}
                            </span>
                            <sup className="ml-0.5 font-sans text-[10px] tracking-normal text-slate-400 dark:text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity">
                              {m.songCount}
                            </sup>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                </section>
              ))}
            </div>
          </>
        ) : (
          <WordCloud words={words} max={maxWord} />
        )}
      </main>

      <footer className="max-w-6xl mx-auto px-6 pb-12">
        <div className="border-t border-slate-200/70 dark:border-slate-800 pt-8 text-center">
          <SiteMark />
        </div>
      </footer>
    </div>
  );
}

function L1Heading({
  name,
  accent,
  count,
  first,
}: {
  name: string;
  accent: string;
  count: number;
  first: boolean;
}) {
  return (
    <div
      className={`flex items-baseline gap-5 mb-10 ${first ? "" : "pt-10 md:pt-14"}`}
    >
      <h2
        className="font-serif text-2xl md:text-3xl tracking-[0.5em]"
        style={{ color: accent }}
      >
        {name}
      </h2>
      <span className="text-xs tracking-[0.2em] text-slate-400 dark:text-slate-500">
        {count} 个母题
      </span>
      <span className="flex-1 h-px bg-slate-200 dark:bg-slate-800 self-center" />
    </div>
  );
}

function WordCloud({ words, max }: { words: IndexWord[]; max: number }) {
  if (words.length === 0) {
    return (
      <p className="py-24 text-center font-kaiti text-sm text-slate-400 dark:text-slate-500">
        没有这样的词
      </p>
    );
  }
  return (
    <>
      <p className="mb-10 text-center text-xs tracking-[0.3em] text-slate-400 dark:text-slate-500">
        {words.length} 个词 · 按写到的作品数排列
      </p>
      <div className="flex flex-wrap justify-center items-baseline gap-x-7 gap-y-4">
        {words.map((w) => (
          <Link
            key={w.id}
            href={`/lab/imagery/${w.motif}?w=${w.id}`}
            title={`${w.name} · ${w.songCount} 首`}
            className="font-calligraphy leading-none opacity-70 hover:opacity-100 transition-opacity"
            style={{
              fontSize: `${scale(w.songCount, max, 0.95, 3)}rem`,
              color: w.accent,
            }}
          >
            {w.name}
          </Link>
        ))}
      </div>
    </>
  );
}

function FilterButton({
  label,
  active,
  accent,
  onClick,
}: {
  label: string;
  active: boolean;
  accent?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`font-serif text-sm tracking-[0.3em] transition-colors ${
        active
          ? "text-slate-900 dark:text-slate-50"
          : "text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
      }`}
      style={active && accent ? { color: accent } : undefined}
    >
      {label}
    </button>
  );
}

function ViewButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? "text-(--tone)"
          : "text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
      }
    >
      {label}
    </button>
  );
}
