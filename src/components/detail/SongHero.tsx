"use client";

import NaviPlayer from "@/components/detail/NaviPlayer";
import VerticalExcerpt from "@/components/shared/VerticalExcerpt";
import type { SongDetail, SongImageryMark } from "@/lib/types";
import { cn } from "@/lib/utils/utils";
import { getCoverUrl } from "@/lib/utils/utils-song";
import { Disc } from "lucide-react";
import { useTranslations } from "next-intl";
import Image from "next/image";
import React, { useState } from "react";

interface SongHeroProps {
  song: SongDetail;
  titleRef?: React.Ref<HTMLHeadingElement>;
  /** 题签展示的意象（已排序截断） */
  stripMarks: SongImageryMark[];
  imageryTotal: number;
  excerpt: string | null;
  activeImagery: number | null;
  showPlayer: boolean;
  onSelectImagery: (id: number) => void;
  onCoverLoad: (img: HTMLImageElement) => void;
  onOpenCover: () => void;
}

/** 卷首：封面、题名、署名、题签与竖排摘句 */
export default function SongHero({
  song,
  titleRef,
  stripMarks,
  imageryTotal,
  excerpt,
  activeImagery,
  showPlayer,
  onSelectImagery,
  onCoverLoad,
  onOpenCover,
}: SongHeroProps) {
  const t = useTranslations("song");
  const tEnum = useTranslations("enums");
  const [coverFailed, setCoverFailed] = useState(false);

  const eyebrow = [
    ...(song.type && song.type.length > 0 ? song.type : ["原创"]).map((v) =>
      tEnum.has(`type.${v}`) ? tEnum(`type.${v}`) : v,
    ),
    ...(song.genre ?? []).map((g) =>
      tEnum.has(`genre.${g}`) ? tEnum(`genre.${g}`) : g,
    ),
    song.year ? String(song.year) : null,
  ].filter(Boolean);

  const credits = (
    [
      ["lyricist", song.lyricist],
      ["composer", song.composer],
      ["arranger", song.arranger],
      ["artist", song.artist],
    ] as const
  ).flatMap(([key, names]) =>
    names && names.length > 0 ? [[key, names] as const] : [],
  );

  // 竖排摘句按空格分列，每一列是一个短语
  const excerptColumns = excerpt?.split(/\s+/).filter(Boolean) ?? [];

  return (
    <header
      id="info"
      className="relative grid gap-10 lg:grid-cols-[22rem_minmax(0,1fr)] lg:gap-x-16 items-end pb-16 md:pb-20"
    >
      {/* 封面；窄屏时右侧的留白放竖排摘句，宽屏时摘句移到标题栏右侧 */}
      <div className="@container flex items-start justify-between gap-4 lg:block [--cover:min(62cqw,24rem)]">
        <button
          type="button"
          onClick={() => !coverFailed && onOpenCover()}
          aria-label={t("viewCover")}
          className="group relative block shrink-0 w-(--cover) lg:w-full aspect-square overflow-hidden rounded-md bg-slate-100 dark:bg-slate-800 shadow-[0_30px_60px_-20px_rgba(15,23,42,0.35)] dark:shadow-[0_30px_60px_-20px_rgba(0,0,0,0.7)] ring-1 ring-slate-900/5 dark:ring-white/10"
        >
          {coverFailed ? (
            <span className="absolute inset-0 flex flex-col items-center justify-center text-slate-400">
              <Disc size={40} className="mb-2 opacity-50" />
              <span className="text-xs">{t("noCover")}</span>
            </span>
          ) : (
            <Image
              src={getCoverUrl(song)}
              alt={song.title}
              width={500}
              height={500}
              preload
              onLoad={(e) => onCoverLoad(e.currentTarget)}
              onError={() => setCoverFailed(true)}
              className="w-full h-full object-cover transition-transform duration-1000 ease-out group-hover:scale-[1.03]"
            />
          )}
        </button>
        {excerptColumns.length > 0 && (
          <CompactExcerpt columns={excerptColumns} />
        )}
      </div>

      <div className="relative min-w-0 lg:pr-36 lg:self-stretch lg:flex lg:flex-col lg:justify-end">
        {/* 类型 · 流派 · 年份 */}
        <p className="text-xs tracking-[0.35em] text-(--tone) mb-5">
          {eyebrow.join(" · ")}
        </p>

        <h1
          ref={titleRef}
          className="font-serif text-5xl md:text-6xl xl:text-7xl font-semibold leading-[1.1] tracking-tight text-slate-900 dark:text-slate-50 text-balance"
        >
          {song.title}
        </h1>

        {/* 署名：一行文字，不做卡片 */}
        {credits.length > 0 && (
          <dl className="mt-7 flex flex-wrap gap-x-7 gap-y-2 text-[15px]">
            {credits.map(([key, names]) => (
              <div key={key} className="flex items-baseline gap-2">
                <dt className="text-xs text-slate-400 dark:text-slate-500">
                  {t(`folio.credits.${key}`)}
                </dt>
                <dd className="text-slate-800 dark:text-slate-200">
                  {names.join(" / ")}
                </dd>
              </div>
            ))}
          </dl>
        )}

        {/* 意象题签；窄屏折行时间隔点会挂在行首，只在宽屏用间隔点 */}
        {stripMarks.length > 0 && (
          <div className="mt-10 flex flex-wrap items-baseline gap-x-5 gap-y-3 lg:gap-x-1">
            {stripMarks.map((mark, i) => (
              <React.Fragment key={mark.id}>
                {i > 0 && (
                  <span
                    className="hidden lg:inline text-slate-300 dark:text-slate-700 px-1.5"
                    aria-hidden
                  >
                    ·
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => onSelectImagery(mark.id)}
                  className={cn(
                    "font-calligraphy text-2xl leading-none transition-colors duration-300",
                    activeImagery === mark.id
                      ? ""
                      : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white",
                  )}
                  style={
                    activeImagery === mark.id
                      ? { color: mark.accent }
                      : undefined
                  }
                >
                  {mark.name}
                </button>
              </React.Fragment>
            ))}
            {imageryTotal > stripMarks.length && (
              <span className="basis-full lg:basis-auto lg:ml-3 text-xs text-slate-400 dark:text-slate-500 tracking-wider">
                <span className="hidden lg:inline">
                  {t("folio.imageryMore")} ·{" "}
                </span>
                {t("folio.imageryTotal", { count: imageryTotal })}
              </span>
            )}
          </div>
        )}

        {showPlayer && (
          <NaviPlayer
            songId={song.id}
            title={song.title}
            artist={song.artist?.join(" / ")}
            coverUrl={getCoverUrl(song)}
            hasAudio={song.has_audio}
            className="mt-10"
          />
        )}

        {/* 宽屏：竖排摘句 */}
        {excerptColumns.length > 0 && (
          <VerticalExcerpt
            columns={excerptColumns}
            className="hidden lg:flex absolute right-0 top-0"
          />
        )}
      </div>
    </header>
  );
}

/** 竖排摘句的字距与逐列错落，均以字号为单位 */
const COMPACT_TRACKING = 0.3;
const COMPACT_STAGGER = 1.5;
const COMPACT_GAP = 0.55;

/**
 * 窄屏的竖排摘句，放在封面右侧的留白里。
 * 字号纯用 CSS 算：既要让最长的一列（连同错落）不高于封面，
 * 又要让所有列并排不宽于剩余空间，取两者与上限中的最小值。
 */
function CompactExcerpt({ columns }: { columns: string[] }) {
  const heightEm = Math.max(
    ...columns.map(
      (col, i) =>
        Array.from(col).length * (1 + COMPACT_TRACKING) + i * COMPACT_STAGGER,
    ),
  );
  // 各列宽 1em，列间距与左侧细线各占一个间距
  const widthEm = columns.length + columns.length * COMPACT_GAP;
  return (
    <div
      aria-hidden
      className="lg:hidden flex flex-row-reverse items-start"
      style={{
        gap: `${COMPACT_GAP}em`,
        fontSize: `min(calc(var(--cover) / ${heightEm}), calc((100cqw - var(--cover) - 1rem) / ${widthEm}), 1.75rem)`,
      }}
    >
      <span className="w-px h-[3em] bg-(--tone)/60" />
      {columns.map((col, i) => (
        <span
          key={i}
          className="font-calligraphy leading-none text-slate-700/85 dark:text-slate-300/85 [writing-mode:vertical-rl]"
          style={{
            letterSpacing: `${COMPACT_TRACKING}em`,
            marginTop: `${i * COMPACT_STAGGER}em`,
          }}
        >
          {col}
        </span>
      ))}
    </div>
  );
}
