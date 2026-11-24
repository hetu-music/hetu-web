"use client";

import { Link } from "@/i18n/navigation";
import { GRAY_PALETTE, PALETTE_FULL } from "@/lib/imagery/palette";
import type { QuizQuestionView } from "@/lib/quiz/views";
import { cn } from "@/lib/utils/utils";
import Image from "next/image";

export interface FeatureData {
  motifs: { id: number; name: string; palette: number; songCount: number }[];
  motifCount: number;
  question: QuizQuestionView | null;
  questionCount: number;
}

const OPTION_MARKS = ["甲", "乙", "丙", "丁"];

function paletteText(palette: number): string {
  return palette >= 0
    ? PALETTE_FULL[palette % PALETTE_FULL.length].text
    : GRAY_PALETTE.text;
}

/** 母题字号只分三档：词云的连续字号放在这么小的一块里会显得乱 */
function motifSize(count: number, max: number): string {
  const r = count / max;
  if (r > 0.66) return "text-[2rem] md:text-[2.25rem]";
  if (r > 0.4) return "text-2xl md:text-[1.75rem]";
  return "text-xl md:text-[1.375rem]";
}

/**
 * 特展：站内另外几处去处，每处只拿自己的一小片内容作门面，不另做包装。
 * - 倾尽天下是主角：长卷里的一帧画面，占大块；
 * - 意象：作品最多的几个母题，刻本字，按门类配色，点哪个进哪个；
 * - 寻曲：第一题原样摆出来，点选项即带着这一答进入测验。
 * 有主有次，三处之间只靠留白与细线分开，不用卡片。
 */
export default function FeatureBand({ data }: { data: FeatureData }) {
  const maxCount = data.motifs[0]?.songCount ?? 1;

  return (
    <section aria-label="特展" className="mt-16 md:mt-20">
      <div className="flex items-center gap-5">
        <h2 className="whitespace-nowrap font-serif text-sm tracking-[0.4em] text-(--tone)">
          特展
        </h2>
        <span className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
      </div>

      <div className="mt-10 grid gap-y-14 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)] lg:gap-x-16">
        {/* 倾尽天下：长卷里的一帧 */}
        <Link href="/story/qjtx" className="group block outline-none">
          <div className="relative aspect-[5/3] overflow-hidden rounded-md ring-1 ring-slate-900/5 dark:ring-white/10">
            <Image
              src="/story/qjtx/31.avif"
              alt="倾尽天下长卷：雪中二人，一线朱砂"
              fill
              sizes="(min-width: 1024px) 720px, 100vw"
              className="object-cover transition-transform duration-700 ease-page group-hover:scale-[1.03] group-focus-visible:scale-[1.03]"
            />
          </div>
          <div className="mt-5 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
            <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
              <h3 className="font-serif text-2xl font-semibold tracking-tight text-ink md:text-[1.75rem]">
                倾尽天下
              </h3>
              <span className="text-xs tracking-[0.35em] text-(--tone)">
                互动长卷
              </span>
            </div>
            <span className="text-xs tracking-widest text-ink-meta transition-colors group-hover:text-(--tone)">
              入卷 →
            </span>
          </div>
          <p className="mt-2 font-kaiti text-[15px] text-ink-muted">
            一曲长歌，随乐声缓步展开江山旧梦
          </p>
        </Link>

        <div className="flex min-w-0 flex-col">
          {/* 意象：最常写到的几个母题 */}
          <div>
            <div className="flex items-baseline justify-between gap-4">
              <h3 className="font-serif text-lg font-semibold tracking-wide text-ink">
                意象
              </h3>
              <Link
                href="/imagery"
                className="text-xs tracking-widest text-ink-meta transition-colors hover:text-(--tone)"
              >
                {data.motifCount > 0
                  ? `全部 ${data.motifCount} 个母题`
                  : "入词云"}{" "}
                →
              </Link>
            </div>
            <p className="mt-1 font-kaiti text-sm text-ink-muted">
              二十年里，最常写到的是这些
            </p>
            <div className="mt-5 flex flex-wrap items-baseline gap-x-5 gap-y-2">
              {data.motifs.map((m) => (
                <Link
                  key={m.id}
                  href={`/imagery/${m.id}`}
                  title={`${m.songCount} 首作品写到`}
                  className={cn(
                    "font-calligraphy leading-[1.3] transition-opacity hover:opacity-70",
                    motifSize(m.songCount, maxCount),
                    paletteText(m.palette),
                  )}
                >
                  {m.name}
                </Link>
              ))}
            </div>
          </div>

          {/* 寻曲：第一题原样摆出 */}
          {data.question && (
            <div className="mt-10 border-t border-slate-200/70 pt-8 dark:border-slate-800">
              <div className="flex items-baseline justify-between gap-4">
                <h3 className="font-serif text-lg font-semibold tracking-wide text-ink">
                  寻曲
                </h3>
                <span className="text-xs tracking-[0.2em] text-ink-meta">
                  {data.questionCount} 问之一 · {data.question.title}
                </span>
              </div>
              <p className="mt-3 font-serif text-[15px] text-ink-body">
                {data.question.stem}
              </p>
              <ol className="mt-3 space-y-0.5">
                {data.question.options.map((text, i) => (
                  <li key={i}>
                    <Link
                      href={`/quiz?q1=${i}`}
                      className="group flex items-baseline gap-3 py-1 font-kaiti text-sm leading-relaxed text-ink-prose transition-colors hover:text-(--tone)"
                    >
                      <span className="shrink-0 font-serif text-xs text-ink-meta transition-colors group-hover:text-(--tone)">
                        {OPTION_MARKS[i] ?? i + 1}
                      </span>
                      <span>{text}</span>
                    </Link>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
