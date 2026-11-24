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

function paletteText(palette: number): string {
  return palette >= 0
    ? PALETTE_FULL[palette % PALETTE_FULL.length].text
    : GRAY_PALETTE.text;
}

/**
 * 特展（思路 2 · 极轻切片横栏）：
 * 紧接「二十扇屏」下方的一条极轻无框三列索引（约 86px 高），不抢屏风主角、不把编年曲库推深；
 * 每列仍只取真实内容的一小口切片作门面：一帧微缩雪景题图、五枚高频刻本母题、寻曲第一问题干。
 */
export default function FeatureBand({ data }: { data: FeatureData }) {
  const topMotifs = data.motifs.slice(0, 5);

  return (
    <nav
      aria-label="站点特辑"
      className="mt-4 border-y border-slate-200/75 dark:border-slate-800/80"
    >
      <div className="grid divide-y divide-slate-200/70 lg:grid-cols-3 lg:divide-x lg:divide-y-0 dark:divide-slate-800/75">
        {/* 1. 倾尽天下：书籍题图式极小缩影 + 题名与一句楷体 */}
        <Link
          href="/story/qjtx"
          className="group flex min-w-0 items-center gap-4 py-4 outline-none lg:pr-7"
        >
          <div className="relative h-13 w-20 shrink-0 overflow-hidden rounded-[3px] ring-1 ring-slate-900/8 dark:ring-white/10">
            <Image
              src="/story/qjtx/31.avif"
              alt="倾尽天下长卷缩影"
              fill
              sizes="80px"
              className="object-cover grayscale-[35%] transition-all duration-700 ease-page group-hover:scale-[1.04] group-hover:grayscale-0 group-focus-visible:grayscale-0"
            />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2">
              <span className="truncate font-serif text-[16px] font-semibold tracking-wide text-ink transition-colors group-hover:text-(--tone)">
                倾尽天下
              </span>
              <span aria-hidden className="text-ink-faint">
                ·
              </span>
              <span className="shrink-0 text-[11px] tracking-[0.22em] text-ink-meta">
                互动长卷
              </span>
            </div>
            <p className="mt-1 truncate font-kaiti text-[13px] text-ink-muted transition-colors group-hover:text-ink-prose">
              一曲长歌，随乐声缓步展开江山旧梦
            </p>
          </div>
        </Link>

        {/* 2. 意象词云：题名 + 前五枚真实刻本母题直达 */}
        <div className="flex min-w-0 flex-col justify-center py-4 lg:px-7">
          <div className="flex items-baseline justify-between gap-2">
            <Link
              href="/imagery"
              className="group flex min-w-0 items-baseline gap-2 outline-none"
            >
              <span className="truncate font-serif text-[16px] font-semibold tracking-wide text-ink transition-colors group-hover:text-(--tone)">
                意象词云
              </span>
              <span aria-hidden className="text-ink-faint">
                ·
              </span>
              <span className="shrink-0 text-[11px] tracking-[0.2em] text-ink-meta">
                {data.motifCount > 0 ? `${data.motifCount} 个母题` : "词中万象"}
              </span>
            </Link>
            <Link
              href="/imagery"
              aria-label="进入意象词云"
              className="shrink-0 text-xs text-ink-meta transition-colors hover:text-(--tone)"
            >
              →
            </Link>
          </div>

          {topMotifs.length > 0 ? (
            <div className="mt-1.5 flex items-baseline gap-x-3.5 overflow-hidden">
              {topMotifs.map((m) => (
                <Link
                  key={m.id}
                  href={`/imagery/${m.id}`}
                  title={`${m.songCount} 首作品写到`}
                  className={cn(
                    "shrink-0 font-calligraphy text-[17px] leading-none transition-opacity duration-300 hover:opacity-65",
                    paletteText(m.palette),
                  )}
                >
                  {m.name}
                </Link>
              ))}
            </div>
          ) : (
            <Link
              href="/imagery"
              className="mt-1 truncate font-kaiti text-[13px] text-ink-muted transition-colors hover:text-ink-prose"
            >
              从长安白雪到孤城旧梦，漫游词中谱系
            </Link>
          )}
        </div>

        {/* 3. 寻曲：题名 + 第一问真实题干引句 */}
        <Link
          href="/quiz"
          className="group flex min-w-0 flex-col justify-center py-4 outline-none lg:pl-7"
        >
          <div className="flex items-baseline justify-between gap-2">
            <div className="flex min-w-0 items-baseline gap-2">
              <span className="truncate font-serif text-[16px] font-semibold tracking-wide text-ink transition-colors group-hover:text-(--tone)">
                寻曲
              </span>
              <span aria-hidden className="text-ink-faint">
                ·
              </span>
              <span className="shrink-0 text-[11px] tracking-[0.22em] text-ink-meta">
                {data.questionCount > 0
                  ? `${data.questionCount} 问之一`
                  : "十二问寻歌"}
              </span>
            </div>
            <span
              aria-hidden
              className="shrink-0 text-xs text-ink-meta transition-colors group-hover:text-(--tone)"
            >
              →
            </span>
          </div>

          <p className="mt-1 truncate font-kaiti text-[13px] text-ink-muted transition-colors group-hover:text-ink-prose">
            {data.question
              ? `「${data.question.stem}」`
              : "十二个问题，一段旅程，寻一首懂你的歌"}
          </p>
        </Link>
      </div>
    </nav>
  );
}
