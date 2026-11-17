"use client";

/**
 * 河图志「青绿金线」原型（/lab/places）：three.js 画青绿山体与泥金的河，开场「溯洄」，
 * 选中一处时镜头飞过去、同曲地点之间升起金色弧线、词句用金色大字竖排。
 * 场景在 engine.ts；这里只管开场的跳过、卷首与选中后的面板。手机与宽屏同一套场景。
 */

import TopBar from "@/components/shared/topbar/TopBar";
import { GROUPS, RIVERS, STATIONS } from "@/components/places/layout";
import { useMediaQuery } from "@/hooks/ui/useMediaQuery";
import { Link } from "@/i18n/navigation";
import type { Place } from "@/lib/places/types";
import { AnimatePresence, motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PlacesEngine, type EngineStop, type EngineText } from "./engine";

const EASE = [0.23, 1, 0.32, 1] as const;
const GOLD_TEXT =
  "bg-linear-to-b from-[#fff1c9] via-[#ecc56f] to-[#b98a35] bg-clip-text text-transparent";

/** 一句按空格与句读切开，每个短语一列 */
function phrases(line: string): string[] {
  return line.split(/[，。、！？\s]+/).filter(Boolean);
}

export default function QinglvClient({ places }: { places: Place[] }) {
  const t = useTranslations("places");
  const narrow = useMediaQuery("(max-width: 1023px)");
  const reduce = useMediaQuery("(prefers-reduced-motion: reduce)");
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const layerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<PlacesEngine | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [introDone, setIntroDone] = useState(false);

  const placeById = useMemo(
    () => new Map(places.map((p) => [p.id, p])),
    [places],
  );
  const stops = useMemo<EngineStop[]>(
    () =>
      STATIONS.flatMap((s) => {
        const place = placeById.get(s.id);
        return place
          ? [{ ...s, name: place.name, weight: place.entries.length }]
          : [];
      }),
    [placeById],
  );
  const texts = useMemo<EngineText[]>(
    () => [
      ...RIVERS.flatMap((r): EngineText[] =>
        r.label && !r.label.vertical
          ? [
              {
                text: r.name,
                x: r.label.x,
                y: r.label.y,
                kind: r.label.large ? "river-large" : "river",
                river: r.id,
              },
            ]
          : [],
      ),
      ...GROUPS.map((g): EngineText => ({
        text: g.name,
        x: g.x,
        y: g.y + 40,
        kind: "group",
      })),
    ],
    [],
  );
  const songCount = useMemo(
    () => new Set(places.flatMap((p) => p.entries.map((e) => e.songId))).size,
    [places],
  );

  const siblingsOf = useCallback(
    (place: Place) => {
      const songs = new Set(place.entries.map((e) => e.songId));
      return places.filter(
        (p) => p.id !== place.id && p.entries.some((e) => songs.has(e.songId)),
      );
    },
    [places],
  );

  // 场景只在客户端建；窄屏、减弱动画变了就重建（水合后各变一次）
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    const layer = layerRef.current;
    if (!container || !canvas || !layer) return;
    const engine = new PlacesEngine(container, canvas, layer, stops, texts, RIVERS, {
      portrait: narrow,
      reduce,
      onSelect: (id) => setSelectedId(id),
      onIntroEnd: () => setIntroDone(true),
    });
    engineRef.current = engine;
    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, [stops, texts, narrow, reduce]);

  const selected = selectedId !== null ? (placeById.get(selectedId) ?? null) : null;

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    if (!selected) {
      engine.setSelection(null, new Set(), []);
      return;
    }
    const kin = new Set(siblingsOf(selected).map((p) => p.id));
    const pairs: [number, number][] = [];
    for (const songId of new Set(selected.entries.map((e) => e.songId))) {
      const along = stops.filter((s) =>
        placeById.get(s.id)?.entries.some((e) => e.songId === songId),
      );
      for (let i = 1; i < along.length; i++) pairs.push([along[i - 1].id, along[i].id]);
    }
    engine.setSelection(selected.id, kin, pairs);
  }, [selected, siblingsOf, stops, placeById]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelectedId(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const count = t("count", { places: places.length, songs: songCount });

  return (
    // 整页是夜色的青绿山水，顶栏也跟着走深色
    <div className="dark fixed inset-0 overflow-hidden bg-[#04121a] text-[#f5ecd2] [--tone:#e9c26b]">
      <TopBar exit={{ kind: "logo" }} />

      <div ref={containerRef} className="absolute inset-0">
        <canvas ref={canvasRef} className="block h-full w-full touch-none" />
        <div
          ref={layerRef}
          className="pointer-events-none absolute inset-0 overflow-hidden"
        />
      </div>

      {/* 开场 */}
      <AnimatePresence>
        {!introDone && (
          <motion.button
            type="button"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { delay: 1 } }}
            exit={{ opacity: 0 }}
            onClick={() => engineRef.current?.skipIntro()}
            className="absolute right-6 bottom-8 z-10 text-xs tracking-[0.4em] text-[#e9c26b]/70 transition-colors hover:text-[#ffe3a0]"
          >
            跳过
          </motion.button>
        )}
      </AnimatePresence>

      {/* 卷首：全图时显示 */}
      <AnimatePresence>
        {introDone && !selected && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.9, ease: EASE }}
            className="pointer-events-none absolute z-10 max-lg:bottom-8 max-lg:left-6 lg:bottom-14 lg:left-14"
          >
            <p className="mb-4 text-[11px] tracking-[0.6em] text-[#e9c26b]/70 max-lg:hidden">
              溯洄从之
            </p>
            <h1
              className={`font-calligraphy leading-none [writing-mode:vertical-rl] text-5xl lg:text-9xl ${GOLD_TEXT} drop-shadow-[0_0_24px_rgba(233,194,107,0.35)]`}
            >
              {t("title")}
            </h1>
            <p className="mt-6 font-kaiti text-base leading-loose text-[#f5ecd2]/80 max-lg:hidden lg:text-lg">
              {t("tagline")}
            </p>
            <p className="mt-3 text-[11px] tracking-[0.3em] text-[#e9c26b]/70 max-lg:mt-4">
              {count}
              <span className="max-lg:hidden"> · {t("credit")}</span>
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 选中一处 */}
      <AnimatePresence mode="wait">
        {selected && (
          <motion.aside
            key={selected.id}
            initial={narrow ? { opacity: 0, y: 40 } : { opacity: 0, x: -24 }}
            animate={narrow ? { opacity: 1, y: 0 } : { opacity: 1, x: 0 }}
            exit={narrow ? { opacity: 0, y: 40 } : { opacity: 0, x: -24 }}
            transition={{ duration: 0.6, ease: EASE }}
            className={
              narrow
                ? "absolute inset-x-0 bottom-0 z-20 max-h-[62svh] overflow-y-auto rounded-t-2xl border-t border-[#e9c26b]/25 bg-[#04121a]/88 px-6 pt-6 pb-10 backdrop-blur-md"
                : "absolute top-0 bottom-0 left-0 z-20 flex w-[34rem] flex-col justify-end bg-linear-to-r from-[#04121a]/95 via-[#04121a]/75 to-transparent px-14 pt-28 pb-14"
            }
          >
            <SelectedBody
              place={selected}
              siblings={siblingsOf(selected)}
              narrow={narrow}
              onGo={setSelectedId}
              onClose={() => setSelectedId(null)}
            />
          </motion.aside>
        )}
      </AnimatePresence>
    </div>
  );
}

