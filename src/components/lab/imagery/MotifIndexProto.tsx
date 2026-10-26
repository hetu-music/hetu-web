"use client";

import { useIntersection } from "@/hooks/ui/useIntersection";
import SiteMark from "@/components/shared/SiteMark";
import TopBar from "@/components/shared/topbar/TopBar";
import { GRAY_PALETTE } from "@/lib/imagery/palette";
import { useQuery } from "@tanstack/react-query";
import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  BracketButton,
  CategoryButton,
  HeroMarquee,
  HeroTitle,
  paletteAt,
  seededShuffle,
  VirtualCloud,
  type CloudItem,
} from "./cloud";
import type { IndexData, MotifData } from "./data";
import MotifPanel from "./MotifPanel";

type View = "motifs" | "words";

/**
 * 把面板状态写进网址：/lab/imagery/<母题>?w=<写法>&view=words，可以直接分享；
 * 用原生 history 改，不触发导航。关面板回到 /lab/imagery
 */
function syncUrl(motifId: number | null, word: number | null, view: View) {
  const url = new URL(window.location.href);
  const base = url.pathname.replace(/(\/lab\/imagery)(\/\d+)?\/?$/, "$1");
  url.pathname = motifId === null ? base : `${base}/${motifId}`;
  url.search = "";
  if (motifId !== null && word !== null)
    url.searchParams.set("w", String(word));
  if (view === "words") url.searchParams.set("view", "words");
  window.history.replaceState(window.history.state, "", url);
}

