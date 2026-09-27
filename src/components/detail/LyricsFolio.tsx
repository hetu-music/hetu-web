"use client";

import CommentGutter from "@/components/detail/comments/CommentGutter";
import { useComments } from "@/components/detail/comments/CommentsContext";
import SlotMarker from "@/components/detail/comments/SlotMarker";
import SectionHeading from "@/components/detail/SectionHeading";
import { usePlayerTime } from "@/hooks/player/usePlayerTime";
import { useMediaQuery } from "@/hooks/ui/useMediaQuery";
import type { SongImageryMark } from "@/lib/types";
import { cn } from "@/lib/utils/utils";
import {
  type CommentSlot,
  type CommentThread,
  lyricsSlot,
} from "@/lib/utils/utils-comments";
import type { FolioLine, MarkedLine } from "@/lib/utils/utils-folio";
import { usePlayerStore } from "@/store/player-store";
import { FileText } from "lucide-react";
import { useTranslations } from "next-intl";
import React, {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

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
  // 窄屏：点一句选中，句下展开操作栏；「夹批」开关把批注插在各句之下
  const [selectedLine, setSelectedLine] = useState<number | null>(null);
  const [inline, setInline] = useState(false);
  const isLarge = useMediaQuery("(min-width: 1024px)");
  const { threads, openSlot, setOpenSlot, setSheetSlot } = useComments();
  const bodyRef = useRef<HTMLDivElement>(null);
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

  const slots = useMemo(() => lines.map((_, i) => lyricsSlot(i)), [lines]);
  const hasLineComments = slots.some((s) => threads.has(s.key));
  // 聚焦意象时，只有写到该意象的句子旁的批注保持清晰
  const focusKeys = useMemo(
    () =>
      activeImagery === null
        ? null
        : new Set(
          marked.flatMap((m, i) =>
            m.ids.includes(activeImagery) ? [slots[i].key] : [],
          ),
        ),
    [activeImagery, marked, slots],
  );

  // 宽屏点句跳转播放；窄屏点句先选中，由操作栏决定播放还是批注
  const tapLine = useCallback(
    (i: number) => {
      const time = lines[i].time;
      if (isLarge) {
        if (seekable && time !== null) seek(time);
        return;
      }
      setSelectedLine((prev) => (prev === i ? null : i));
    },
    [isLarge, lines, seek, seekable],
  );
  const annotate = useCallback(
    (i: number) => {
      if (isLarge) setOpenSlot(`lyrics:${i}`);
      else setSheetSlot(lyricsSlot(i));
    },
    [isLarge, setOpenSlot, setSheetSlot],
  );

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
          {mode === "poem" && hasLineComments && (
            <>
              <button
                type="button"
                onClick={() => setInline((v) => !v)}
                aria-pressed={inline}
                className={cn(
                  "lg:hidden transition-colors",
                  inline
                    ? "text-(--tone)"
                    : "text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300",
                )}
              >
                {t("folio.comments.inline")}
              </button>
              <span className="lg:hidden w-px h-3 bg-slate-300 dark:bg-slate-700" />
            </>
          )}
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
        <pre className="mt-12 lg:ml-104 font-mono text-sm leading-7 text-slate-600 dark:text-slate-400 whitespace-pre-wrap wrap-break-word">
          {rawLyrics}
        </pre>
      ) : (
        <div ref={bodyRef} className="relative mt-12 md:mt-14">
          <CommentGutter
            slots={slots}
            containerRef={bodyRef}
            focusKeys={focusKeys}
          />
          {lines.map((line, i) => (
            <FolioRow
              key={i}
              slot={slots[i]}
              index={i}
              line={line}
              marked={marked[i]}
              notes={notesByLine[i]}
              stanzaNumber={stanzaNumbers[i]}
              numeralMuted={
                openSlot === slots[i].key && threads.has(slots[i].key)
              }
              markById={markById}
              activeImagery={activeImagery}
              isCurrent={isCurrentTrack && currentIndex === i}
              seekable={seekable && line.time !== null}
              seekHint={t("folio.seekHint")}
              selected={!isLarge && selectedLine === i}
              inlineThreads={inline ? threads.get(slots[i].key) : undefined}
              onSeek={seek}
              onTap={tapLine}
              onAnnotate={annotate}
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
  slot: CommentSlot;
  index: number;
  line: FolioLine;
  marked: MarkedLine;
  notes: number[];
  stanzaNumber: number;
  /** 这一句的旁批展开时，「收起」落在序号的位置，序号先淡去 */
  numeralMuted: boolean;
  markById: Map<number, SongImageryMark>;
  activeImagery: number | null;
  isCurrent: boolean;
  seekable: boolean;
  seekHint: string;
  /** 窄屏选中：句下展开操作栏 */
  selected: boolean;
  /** 夹批模式下插在句下的批注 */
  inlineThreads: CommentThread[] | undefined;
  onSeek: (time: number) => void;
  onTap: (index: number) => void;
  onAnnotate: (index: number) => void;
  onSelectImagery: (id: number | null) => void;
}

const FolioRow = memo(function FolioRow({
  slot,
  index,
  line,
  marked,
  notes,
  stanzaNumber,
  numeralMuted,
  markById,
  activeImagery,
  isCurrent,
  seekable,
  seekHint,
  selected,
  inlineThreads,
  onSeek,
  onTap,
  onAnnotate,
  onSelectImagery,
}: FolioRowProps) {
  const t = useTranslations("song.folio.comments");
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
        "group/row md:grid md:grid-cols-[minmax(0,1fr)_9rem] md:gap-x-10 lg:grid-cols-[22rem_minmax(0,1fr)_10rem] lg:gap-x-16",
        line.stanzaStart && "mt-9 md:mt-11",
      )}
    >
      <div
        className={cn(
          "hidden lg:block text-right font-serif text-xs tracking-[0.3em] leading-[2.2] text-(--tone)/70 select-none transition-opacity duration-300",
          numeralMuted && "opacity-0",
        )}
        aria-hidden
      >
        {stanzaNumber > 0 && toChineseNumeral(stanzaNumber)}
      </div>

      <div className="min-w-0">
        <p
          data-folio-line
          data-comment-slot={slot.key}
          onClick={() => onTap(index)}
          title={seekable ? seekHint : undefined}
          className={cn(
            "relative font-serif text-[17px] sm:text-lg leading-[2.2] text-balance transition-[opacity,color] duration-500 max-lg:cursor-pointer",
            isCurrent || selected
              ? "text-slate-950 dark:text-white"
              : "text-slate-700 dark:text-slate-300",
            focused && !carriesActive && "opacity-[0.18]",
            seekable &&
            "lg:cursor-pointer hover:text-slate-950 dark:hover:text-white",
          )}
        >
          {/* 宽屏：悬停时在句前浮出「批」，在左栏就地写批注 */}
          <span className="absolute -left-12 top-0 hidden lg:flex h-[2.2em] items-center">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onAnnotate(index);
              }}
              aria-label={t("annotateLine")}
              className="font-kaiti text-sm text-(--tone) opacity-0 group-hover/row:opacity-60 hover:opacity-100! focus-visible:opacity-100 transition-opacity"
            >
              {t("add")}
            </button>
          </span>
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
          {!inlineThreads && <SlotMarker slot={slot} />}
        </p>

        {selected && (
          <div className="lg:hidden flex items-center gap-5 pb-2 text-xs tracking-widest text-(--tone)">
            {seekable && (
              <button type="button" onClick={() => onSeek(line.time!)}>
                {t("playFrom")}
              </button>
            )}
            <button type="button" onClick={() => onAnnotate(index)}>
              {t("annotate")}
            </button>
          </div>
        )}

        {inlineThreads && inlineThreads.length > 0 && (
          <InlineNotes
            threads={inlineThreads}
            onOpen={() => onAnnotate(index)}
          />
        )}
      </div>

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

// ─── 夹批 ────────────────────────────────────────────────────────────────────

/** 窄屏夹批：批注缩进插在句下，只列顶层批注，点开看回复 */
function InlineNotes({
  threads,
  onOpen,
}: {
  threads: CommentThread[];
  onOpen: () => void;
}) {
  const t = useTranslations("song.folio.comments");
  return (
    <button
      type="button"
      onClick={onOpen}
      className="lg:hidden block w-full text-left mb-3 mt-0.5 pl-3 border-l border-(--tone)/40 space-y-1.5"
    >
      {threads.map(({ comment, replies }) => (
        <span
          key={comment.id}
          className="block font-kaiti text-sm leading-[1.8] text-slate-500 dark:text-slate-400"
        >
          {comment.deleted ? t("deleted") : comment.body}
          <span className="ml-2 text-xs text-slate-400 dark:text-slate-500">
            {!comment.deleted && (comment.author || t("anonymous"))}
            {replies.length > 0 &&
              ` · ${t("replies", { count: replies.length })}`}
          </span>
        </span>
      ))}
    </button>
  );
}

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
