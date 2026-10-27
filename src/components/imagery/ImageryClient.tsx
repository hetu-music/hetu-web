"use client";

import SiteMark from "@/components/shared/SiteMark";
import TopBar from "@/components/shared/topbar/TopBar";
import { useIntersection } from "@/hooks/ui/useIntersection";
import { GRAY_PALETTE } from "@/lib/imagery/palette";
import type { ImageryCloud, MotifDetail } from "@/lib/types";
import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
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
  type CloudHandle,
  type CloudItem,
} from "./cloud";
import ImageryPanel from "./ImageryPanel";
import ViewSwitch, {
  GLIDE_MS,
  prefersReducedMotion,
  type CloudView as View,
} from "./ViewSwitch";

const MARQUEE_SAMPLE_SIZE = 90;

/**
 * 把面板状态写进网址：/imagery/<母题>?w=<具象>&view=words，可以直接分享；
 * 用原生 history 改，不触发导航。关面板回到 /imagery
 */
function syncUrl(motifId: number | null, word: number | null, view: View) {
  const url = new URL(window.location.href);
  const base = url.pathname.replace(/(\/imagery)(\/\d+)?\/?$/, "$1");
  url.pathname = motifId === null ? base : `${base}/${motifId}`;
  url.search = "";
  if (motifId !== null && word !== null)
    url.searchParams.set("w", String(word));
  if (view === "words") url.searchParams.set("view", "words");
  window.history.replaceState(window.history.state, "", url);
}