export default function MotifIndexProto({
  data,
  initialView,
  initialMotif,
  initialWord,
}: {
  data: IndexData;
  initialView: View;
  /** 从 /lab/imagery/<母题> 进来时，服务端已取好的面板内容 */
  initialMotif: MotifData | null;
  initialWord: number | null;
}) {
  const [view, setView] = useState<View>(initialView);
  const [l1, setL1] = useState<number | null>(null);
  const [l2, setL2] = useState<number | null>(null);
  const deferredL1 = useDeferredValue(l1);
  const deferredL2 = useDeferredValue(l2);

  // 星：当前词云里亮着的那一个（母题视图是母题，全部词视图是词）
  const [star, setStar] = useState<number | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [side, setSide] = useState<"left" | "right">("right");
  const [motifId, setMotifId] = useState<number | null>(
    initialMotif?.id ?? null,
  );
  const [word, setWord] = useState<number | null>(initialWord);
  const [reveal, setReveal] = useState<{ id: number; key: number } | null>(
    null,
  );

  const [mounted, setMounted] = useState(false);
  const [seed, setSeed] = useState(0);
  const { ref: headerRef, entry } = useIntersection<HTMLElement>({
    threshold: 0.05,
  });

  const motifs = useMemo(() => data.groups.flatMap((g) => g.motifs), [data]);
  const wordMotif = useMemo(
    () => new Map(data.words.map((w) => [w.id, w.motif])),
    [data.words],
  );
  /** 全部词视图里代表一个母题的词：归在它名下、写得最多的那个 */
  const leadWordOf = useCallback(
    (mid: number) => data.words.find((w) => w.motif === mid)?.id ?? null,
    [data.words],
  );

  // 进页：从 /lab/imagery/<母题> 进来的，先点亮、滚到它，再展开面板
  useEffect(() => {
    requestAnimationFrame(() => {
      setMounted(true);
      setSeed(Math.floor(Math.random() * 2147483647));
      if (!initialMotif) return;
      const s =
        initialView === "motifs"
          ? initialMotif.id
          : (initialWord ?? leadWordOf(initialMotif.id));
      if (s !== null) {
        setStar(s);
        setReveal({ id: s, key: Date.now() });
      }
      setPanelOpen(true);
    });
  }, [initialMotif, initialView, initialWord, leadWordOf]);

  const motifQuery = useQuery({
    queryKey: ["lab-motif", motifId],
    queryFn: async (): Promise<MotifData> => {
      const res = await fetch(`/api/lab/motifs/${motifId}`);
      if (!res.ok) throw new Error("母题没取到");
      const body: { motif: MotifData } = await res.json();
      return body.motif;
    },
    enabled: motifId !== null,
    initialData:
      initialMotif && motifId === initialMotif.id ? initialMotif : undefined,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  // ── 词云 ──
  const l2Options = useMemo(
    () =>
      l1 === null
        ? []
        : data.groups
            .filter((g) => g.l1 === l1)
            .map((g) => ({
              id: g.id,
              name: g.name,
              count:
                view === "motifs"
                  ? g.motifs.length
                  : data.words.filter((w) => w.l2 === g.id).length,
            })),
    [data, l1, view],
  );

  const items: CloudItem[] = useMemo(() => {
    const inScope = (x: { l1: number; l2: number }) =>
      deferredL2 !== null
        ? x.l2 === deferredL2
        : deferredL1 === null || x.l1 === deferredL1;
    if (view === "words") {
      return data.words.filter(inScope).map((w) => ({
        id: w.id,
        name: w.name,
        count: w.songCount,
        palette: w.palette,
      }));
    }
    return motifs
      .filter(inScope)
      .sort((a, b) => b.songCount - a.songCount)
      .map((m) => ({
        id: m.id,
        name: m.name,
        count: m.songCount,
        palette: m.palette,
      }));
  }, [data.words, motifs, view, deferredL1, deferredL2]);

  const motifWordCount = useMemo(
    () => new Map(motifs.map((m) => [m.id, m.words.length])),
    [motifs],
  );
  const tooltip = useCallback(
    (item: CloudItem) =>
      view === "motifs"
        ? `${item.count} 首 · ${motifWordCount.get(item.id) ?? 0} 种写法`
        : `${item.count} 首`,
    [view, motifWordCount],
  );

  // ── 交互 ──
  const onSelect = useCallback(
    (id: number, from: "left" | "right") => {
      const mid = view === "motifs" ? id : (wordMotif.get(id) ?? null);
      if (mid === null) return;
      const w = view === "words" ? id : null;
      setSide(from);
      setStar(id);
      setMotifId(mid);
      setWord(w);
      setPanelOpen(true);
      syncUrl(mid, w, view);
    },
    [view, wordMotif],
  );

  const onWord = useCallback(
    (w: number | null) => {
      setWord(w);
      syncUrl(motifId, w, view);
    },
    [motifId, view],
  );

  const onClose = useCallback(() => {
    setPanelOpen(false);
    setStar(null);
    syncUrl(null, null, view);
  }, [view]);

  const switchView = (next: View) => {
    if (next === view) return;
    setView(next);
    setPanelOpen(false);
    setStar(null);
    syncUrl(null, null, next);
  };

  const marqueeRows = useMemo(() => {
    const sample = seededShuffle(data.words, seed)
      .slice(0, 90)
      .map((w) => w.name);
    return [sample.slice(0, 30), sample.slice(30, 60), sample.slice(60, 90)];
  }, [data.words, seed]);

  return (
    <div className="min-h-screen bg-[#FAFAFA] dark:bg-[#0B0F19] text-slate-800 dark:text-slate-200">
      <TopBar exit={{ kind: "logo" }} />

      {/* ── 卷首 ── */}
      <header
        ref={headerRef}
        className="relative overflow-hidden pt-32 pb-12 px-6 text-center"
      >
        <div className="relative z-10">
          <HeroMarquee
            rows={marqueeRows}
            running={entry?.isIntersecting ?? true}
          />
          <HeroTitle
            text="意象"
            mounted={mounted}
            className="font-serif text-5xl md:text-7xl text-slate-800 dark:text-slate-100 mb-4 flex justify-center items-center gap-4 sm:gap-10 drop-shadow-[0_0_30px_rgba(255,255,255,0.05)]"
          />
          <p
            className={`font-kaiti text-base md:text-xl text-slate-500 dark:text-slate-400 tracking-[0.4em] pl-[0.4em] mb-3 ${mounted ? "hero-unroll" : "opacity-0"}`}
            style={{ animationDelay: "1650ms" }}
          >
            {data.motifCount} 个母题 · {data.words.length} 种写法
          </p>
        </div>
      </header>

      {/* ── 筛选 ── */}
      <div className="sticky top-(--nav-h) z-20 bg-[#FAFAFA]/40 dark:bg-[#0B0F19]/40 backdrop-blur-2xl border-b border-slate-200/10 dark:border-slate-800/20 transition-all duration-1000">
        <div className="max-w-5xl mx-auto px-6 py-2.5">
          <div className="flex items-center gap-8 overflow-x-auto no-scrollbar py-1 mask-linear-fade-edges">
            <div className="min-w-2" />
            <CategoryButton
              label="全部"
              isActive={l1 === null}
              onClick={() => {
                setL1(null);
                setL2(null);
              }}
              accentColor={GRAY_PALETTE.accent}
            />
            {data.l1.map((c) => {
              const active = l1 === c.id;
              return (
                <div key={c.id} className="flex items-center gap-8">
                  <div className="w-[0.5px] h-3 bg-slate-200/50 dark:bg-slate-800/30 rotate-12" />
                  <CategoryButton
                    label={c.name}
                    isActive={active}
                    onClick={() => {
                      setL1(active ? null : c.id);
                      setL2(null);
                    }}
                    accentColor={paletteAt(c.palette).accent}
                  />
                </div>
              );
            })}
            {/* 视图：母题 / 全部词 */}
            <div className="ml-auto flex items-center gap-2 pl-6">
              <BracketButton
                label="母题"
                size="text-[13px]"
                isActive={view === "motifs"}
                onClick={() => switchView("motifs")}
                accentColor={GRAY_PALETTE.accent}
              />
              <BracketButton
                label="全部词"
                size="text-[13px]"
                isActive={view === "words"}
                onClick={() => switchView("words")}
                accentColor={GRAY_PALETTE.accent}
              />
            </div>
            <div className="min-w-2" />
          </div>

          <div
            className={`grid transition-[grid-template-rows,opacity,margin] duration-1000 ease-[cubic-bezier(0.19,1,0.22,1)] ${l2Options.length > 0 ? "grid-rows-[1fr] opacity-100 mt-2" : "grid-rows-[0fr] opacity-0 mt-0"}`}
          >
            <div className="overflow-hidden">
              <div className="grid grid-cols-3 sm:flex sm:items-center gap-y-4 gap-x-6 sm:gap-6 sm:flex-wrap pt-3 border-t border-slate-200/20 dark:border-slate-800/10">
                <div className="hidden sm:block min-w-2" />
                {l2Options.map((c) => (
                  <BracketButton
                    key={c.id}
                    label={c.name}
                    count={c.count}
                    isActive={l2 === c.id}
                    onClick={() => setL2(l2 === c.id ? null : c.id)}
                    accentColor={
                      paletteAt(data.l1.find((x) => x.id === l1)?.palette ?? -1)
                        .accent
                    }
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── 词云 ── */}
      <main
        key={view}
        className={`max-w-5xl mx-auto px-8 py-16 min-h-[40vh] ${mounted ? "" : "opacity-0"}`}
        style={
          mounted
            ? {
                animation: "main-fade-in 1s ease-out both",
                animationDelay: "200ms",
              }
            : undefined
        }
      >
        <VirtualCloud
          items={items}
          selectedId={panelOpen ? star : null}
          onSelect={onSelect}
          tooltip={tooltip}
          reveal={reveal}
          onReveal={setSide}
        />
        <div className="mt-12 flex justify-center">
          <p className="text-xs text-slate-300 dark:text-slate-700 tracking-[0.2em] select-none font-serif">
            {view === "motifs"
              ? `共 ${items.length} 个母题`
              : `共 ${items.length} 种写法`}
          </p>
        </div>
      </main>

      <footer className="max-w-5xl mx-auto px-8 pb-12">
        <div className="border-t border-slate-100 dark:border-slate-800 pt-8 text-center">
          <SiteMark />
        </div>
      </footer>

      <MotifPanel
        open={panelOpen}
        side={side}
        motif={motifQuery.data ?? null}
        loading={motifQuery.isPending}
        word={word}
        onWord={onWord}
        onClose={onClose}
      />
    </div>
  );
}
