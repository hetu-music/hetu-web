"use client";

import SectionHeading from "@/components/detail/SectionHeading";
import { usePlayerTime } from "@/hooks/player/usePlayerTime";
import type { SongImageryMark } from "@/lib/types";
import { cn } from "@/lib/utils/utils";
import type { FolioLine, MarkedLine } from "@/lib/utils/utils-folio";
import { usePlayerStore } from "@/store/player-store";
import { FileText } from "lucide-react";
import { useTranslations } from "next-intl";
import React, { memo, useEffect, useMemo, useState } from "react";

const NUMERALS = ["", "一", "二", "三", "四", "五", "六", "七", "八", "九"];

function toChineseNumeral(n: number): string {
  if (n < 10) return NUMERALS[n];
  const tens = Math.floor(n / 10);
  return `${tens > 1 ? NUMERALS[tens] : ""}十${NUMERALS[n % 10]}`;
}

interface LyricsFolioProps {
  songId: number;
  rawLyrics: string | null | undefined;
  lines: FolioLine[];
  marked: MarkedLine[];
  markById: Map<number, SongImageryMark>;
  activeImagery: number | null;
  onSelectImagery: (id: number | null) => void;
}

export default function LyricsFolio({
  songId,
  rawLyrics,
  lines,
  marked,
  markById,
  activeImagery,
  onSelectImagery,
}: LyricsFolioProps) {
  const t = useTranslations("song");
  const [mode, setMode] = useState<"poem" | "lrc">("poem");
  const [currentIndex, setCurrentIndex] = useState(-1);
  const isCurrentTrack = usePlayerStore(
    (s) => s.currentTrack?.songId === songId,
  );
  const seek = usePlayerStore((s) => s.seek);

  // 每个意象只在它第一次出现的那一行写旁注
  const notesByLine = useMemo(() => {
    const seen = new Set<number>();
    return marked.map((line) =>
      line.ids.filter((id) => {
        if (seen.has(id)) return false;
        seen.add(id);
        return true;
      }),
    );
  }, [marked]);

  // 段落序号；只有一段时不显示
  const stanzaNumbers = useMemo(() => {
    let n = 0;
    const numbers = lines.map((line, i) =>
      i === 0 || line.stanzaStart ? ++n : 0,
    );
    return n > 1 ? numbers : lines.map(() => 0);
  }, [lines]);

  const seekable = isCurrentTrack && lines.some((l) => l.time !== null);

  if (!rawLyrics || lines.length === 0) {
    return (
      <section id="lyrics" className="py-16">
        <SectionHeading label={t("folio.sections.text")} />
        <div className="flex flex-col items-center py-20 text-slate-400 opacity-60">
          <FileText size={40} className="mb-3" />
          <p className="text-sm">{t("noLyrics")}</p>
        </div>
      </section>
    );
  }

  return (
    <section id="lyrics" className="py-16 md:py-20">
      <SectionHeading label={t("folio.sections.text")}>
        <div className="flex items-center gap-3 text-xs tracking-widest">
          {(["poem", "lrc"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={cn(
                "transition-colors",
                mode === m
                  ? "text-slate-900 dark:text-white"
                  : "text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300",
              )}
            >
              {t(`folio.readMode.${m}`)}
            </button>
          ))}
        </div>
      </SectionHeading>

      {isCurrentTrack && (
        <PlaybackTracker lines={lines} onIndexChange={setCurrentIndex} />
      )}

      {mode === "lrc" ? (
        <pre className="mt-12 lg:ml-[26rem] font-mono text-sm leading-7 text-slate-600 dark:text-slate-400 whitespace-pre-wrap break-words">
          {rawLyrics}
        </pre>
      ) : (
        <div className="mt-12 md:mt-14">
          {lines.map((line, i) => (
            <FolioRow
              key={i}
              line={line}
              marked={marked[i]}
              notes={notesByLine[i]}
              stanzaNumber={stanzaNumbers[i]}
              markById={markById}
              activeImagery={activeImagery}
              isCurrent={isCurrentTrack && currentIndex === i}
              seekable={seekable && line.time !== null}
              seekHint={t("folio.seekHint")}
              onSeek={seek}
              onSelectImagery={onSelectImagery}
            />
          ))}
        </div>
      )}
    </section>
  );
}

// ─── 单行 ─────────────────────────────────────────────────────────────────────

interface FolioRowProps {
  line: FolioLine;
  marked: MarkedLine;
  notes: number[];
  stanzaNumber: number;
  markById: Map<number, SongImageryMark>;
  activeImagery: number | null;
  isCurrent: boolean;
  seekable: boolean;
  seekHint: string;
  onSeek: (time: number) => void;
  onSelectImagery: (id: number | null) => void;
}

