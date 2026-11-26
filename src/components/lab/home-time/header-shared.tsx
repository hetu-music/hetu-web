"use client";

import type { LyricsSearchState } from "@/hooks/library/useLyricsLines";
import { GRAY_PALETTE, PALETTE_FULL } from "@/lib/imagery/palette";
import type { QuizQuestionView } from "@/lib/quiz/views";
import type { Song } from "@/lib/types";
import { cn } from "@/lib/utils/utils";
import { AnimatePresence, motion } from "framer-motion";
import { Fragment } from "react";
import { pickChapterFocal } from "./timeline";

export type HeaderScheme = "folio" | "string" | "paper-screen";

export const HEADER_SCHEMES: readonly {
  id: HeaderScheme;
  code: string;
  label: string;
  note: string;
}[] = [
  {
    id: "folio",
    code: "一",
    label: "总目开篇",
    note: "卷首零图留白，右承竖排刻本三径，时间轴收作屏幕右缘书口色签",
  },
  {
    id: "string",
    code: "二",
    label: "素卷琴弦",
    note: "居中素白开篇，一根色丝琴弦吸顶贯通，悬停某年才轻浮一帧小画笺",
  },
  {
    id: "paper-screen",
    code: "三",
    label: "素骨折屏",
    note: "屏外零杂物，题字入口寻曲尽在左扉页，众扇素纸藏锋唯独一扇显画",
  },
];

export type FeatureKey = "qjtx" | "imagery" | "quiz";

export const ENTRANCE_DEFS: readonly {
  key: FeatureKey;
  href: string;
  name: string;
}[] = [
  { key: "qjtx", href: "/story/qjtx", name: "倾尽天下" },
  { key: "imagery", href: "/imagery", name: "意象" },
  { key: "quiz", href: "/quiz", name: "寻曲" },
];

/** 特展入口各取自己内容的一小片 */
export interface FeatureData {
  motifs: { id: number; name: string; palette: number; songCount: number }[];
  motifCount: number;
  question: QuizQuestionView | null;
  questionCount: number;
}

/** 二十年每一年的代表条目，末尾可能附一格「未详」 */
export interface ScreenPanel {
  /** 与正文章节的 data-year-key 一致："2026" … "unknown" */
  key: string;
  year: number | null;
  ids: ReadonlySet<number>;
  /** 这一年挑出的一首代表曲；无歌时为 null */
  song: Song | null;
  /** 是否有独立封面（非共用占位图） */
  art: boolean;
}

/** 供右侧书口标尺、色丝琴弦等年份指示器局部更新正在读的年份，滚过章节时不重渲整页 */
export interface YearRailHandle {
  setActive: (key: string) => void;
}

export interface ActiveChip {
  key: string;
  label: string;
  onRemove: () => void;
}

export const EASE = [0.23, 1, 0.32, 1] as const;

/** 展开一扇屏或亮起小画笺前的短暂驻留，避免鼠标扫过时画面乱闪 */
export const HOVER_INTENT_MS = 85;

export function paletteText(palette: number): string {
  return palette >= 0
    ? PALETTE_FULL[palette % PALETTE_FULL.length].text
    : GRAY_PALETTE.text;
}

/**
 * 每年挑一幅挂画：避开下方章节的焦点作品（pickChapterFocal），避免首屏同图重复；
 * 优先有独立封面且不与他年共用专辑封面的曲目。
 */
function pickPanel(
  songs: Song[],
  usedAlbums: Set<string>,
): Pick<ScreenPanel, "song" | "art"> {
  const withCover = songs.filter((s) => s.hascover === true);
  if (withCover.length === 0) {
    return { song: pickChapterFocal(songs), art: false };
  }
  const focal = pickChapterFocal(songs);
  const fresh = withCover.filter((s) => !s.album || !usedAlbums.has(s.album));
  const pool = fresh.length > 0 ? fresh : withCover;
  const rest = pool.filter((s) => s.id !== focal?.id);
  const song = pickChapterFocal(rest.length > 0 ? rest : pool);
  if (song?.album) usedAlbums.add(song.album);
  return { song, art: true };
}

export function buildPanels(
  catalog: Song[],
  firstYear: number,
  lastYear: number,
): ScreenPanel[] {
  const byYear = new Map<number | null, Song[]>();
  for (const s of catalog) {
    const y = s.year ?? null;
    const list = byYear.get(y);
    if (list) list.push(s);
    else byYear.set(y, [s]);
  }
  const years: (number | null)[] = [];
  for (let y = lastYear; y >= firstYear; y--) years.push(y);
  if (byYear.has(null)) years.push(null);

  const usedAlbums = new Set<string>();
  return years.map((year) => {
    const songs = byYear.get(year) ?? [];
    return {
      key: String(year ?? "unknown"),
      year,
      ids: new Set(songs.map((s) => s.id)),
      ...(year === null
        ? { song: null, art: false }
        : pickPanel(songs, usedAlbums)),
    };
  });
}

export function panelLit(
  panel: ScreenPanel,
  matched: ReadonlySet<number> | null,
): boolean {
  if (matched === null) return true;
  for (const id of panel.ids) if (matched.has(id)) return true;
  return false;
}

const HANZI_DIGITS = "零一二三四五六七八九";
const HANZI_UNITS = ["千", "百", "十", ""];

