"use client";

/**
 * 方案一移动端 · M3「画意水脉目录」（把水系目录本身升格成一卷山水图谱）
 *
 * 以「从入海口往上读」的树形水系为骨架，但把直挺挺的列表边线换成真实蜿蜒的书法水脉，
 * 背后衬宣纸与极淡远山剪影；每处地标配古图符号与一行楷体代表句微引，点开就地展开竖排词句。
 */

import { TREE, type TreeNode } from "@/components/places/layout";
import type { Place } from "@/lib/places/types";
import { useCallback, useMemo, useState } from "react";
import {
  PlaceGlyph,
  PlaceReadingBody,
  SealStamp,
  brushRiverPath,
  glyphOf,
  inkMountainPath,
} from "./shared";

function treeIds(nodes: TreeNode[], out = new Set<number>()): Set<number> {
  for (const node of nodes) {
    if (typeof node === "number") out.add(node);
    else treeIds(node.nodes, out);
  }
  return out;
}

function shortRegion(place: Place): string {
  const parts = place.region.split(" · ");
  const rest = parts.slice(1).filter((p) => p !== place.name);
  return rest.length > 0 ? rest.join(" · ") : parts[0];
}

/** 挑一句最短小精悍的代表句作为列表微引 */
function previewLine(place: Place): string | null {
  for (const e of place.entries) {
    if (e.verses[0]?.text) {
      return `「${e.verses[0].text}」 · 《${e.title}》`;
    }
  }
  const first = place.entries[0];
  return first ? `《${first.title}》` : null;
}

/** 每条水系左侧贯穿的蜿蜒书法水脉 SVG（随列表高度自适应伸展） */
function OrganicRiverSpine({ variant = 0 }: { variant?: number }) {
  const path = useMemo(() => {
    const dir = variant % 2 === 0 ? 1 : -1;
    return brushRiverPath(
      [
        [14, 0],
        [14 + dir * 5, 110],
        [14 - dir * 4, 240],
        [14 + dir * 4.5, 370],
        [14, 500],
      ],
      4.4,
      1.2,
      { subdivisions: 10 },
    );
  }, [variant]);

  return (
    <svg
      viewBox="0 0 28 500"
      preserveAspectRatio="none"
      aria-hidden
      className="pointer-events-none absolute top-1 bottom-2 left-0 w-7"
    >
      <path d={path} fill="var(--river)" opacity={0.48} />
    </svg>
  );
}