const FolioRow = memo(function FolioRow({
  line,
  marked,
  notes,
  stanzaNumber,
  markById,
  activeImagery,
  isCurrent,
  seekable,
  seekHint,
  onSeek,
  onSelectImagery,
}: FolioRowProps) {
  const focused = activeImagery !== null;
  const carriesActive = focused && marked.ids.includes(activeImagery);
  const activeMark =
    activeImagery !== null ? markById.get(activeImagery) : undefined;
  // 行内找不到对应文字时，用行首的小圆点提示这一句写到了该意象
  const activeHasText =
    carriesActive && marked.segments.some((s) => s.ids.includes(activeImagery));

  return (
    <div
      className={cn(
        "md:grid md:grid-cols-[minmax(0,1fr)_9rem] md:gap-x-10 lg:grid-cols-[22rem_minmax(0,1fr)_10rem] lg:gap-x-16",
        line.stanzaStart && "mt-9 md:mt-11",
      )}
    >
      <div
        className="hidden lg:block text-right font-serif text-xs tracking-[0.3em] leading-[2.2] text-(--tone)/70 select-none"
        aria-hidden
      >
        {stanzaNumber > 0 && toChineseNumeral(stanzaNumber)}
      </div>

      <p
        data-folio-line
        onClick={seekable ? () => onSeek(line.time!) : undefined}
        title={seekable ? seekHint : undefined}
        className={cn(
          "relative font-serif text-[17px] sm:text-lg leading-[2.2] text-balance transition-[opacity,color] duration-500",
          isCurrent
            ? "text-slate-950 dark:text-white"
            : "text-slate-700 dark:text-slate-300",
          focused && !carriesActive && "opacity-[0.18]",
          seekable &&
            "cursor-pointer hover:text-slate-950 dark:hover:text-white",
        )}
      >
        <span
          aria-hidden
          className={cn(
            "absolute -left-5 top-1/2 h-px bg-(--tone) transition-all duration-500",
            isCurrent ? "w-3 opacity-100" : "w-0 opacity-0",
          )}
        />
        {carriesActive && !activeHasText && activeMark && (
          <span
            aria-hidden
            className="absolute -left-4 top-1/2 -translate-y-1/2 size-1.5 rounded-full"
            style={{ backgroundColor: activeMark.accent }}
          />
        )}
        {marked.segments.map((seg, k) => {
          if (seg.ids.length === 0) return <span key={k}>{seg.text}</span>;
          const primary =
            activeImagery !== null && seg.ids.includes(activeImagery)
              ? activeImagery
              : seg.ids[0];
          const mark = markById.get(primary);
          return (
            <button
              key={k}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSelectImagery(primary === activeImagery ? null : primary);
              }}
              className="imagery-mark"
              data-active={primary === activeImagery}
              style={{ "--mark": mark?.accent } as React.CSSProperties}
              aria-label={mark?.name}
            >
              {seg.text}
            </button>
          );
        })}
      </p>

      <div
        className={cn(
          "hidden md:flex items-center gap-4 min-w-0 overflow-hidden whitespace-nowrap leading-[2.2] transition-opacity duration-500",
          focused && !carriesActive && "opacity-20",
        )}
      >
        {notes.map((id) => {
          const mark = markById.get(id);
          if (!mark) return null;
          const active = id === activeImagery;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onSelectImagery(active ? null : id)}
              title={mark.path.join(" › ")}
              className={cn(
                "flex items-center gap-1.5 font-kaiti text-sm transition-colors",
                active
                  ? ""
                  : "text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300",
              )}
              style={active ? { color: mark.accent } : undefined}
            >
              <span
                className="size-1 rounded-full shrink-0"
                style={{ backgroundColor: mark.accent }}
              />
              {mark.name}
            </button>
          );
        })}
      </div>
    </div>
  );
});

// ─── 播放同步 ────────────────────────────────────────────────────────────────

/**
 * 只在本曲正在播放器中时挂载：usePlayerTime 每秒触发一次更新，
 * 放在独立组件里，正文只在「当前行」变化时重渲染。
 */
function PlaybackTracker({
  lines,
  onIndexChange,
}: {
  lines: FolioLine[];
  onIndexChange: (index: number) => void;
}) {
  const { currentTime } = usePlayerTime();
  const index = useMemo(() => {
    let found = -1;
    for (let i = 0; i < lines.length; i++) {
      const time = lines[i].time;
      if (time === null) continue;
      if (time <= currentTime + 0.3) found = i;
      else break;
    }
    return found;
  }, [lines, currentTime]);

  useEffect(() => {
    onIndexChange(index);
  }, [index, onIndexChange]);

  useEffect(() => () => onIndexChange(-1), [onIndexChange]);

  return null;
}