export default function ImageryClient({
  cloud,
  initialMotif,
}: {
  cloud: ImageryCloud;
  /** 从 /imagery/<母题> 进来时，服务端已取好的面板内容 */
  initialMotif: MotifDetail | null;
}) {
  const t = useTranslations("common.imagery");
  const locale = useLocale();
  const [view, setView] = useState<View>("motifs");
  const [l1, setL1] = useState<number | null>(null);
  const [l2, setL2] = useState<number | null>(null);
  const deferredL1 = useDeferredValue(l1);
  const deferredL2 = useDeferredValue(l2);

  // 星：词云里亮着的那一个（母题视图是母题，具象视图是词）
  const [star, setStar] = useState<number | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [side, setSide] = useState<"left" | "right">("right");
  const [motifId, setMotifId] = useState<number | null>(
    initialMotif?.id ?? null,
  );
  const [word, setWord] = useState<number | null>(null);
  const [reveal, setReveal] = useState<{ id: number; key: number } | null>(
    null,
  );
  // 切换视图：下划线在滑、旧词云在离场时记着要去的视图；换过一次之后新词云从每行中间展开
  const [switching, setSwitching] = useState<View | null>(null);
  const [bloom, setBloom] = useState(false);
  const cloudHandle = useRef<CloudHandle>(null);

  const [mounted, setMounted] = useState(false);
  const [seed, setSeed] = useState(0);
  const { ref: headerRef, entry } = useIntersection<HTMLElement>({
    threshold: 0.05,
  });

  const motifs = useMemo(() => cloud.groups.flatMap((g) => g.motifs), [cloud]);
  const wordMotif = useMemo(
    () => new Map(cloud.words.map((w) => [w.id, w.motif])),
    [cloud.words],
  );

  // 进页。?view 与 ?w 在浏览器里读，页面才能整页缓存：
  // - /imagery/<母题>：点亮它、滚过去、展开面板；?w 是预先选中的具象
  // - /imagery?w=<词>：旧链接，打开这个词所属的母题
  useEffect(() => {
    requestAnimationFrame(() => {
      setMounted(true);
      setSeed(Math.floor(Math.random() * 2147483647));
      const params = new URLSearchParams(window.location.search);
      const v: View = params.get("view") === "words" ? "words" : "motifs";
      const w = Number(params.get("w")) || null;
      setView(v);

      const mid = initialMotif?.id ?? (w !== null ? wordMotif.get(w) : null);
      if (mid == null) return;
      const pick =
        w !== null &&
        (!initialMotif || initialMotif.words.some((x) => x.id === w))
          ? w
          : null;
      // 具象视图里代表母题的词：选中的具象，或归在它名下、写得最多的那个
      const s =
        v === "motifs"
          ? mid
          : (pick ?? cloud.words.find((x) => x.motif === mid)?.id ?? null);
      setMotifId(mid);
      setWord(pick);
      if (s !== null) {
        setStar(s);
        setReveal({ id: s, key: Date.now() });
      }
      setPanelOpen(true);
      syncUrl(mid, pick, v);
    });
  }, [initialMotif, wordMotif, cloud.words]);

  const motifQuery = useQuery({
    queryKey: ["imagery", "motif", motifId, locale],
    queryFn: async (): Promise<MotifDetail> => {
      const query = locale === "zh-TW" ? "?locale=zh-TW" : "";
      const res = await fetch(`/api/imagery/motifs/${motifId}${query}`);
      if (!res.ok) throw new Error(t("panel.loadError"));
      const body: { motif: MotifDetail } = await res.json();
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
        : cloud.groups
            .filter((g) => g.l1 === l1)
            .map((g) => ({ id: g.id, name: g.name })),
    [cloud, l1],
  );

  const items: CloudItem[] = useMemo(() => {
    const inScope = (x: { l1: number; l2: number }) =>
      deferredL2 !== null
        ? x.l2 === deferredL2
        : deferredL1 === null || x.l1 === deferredL1;
    if (view === "words") {
      return cloud.words.filter(inScope).map((w) => ({
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
  }, [cloud.words, motifs, view, deferredL1, deferredL2]);

  const motifWordCount = useMemo(
    () => new Map(motifs.map((m) => [m.id, m.wordCount])),
    [motifs],
  );
  const tooltip = useCallback(
    (item: CloudItem) =>
      view === "motifs"
        ? t("motifTooltip", {
            count: item.count,
            words: motifWordCount.get(item.id) ?? 0,
          })
        : t("wordTooltip", { count: item.count }),
    [view, motifWordCount, t],
  );
  const ariaLabel = useCallback(
    (item: CloudItem) => t("ariaLabel", { name: item.name, count: item.count }),
    [t],
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

  /**
   * 换视图：副标题的下划线滑过去的同时，词云里看得到的词散开（去具象）或收拢（回母题），
   * 两样都完了再换上新词云，新词云每行从中间往两边展开。系统要求减少动态效果时直接换
   */
  const switchView = (next: View) => {
    if (next === view || switching) return;
    setPanelOpen(false);
    setStar(null);
    const apply = () => {
      setSwitching(null);
      setBloom(true);
      // 进页时的「滚到这个母题」只对当时的词云有效。新词云换了 key 重新挂载，
      // 不清掉会再滚一次，而且拿母题 id 去具象里找，滚到一个同号的不相干的词
      setReveal(null);
      setView(next);
      syncUrl(null, null, next);
    };
    if (prefersReducedMotion()) {
      apply();
      return;
    }
    setSwitching(next);
    Promise.all([
      cloudHandle.current?.exit(next === "words" ? "scatter" : "gather"),
      new Promise((resolve) => setTimeout(resolve, GLIDE_MS)),
    ]).then(apply);
  };

  // 卷首背后滚动的字幕是另一层：看母题时背后是具象，看具象时背后是母题
  const marqueeRows = useMemo(() => {
    const names =
      view === "motifs"
        ? cloud.words.map((w) => w.name)
        : motifs.map((m) => m.name);
    const sample = seededShuffle(names, seed).slice(0, MARQUEE_SAMPLE_SIZE);
    return [sample.slice(0, 30), sample.slice(30, 60), sample.slice(60, 90)];
  }, [cloud.words, motifs, view, seed]);

  return (
    <div className="min-h-screen bg-[#FAFAFA] dark:bg-[#0B0F19] text-slate-800 dark:text-slate-200">
      <TopBar exit={{ kind: "logo" }} />

      {/* ── hero ── */}
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
            text={t("title")}
            mounted={mounted}
            className="font-serif text-5xl md:text-7xl text-slate-800 dark:text-slate-100 mb-4 flex justify-center items-center gap-4 sm:gap-10 drop-shadow-[0_0_30px_rgba(255,255,255,0.05)]"
          />
          <ViewSwitch
            active={switching ?? view}
            counts={{ motifs: cloud.motifCount, words: cloud.words.length }}
            onChoose={switchView}
            className={`font-kaiti text-base md:text-xl tracking-[0.4em] pl-[0.4em] mb-3 ${mounted ? "hero-unroll" : "opacity-0"}`}
            style={{ animationDelay: "1650ms" }}
          />
        </div>
      </header>

      {/* ── category filter ── */}
      <div className="sticky top-(--nav-h) z-20 bg-[#FAFAFA]/40 dark:bg-[#0B0F19]/40 backdrop-blur-2xl border-b border-slate-200/10 dark:border-slate-800/20 transition-all duration-1000">
        <div className="max-w-5xl mx-auto px-6 py-2.5">
          <div className="flex items-center gap-8 overflow-x-auto no-scrollbar py-1 mask-linear-fade-edges">
            <div className="min-w-2" />
            <CategoryButton
              label={t("all")}
              isActive={l1 === null}
              onClick={() => {
                setL1(null);
                setL2(null);
              }}
              accentColor={GRAY_PALETTE.accent}
            />
            {cloud.l1.map((c) => {
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
            <div className="min-w-2" />
          </div>

          {/* L2 sub-filter row */}
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
                    isActive={l2 === c.id}
                    onClick={() => setL2(l2 === c.id ? null : c.id)}
                    accentColor={
                      paletteAt(
                        cloud.l1.find((x) => x.id === l1)?.palette ?? -1,
                      ).accent
                    }
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── cloud ── */}
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
        {items.length === 0 ? (
          <div className="text-center font-kaiti text-sm py-24 text-slate-400 dark:text-slate-500">
            {t("noData")}
          </div>
        ) : (
          <>
            <VirtualCloud
              ref={cloudHandle}
              items={items}
              selectedId={panelOpen ? star : null}
              onSelect={onSelect}
              tooltip={tooltip}
              ariaLabel={ariaLabel}
              reveal={reveal}
              onReveal={setSide}
              bloom={bloom}
            />
            <div className="mt-12 flex justify-center">
              <p className="text-xs text-slate-300 dark:text-slate-700 tracking-[0.2em] select-none font-serif">
                {view === "motifs"
                  ? t("motifTotal", { count: items.length })
                  : t("wordTotal", { count: items.length })}
              </p>
            </div>
          </>
        )}
      </main>

      <footer className="max-w-5xl mx-auto px-8 pb-12">
        <div className="border-t border-slate-100 dark:border-slate-800 pt-8 text-center">
          <SiteMark />
        </div>
      </footer>

      <ImageryPanel
        open={panelOpen}
        side={side}
        motif={motifQuery.data ?? null}
        loading={motifQuery.isPending}
        error={motifQuery.isError}
        word={word}
        onWord={onWord}
        onClose={onClose}
      />
    </div>
  );
}