function SelectedBody({
  place,
  siblings,
  narrow,
  onGo,
  onClose,
}: {
  place: Place;
  siblings: Place[];
  narrow: boolean;
  onGo: (id: number) => void;
  onClose: () => void;
}) {
  const t = useTranslations("places");
  const withVerses = place.entries.filter((e) => e.verses.length > 0);
  return (
    <>
      <div className="flex items-baseline justify-between gap-4">
        <p className="text-[11px] tracking-[0.4em] text-[#e9c26b]/75">
          {place.region}
        </p>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 text-xs tracking-[0.3em] text-[#f5ecd2]/50 transition-colors hover:text-[#ffe3a0]"
        >
          全图
        </button>
      </div>
      <h2 className="mt-3 font-serif text-3xl font-semibold tracking-tight text-[#fbf4df] lg:text-5xl">
        {place.fullName ?? place.name}
      </h2>

      {withVerses.length > 0 && (
        <div
          className={`mt-8 flex flex-row-reverse justify-end gap-x-10 overflow-hidden ${narrow ? "max-h-60" : "max-h-[min(34rem,58svh)]"}`}
        >
          {withVerses.map((entry) => (
            <div
              key={`${entry.songId}-${entry.relation}`}
              className="flex flex-col flex-wrap-reverse gap-x-4 [writing-mode:vertical-rl]"
            >
              {entry.verses.map((verse) => (
                <Link
                  key={verse.index}
                  href={`/song/${entry.songId}?line=${verse.index}`}
                  className={`block font-calligraphy leading-[1.3] tracking-[0.14em] ${narrow ? "text-[1.5rem]" : "text-[2.2rem]"} ${GOLD_TEXT} drop-shadow-[0_0_18px_rgba(233,194,107,0.3)] transition-opacity hover:opacity-80`}
                >
                  {phrases(verse.text).map((p, i) => (
                    <span key={i} className="block">
                      {p}
                    </span>
                  ))}
                </Link>
              ))}
            </div>
          ))}
        </div>
      )}

      <div className="mt-8 space-y-3">
        {place.entries.map((entry) => (
          <div key={`${entry.songId}-${entry.relation}`}>
            <p className="font-serif text-base text-[#fbf4df]">
              {entry.relation === "venue" && (
                <span className="mr-2 text-[11px] tracking-[0.3em] text-[#e9c26b]/70">
                  {t("venue")}
                </span>
              )}
              <Link
                href={`/song/${entry.songId}`}
                className="transition-colors hover:text-[#ffe3a0]"
              >
                《{entry.title}》
              </Link>
            </p>
            {entry.note && (
              <p className="mt-1 font-kaiti text-sm leading-relaxed text-[#f5ecd2]/60">
                {entry.note}
              </p>
            )}
          </div>
        ))}
        {siblings.length > 0 && (
          <p className="pt-2 text-xs leading-loose tracking-[0.25em] text-[#f5ecd2]/45">
            {t("siblings")}
            {siblings.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => onGo(s.id)}
                className="ml-3 text-[#e9c26b] transition-colors hover:text-[#ffe3a0]"
              >
                {s.name}
              </button>
            ))}
          </p>
        )}
      </div>
    </>
  );
}