/** 一万以内的数写成汉字：361 → 三百六十一，12 → 十二 */
export function hanzi(n: number): string {
  if (!Number.isInteger(n) || n <= 0 || n >= 10000) return String(n);
  const s = String(n).padStart(4, "0");
  let out = "";
  let zero = false;
  for (let i = 0; i < 4; i++) {
    const k = Number(s[i]);
    if (k === 0) {
      if (out) zero = true;
      continue;
    }
    if (zero) {
      out += "零";
      zero = false;
    }
    out += HANZI_DIGITS[k] + HANZI_UNITS[i];
  }
  return n >= 10 && n < 20 ? out.slice(1) : out;
}

/** 曲数动态跳变：仅在需要展示曲数或筛选命中时使用 */
export function SongCount({
  shownCount,
  totalCount,
  matched,
}: {
  shownCount: number;
  totalCount: number;
  matched: ReadonlySet<number> | null;
}) {
  return (
    <span className="font-serif text-xs tracking-[0.2em] text-ink-meta">
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={shownCount}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.25 }}
          className={cn(
            "inline-block font-semibold tabular-nums",
            matched ? "text-(--tone)" : "text-ink-body",
          )}
        >
          {shownCount}
        </motion.span>
      </AnimatePresence>
      {matched ? ` / ${totalCount}` : ""} 曲
    </span>
  );
}

/**
 * 活题字：常态是一句楷体卷首题记；悬停三处特展入口时，原地如水墨化开为该特展的导语。
 */
export function FeatureEpigraph({
  feature,
  features,
  centered,
  className,
}: {
  feature: FeatureKey | null;
  features: FeatureData;
  centered?: boolean;
  className?: string;
}) {
  const topMotifs = features.motifs.slice(0, 4);

  return (
    <div
      className={cn(
        "min-h-6",
        centered ? "flex justify-center" : "block",
        className,
      )}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.p
          key={feature ?? "default"}
          initial={{ opacity: 0, y: 2, filter: "blur(4px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          exit={{ opacity: 0, y: -2, filter: "blur(4px)" }}
          transition={{ duration: 0.32, ease: EASE }}
          className={cn("font-kaiti text-ink-muted", centered && "text-center")}
        >
          {feature === null ? (
            "你一定想知道，戏里讲了什么故事……"
          ) : feature === "qjtx" ? (
            <>
              <span className="text-(--tone)">倾尽天下</span>
              <span aria-hidden className="mx-2 text-ink-faint">
                ·
              </span>
              一曲长歌，随乐声缓步展开江山旧梦
            </>
          ) : feature === "imagery" ? (
            <>
              <span className="text-(--tone)">
                {features.motifCount > 0
                  ? `${features.motifCount} 个词中母题`
                  : "词中万象"}
              </span>
              {topMotifs.length > 0 && (
                <>
                  <span aria-hidden className="mx-2 text-ink-faint">
                    ·
                  </span>
                  {topMotifs.map((m, idx) => (
                    <Fragment key={m.id}>
                      {idx > 0 && <span className="text-ink-faint">、</span>}
                      <span
                        className={cn(
                          "font-calligraphy text-[1.08em]",
                          paletteText(m.palette),
                        )}
                      >
                        {m.name}
                      </span>
                    </Fragment>
                  ))}
                  <span className="text-ink-meta">……</span>
                </>
              )}
            </>
          ) : (
            <>
              <span className="text-(--tone)">
                {features.questionCount > 0
                  ? `${hanzi(features.questionCount)}问寻歌`
                  : "问答寻歌"}
              </span>
              <span aria-hidden className="mx-2 text-ink-faint">
                ·
              </span>
              {features.question?.stem
                ? `「${features.question.stem}」`
                : "十二个问题，寻一首懂你的歌"}
            </>
          )}
        </motion.p>
      </AnimatePresence>
    </div>
  );
}

/** 纯楷体无框寻曲输入：三套方案复用同一份输入交互与歌词加载指示 */
export function SearchInputLine({
  value,
  onChange,
  onFocus,
  lyricsState,
  placeholder = "寻歌、词人或一句歌词……",
  underlineOffset = "-bottom-2.5",
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  onFocus: () => void;
  lyricsState: LyricsSearchState;
  placeholder?: string;
  underlineOffset?: string;
  className?: string;
}) {
  return (
    <label
      className={cn(
        "group relative flex min-w-0 flex-1 items-center gap-2 py-1",
        className,
      )}
    >
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onFocus={onFocus}
        onChange={(e) => onChange(e.target.value)}
        className="w-full min-w-0 bg-transparent font-kaiti text-[15px] text-ink-body outline-none placeholder:text-ink-meta"
      />
      {value ? (
        <button
          type="button"
          onClick={() => onChange("")}
          className="shrink-0 text-[11px] tracking-[0.2em] text-ink-meta transition-colors hover:text-ink-body"
        >
          清空
        </button>
      ) : lyricsState === "loading" ? (
        <span
          aria-label="歌词检索准备中"
          className="block h-2.5 w-2.5 shrink-0 animate-spin rounded-full border border-slate-300 border-t-(--tone) dark:border-slate-600"
        />
      ) : lyricsState === "ready" ? (
        <span className="shrink-0 text-[10px] tracking-[0.2em] text-(--tone)/65">
          含词
        </span>
      ) : null}

      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-x-0 h-[1.5px] bg-(--tone) opacity-0 transition-opacity duration-300 group-focus-within:opacity-100",
          underlineOffset,
        )}
      />
    </label>
  );
}