function RiverNodes({
  nodes,
  placeById,
  siblingsOf,
  openId,
  kin,
  depth = 0,
  onToggle,
  onGo,
}: {
  nodes: TreeNode[];
  placeById: Map<number, Place>;
  siblingsOf: (place: Place) => Place[];
  openId: number | null;
  kin: Set<number>;
  depth?: number;
  onToggle: (id: number) => void;
  onGo: (id: number) => void;
}) {
  return (
    <ul className="space-y-1">
      {nodes.map((node, idx) => {
        if (typeof node !== "number") {
          return (
            <li key={node.river} className="relative py-3 pl-7">
              {/* 从干流弯出的支流水弧 */}
              <svg
                viewBox="0 0 28 24"
                aria-hidden
                className="pointer-events-none absolute top-4 left-0 h-6 w-7"
              >
                <path
                  d="M 14 0 Q 14 14 26 14"
                  fill="none"
                  stroke="var(--river)"
                  strokeWidth={1.2}
                  strokeLinecap="round"
                  opacity={0.45}
                />
              </svg>
              <p className="mb-2 font-serif text-xs tracking-[0.32em] text-(--river)">
                {node.river}
              </p>
              <div className="relative pl-6">
                <OrganicRiverSpine variant={idx + depth + 1} />
                <RiverNodes
                  nodes={node.nodes}
                  placeById={placeById}
                  siblingsOf={siblingsOf}
                  openId={openId}
                  kin={kin}
                  depth={depth + 1}
                  onToggle={onToggle}
                  onGo={onGo}
                />
              </div>
            </li>
          );
        }

        const place = placeById.get(node);
        if (!place) return null;
        const open = openId === node;
        const isKin = kin.has(node);
        const lit = open || isKin;
        const snippet = previewLine(place);

        return (
          <li
            key={node}
            id={`m3-place-${node}`}
            className="relative scroll-mt-24 pl-7"
          >
            {/* 节点上的古图地标符，直接「长」在水脉旁 */}
            <svg
              viewBox="-10 -10 20 20"
              aria-hidden
              className="pointer-events-none absolute top-3.5 left-1.5 h-4 w-4 overflow-visible"
            >
              <PlaceGlyph
                kind={glyphOf(place.id)}
                x={0}
                y={0}
                active={open}
                kin={isKin}
                scale={lit ? 1.1 : 0.95}
              />
            </svg>

            <button
              type="button"
              aria-expanded={open}
              onClick={() => onToggle(node)}
              className="group w-full cursor-pointer py-2 text-left"
            >
              <div className="flex items-baseline justify-between gap-3">
                <span
                  className={`font-serif text-[16px] transition-colors ${
                    open
                      ? "font-semibold text-(--seal)"
                      : isKin
                        ? "text-(--seal)"
                        : "text-(--ink)"
                  }`}
                >
                  {place.name}
                </span>
                <span className="shrink-0 text-[11px] tracking-[0.18em] text-(--ink-muted)">
                  {shortRegion(place)}
                </span>
              </div>
              {!open && snippet && (
                <p className="mt-0.5 truncate font-kaiti text-xs text-(--ink-muted)/80">
                  {snippet}
                </p>
              )}
            </button>

            {/* 就地优雅展开的竖排诗文 */}
            <div
              className={`grid transition-[grid-template-rows] duration-500 ease-page ${
                open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
              }`}
            >
              <div className="min-h-0 overflow-hidden">
                {open && (
                  <div className="mt-2 mb-5 border-l border-(--seal)/25 pl-4">
                    <PlaceReadingBody
                      place={place}
                      siblings={siblingsOf(place)}
                      onGo={onGo}
                      compact
                    />
                  </div>
                )}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export default function MobileRiverCatalog({
  places,
  placeById,
  siblingsOf,
  selectedId,
  kin,
  title,
  tagline,
  countText,
  creditText,
  elsewhereLabel,
  onToggle,
  onGo,
}: {
  places: Place[];
  placeById: Map<number, Place>;
  siblingsOf: (place: Place) => Place[];
  selectedId: number | null;
  kin: Set<number>;
  title: string;
  tagline: string;
  countText: string;
  creditText: string;
  elsewhereLabel: string;
  onToggle: (id: number) => void;
  onGo: (id: number) => void;
}) {
  const [query, setQuery] = useState("");

  const tree = useMemo(() => {
    const listed = treeIds(TREE.flatMap((s) => s.nodes));
    const rest = places.filter((p) => !listed.has(p.id)).map((p) => p.id);
    return rest.length > 0
      ? [...TREE, { river: elsewhereLabel, nodes: rest }]
      : TREE;
  }, [places, elsewhereLabel]);

  const bgMountain1 = useMemo(
    () =>
      inkMountainPath(
        [
          [0, 120],
          [85, 58],
          [175, 82],
          [265, 42],
          [355, 76],
          [420, 118],
        ],
        180,
      ),
    [],
  );

  const jumpInside = useCallback(
    (id: number) => {
      onGo(id);
      requestAnimationFrame(() => {
        document
          .getElementById(`m3-place-${id}`)
          ?.scrollIntoView({ behavior: "smooth", block: "center" });
      });
    },
    [onGo],
  );

  const trimmed = query.trim();
  const filtered = useMemo(() => {
    if (!trimmed) return null;
    return places.filter(
      (p) =>
        p.name.includes(trimmed) ||
        (p.fullName?.includes(trimmed) ?? false) ||
        p.region.includes(trimmed) ||
        p.entries.some((e) => e.title.includes(trimmed)),
    );
  }, [places, trimmed]);

  return (
    <div className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain">
      {/* 顶部淡墨远山剪影背景，烘托卷首气息 */}
      <svg
        viewBox="0 0 420 180"
        preserveAspectRatio="none"
        aria-hidden
        className="pointer-events-none absolute top-0 right-0 left-0 h-44 w-full opacity-35"
      >
        <defs>
          <linearGradient id="m3-bg-mtn" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--mtn-2)" stopOpacity="0.65" />
            <stop offset="70%" stopColor="var(--mtn-2)" stopOpacity="0.16" />
            <stop offset="100%" stopColor="var(--mtn-2)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={bgMountain1} fill="url(#m3-bg-mtn)" />
      </svg>

      <div className="relative mx-auto max-w-lg px-5 pt-7 pb-20">
        {/* 卷首 */}
        <header className="mb-8">
          <div className="flex items-end gap-3.5">
            <h1 className="font-calligraphy text-6xl leading-none text-(--ink) [writing-mode:vertical-rl]">
              {title}
            </h1>
            <div className="pb-1">
              <SealStamp text="溯洄" className="mb-3" />
              <p className="font-kaiti text-base leading-relaxed text-(--ink-muted)">
                {tagline}
              </p>
              <p className="mt-2 text-[11px] tracking-[0.24em] text-(--ink-muted)/80">
                {countText} · {creditText}
              </p>
            </div>
          </div>

          {/* 书卷式单底线检索 */}
          <div className="mt-7 flex items-baseline gap-3 border-b border-(--ink)/18 pb-2">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="寻一处山川、城邑或歌名…"
              className="w-full bg-transparent font-kaiti text-sm text-(--ink) placeholder:text-(--ink-muted)/70 focus:outline-none"
            />
            {trimmed && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="shrink-0 text-xs tracking-[0.2em] text-(--ink-muted)"
              >
                清空
              </button>
            )}
          </div>
        </header>

        {/* 搜索态 vs 蜿蜒水脉目录态 */}
        {filtered ? (
          filtered.length > 0 ? (
            <ul className="divide-y divide-(--ink)/10">
              {filtered.map((p) => {
                const open = selectedId === p.id;
                return (
                  <li key={p.id} className="py-2">
                    <button
                      type="button"
                      onClick={() => onToggle(p.id)}
                      className="flex w-full cursor-pointer items-baseline justify-between gap-3 py-1.5 text-left"
                    >
                      <span
                        className={`font-serif text-base ${
                          open ? "font-semibold text-(--seal)" : "text-(--ink)"
                        }`}
                      >
                        {p.fullName ?? p.name}
                      </span>
                      <span className="shrink-0 text-[11px] tracking-[0.18em] text-(--ink-muted)">
                        {shortRegion(p)}
                      </span>
                    </button>
                    {open && (
                      <div className="mt-3 pb-3 pl-3">
                        <PlaceReadingBody
                          place={p}
                          siblings={siblingsOf(p)}
                          onGo={jumpInside}
                          compact
                        />
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="py-12 text-center font-kaiti text-sm text-(--ink-muted)">
              水系间未见此地。
            </p>
          )
        ) : (
          <div className="space-y-12">
            {tree.map((section, idx) => (
              <section key={section.river}>
                <div className="mb-3 flex items-center gap-3">
                  <h2 className="font-calligraphy text-3xl leading-none text-(--river)">
                    {section.river}
                  </h2>
                  <span
                    aria-hidden
                    className="h-px flex-1 bg-linear-to-r from-(--river)/30 to-transparent"
                  />
                </div>
                <div className="relative">
                  <OrganicRiverSpine variant={idx} />
                  <RiverNodes
                    nodes={section.nodes}
                    placeById={placeById}
                    siblingsOf={siblingsOf}
                    openId={selectedId}
                    kin={kin}
                    onToggle={onToggle}
                    onGo={jumpInside}
                  />
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
