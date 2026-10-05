"use client";

import { FIELD_LABEL_CLASS } from "@/components/shared/form-field";
import { Slider } from "@/components/ui/slider";
import type { Song } from "@/lib/types";
import { cn } from "@/lib/utils/utils";
import { useMemo, useState } from "react";
import {
  CREDIT_ROLES,
  type CreditRole,
  type Lamp,
  type LampTester,
  lampKey,
  ROLE_LABEL,
} from "./lamps";

export interface ChartImagery {
  id: number;
  name: string;
  accent: string;
  count: number;
}

/** 灯谱里列出的意象数、每个角色先列出的名字数 */
const CHART_IMAGERY = 36;
const CHART_NAMES = 10;

/** 按出现次数排的取值表：类型、流派、某个角色的署名 */
function tally(songs: Song[], pick: (s: Song) => string[] | null | undefined) {
  const counts = new Map<string, number>();
  for (const s of songs)
    for (const v of new Set(pick(s) ?? []))
      counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "zh"))
    .map(([value]) => value);
}

/**
 * 一个可以点亮的选项：后面的小数字是「在其他灯之下，点了会亮几首」；
 * 为 0 的变淡、不能点，免得把人带进空结果
 */
function LampOption({
  label,
  count,
  active,
  color,
  size,
  onClick,
  className,
}: {
  label: string;
  count: number;
  active: boolean;
  color?: string;
  size?: string;
  onClick: () => void;
  className?: string;
}) {
  const dead = !active && count === 0;
  return (
    <button
      type="button"
      aria-pressed={active}
      disabled={dead}
      onClick={onClick}
      className={cn(
        "inline-flex items-baseline gap-1 transition-colors duration-300",
        dead && "cursor-default opacity-30",
        className,
      )}
    >
      <span
        className={cn(
          "font-serif leading-none",
          !active &&
            !dead &&
            "text-slate-600 hover:text-slate-950 dark:text-slate-300 dark:hover:text-white",
          active && !color && "text-(--tone)",
        )}
        style={{
          fontSize: size,
          color: active && color ? color : undefined,
        }}
      >
        {label}
      </span>
      <span className="text-[10px] tabular-nums text-slate-400 dark:text-slate-500">
        {count}
      </span>
    </button>
  );
}

/** 灯谱：全部的灯。序厅里在灯台下展开，滚下去以后从顶栏的「寻」打开 */
export default function LampChart({
  songs,
  lamps,
  tester,
  imagery,
  onToggle,
  onSetYear,
  extra,
  hideTypes,
}: {
  songs: Song[];
  lamps: Lamp[];
  tester: LampTester;
  imagery: ChartImagery[];
  onToggle: (lamp: Lamp) => void;
  onSetYear: (range: { from: number; to: number } | null) => void;
  /** 放在最后一行的其他灯（寻曲、我的收藏） */
  extra?: React.ReactNode;
  /** 序厅里灯台已经有类型一排，灯谱就不再列 */
  hideTypes?: boolean;
}) {
  const on = (lamp: Lamp) => lamps.some((l) => lampKey(l) === lampKey(lamp));
  const count = (lamp: Lamp) => tester.count(songs, lamp);

  // ── 年份：直方图加区间滑块 ────────────────────────────────────────────
  const years = useMemo(
    () =>
      [...new Set(songs.map((s) => s.year).filter((y) => y != null))].sort(
        (a, b) => a - b,
      ) as number[],
    [songs],
  );
  const totalByYear = useMemo(() => {
    const m = new Map<number, number>();
    for (const s of songs)
      if (s.year != null) m.set(s.year, (m.get(s.year) ?? 0) + 1);
    return m;
  }, [songs]);
  const maxYear = Math.max(...totalByYear.values());
  const yearLamp = lamps.find((l) => l.kind === "year");
  const range: [number, number] = yearLamp
    ? [years.indexOf(yearLamp.from), years.indexOf(yearLamp.to)]
    : [0, years.length - 1];
  // 其他灯之下每年还剩几首：柱子的实色部分
  const litByYear = useMemo(() => {
    const m = new Map<number, number>();
    for (const s of songs)
      if (s.year != null && tester.passes(s, "year"))
        m.set(s.year, (m.get(s.year) ?? 0) + 1);
    return m;
  }, [songs, tester]);

  const types = useMemo(() => tally(songs, (s) => s.type), [songs]);
  const genres = useMemo(() => tally(songs, (s) => s.genre), [songs]);

  // ── 署名：先选角色，再列这个角色里最常见的名字，或者找一个 ─────────────
  const [role, setRole] = useState<CreditRole>("lyricist");
  const [nameQuery, setNameQuery] = useState("");
  const names = useMemo(() => tally(songs, (s) => s[role]), [songs, role]);
  const shownNames = useMemo(() => {
    const nq = nameQuery.trim();
    const pinned = lamps.flatMap((l) =>
      l.kind === "credit" && l.role === role ? [l.name] : [],
    );
    const base = nq
      ? names.filter((n) => n.includes(nq)).slice(0, CHART_NAMES + 4)
      : names.slice(0, CHART_NAMES);
    return [...pinned.filter((n) => !base.includes(n)), ...base];
  }, [names, nameQuery, lamps, role]);

  const sea = imagery.slice(0, CHART_IMAGERY);
  const maxImagery = imagery[0]?.count ?? 1;

  return (
    <dl className="grid grid-cols-[3rem_minmax(0,1fr)] items-baseline gap-x-6 gap-y-8">
      <dt className={FIELD_LABEL_CLASS}>年份</dt>
      <dd className="min-w-0">
        {/* 每年一根柱子：浅色是全部作品，实色是其他灯之下还亮着的 */}
        <div className="flex h-14 items-end gap-[3px]" aria-hidden>
          {years.map((y, i) => {
            const inRange = i >= range[0] && i <= range[1];
            const total = totalByYear.get(y) ?? 0;
            const left = litByYear.get(y) ?? 0;
            return (
              <div
                key={y}
                className="relative flex-1"
                style={{ height: `${(total / maxYear) * 100}%` }}
              >
                <div className="absolute inset-0 rounded-[1px] bg-slate-200 dark:bg-slate-800" />
                <div
                  className={cn(
                    "absolute inset-x-0 bottom-0 rounded-[1px] transition-[height,background-color] duration-500",
                    inRange ? "bg-(--tone)" : "bg-slate-300 dark:bg-slate-600",
                  )}
                  style={{ height: total ? `${(left / total) * 100}%` : 0 }}
                />
              </div>
            );
          })}
        </div>
        <Slider
          min={0}
          max={years.length - 1}
          step={1}
          value={range}
          minStepsBetweenValues={0}
          aria-label="年份"
          onValueChange={([a, b]) =>
            onSetYear(
              a === 0 && b === years.length - 1
                ? null
                : { from: years[a], to: years[b] },
            )
          }
          className="mt-1"
        />
        <p className="mt-1 flex justify-between text-[11px] tabular-nums tracking-wider text-slate-400 dark:text-slate-500">
          <span>{years[0]}</span>
          <span
            className={cn(
              yearLamp && "text-(--tone)",
              "text-xs tracking-[0.2em]",
            )}
          >
            {yearLamp
              ? yearLamp.from === yearLamp.to
                ? yearLamp.from
                : `${yearLamp.from} — ${yearLamp.to}`
              : "全部年份"}
          </span>
          <span>{years[years.length - 1]}</span>
        </p>
      </dd>

      {!hideTypes && (
        <>
          <dt className={FIELD_LABEL_CLASS}>类型</dt>
          <dd className="flex flex-wrap gap-x-5 gap-y-3">
            {types.map((value) => {
              const lamp: Lamp = { kind: "type", value };
              return (
                <LampOption
                  key={value}
                  label={value}
                  count={count(lamp)}
                  active={on(lamp)}
                  onClick={() => onToggle(lamp)}
                  className="text-[15px]"
                />
              );
            })}
          </dd>
        </>
      )}

      <dt className={FIELD_LABEL_CLASS}>流派</dt>
      <dd className="flex flex-wrap gap-x-5 gap-y-3">
        {genres.map((value) => {
          const lamp: Lamp = { kind: "genre", value };
          return (
            <LampOption
              key={value}
              label={value}
              count={count(lamp)}
              active={on(lamp)}
              onClick={() => onToggle(lamp)}
              className="text-[15px]"
            />
          );
        })}
      </dd>

      <dt className={FIELD_LABEL_CLASS}>署名</dt>
      <dd className="min-w-0">
        <div className="flex flex-wrap items-baseline gap-x-5 gap-y-2">
          {CREDIT_ROLES.map((r) => (
            <button
              key={r}
              type="button"
              aria-pressed={role === r}
              onClick={() => setRole(r)}
              className={cn(
                "text-xs tracking-widest transition-colors",
                role === r
                  ? "text-slate-900 dark:text-slate-50"
                  : "text-slate-400 hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-200",
              )}
            >
              {ROLE_LABEL[r]}
            </button>
          ))}
          <input
            value={nameQuery}
            onChange={(e) => setNameQuery(e.target.value)}
            placeholder="找一个名字"
            aria-label="找一个名字"
            className="ml-auto w-32 border-0 border-b border-slate-200 bg-transparent px-0 py-1 text-xs text-slate-700 outline-none placeholder:text-slate-400 focus:border-(--tone) md:w-40 dark:border-slate-800 dark:text-slate-300 dark:placeholder:text-slate-600"
          />
        </div>
        <div className="mt-4 flex flex-wrap gap-x-5 gap-y-3">
          {shownNames.length === 0 ? (
            <span className="font-kaiti text-sm text-slate-400 dark:text-slate-500">
              没有这个名字
            </span>
          ) : (
            shownNames.map((name) => {
              const lamp: Lamp = { kind: "credit", name, role };
              return (
                <LampOption
                  key={name}
                  label={name}
                  count={count(lamp)}
                  active={on(lamp)}
                  onClick={() => onToggle(lamp)}
                  className="text-[15px]"
                />
              );
            })
          )}
        </div>
      </dd>

      <dt className={FIELD_LABEL_CLASS}>意象</dt>
      <dd className="flex flex-wrap items-baseline gap-x-5 gap-y-3">
        {sea.map((item) => {
          const lamp: Lamp = { kind: "imagery", id: item.id };
          return (
            <LampOption
              key={item.id}
              label={item.name}
              count={count(lamp)}
              active={on(lamp)}
              color={item.accent}
              size={`${0.95 + 0.8 * Math.sqrt(item.count / maxImagery)}rem`}
              onClick={() => onToggle(lamp)}
            />
          );
        })}
      </dd>

      {extra && (
        <>
          <dt className={FIELD_LABEL_CLASS}>另有</dt>
          <dd className="flex flex-wrap items-baseline gap-x-5 gap-y-3">
            {extra}
          </dd>
        </>
      )}
    </dl>
  );
}
