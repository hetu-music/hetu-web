"use client";

import AppNavbar from "@/components/shared/AppNavbar";
import { useRouter } from "@/i18n/navigation";
import { encodeAnswers } from "@/lib/quiz/codec";
import type { QuizQuestionView } from "@/lib/quiz/views";
import { cn } from "@/lib/utils/utils";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";

interface Props {
  questions: QuizQuestionView[];
  poolSize: number;
}

type Stage = "intro" | "quiz" | "finishing";

/** 选中后停留多久再翻到下一问，让用户看清自己的选择 */
const ADVANCE_DELAY_MS = 360;
const EASE = [0.16, 1, 0.3, 1] as const;

function shuffledIndices(n: number): number[] {
  const arr = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export default function QuizClient({ questions, poolSize }: Props) {
  const t = useTranslations("quiz");
  const tSite = useTranslations("common.site");
  const router = useRouter();

  const [stage, setStage] = useState<Stage>("intro");
  // 选项展示顺序每次启程时随机打乱（在事件中生成，避免 SSR 水合不一致）
  const [order, setOrder] = useState<number[][]>([]);
  const [answers, setAnswers] = useState<(number | null)[]>(() =>
    questions.map(() => null),
  );
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  const advanceTimer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (advanceTimer.current) window.clearTimeout(advanceTimer.current);
    },
    [],
  );

  const start = useCallback(() => {
    setOrder(questions.map((q) => shuffledIndices(q.options.length)));
    setAnswers(questions.map(() => null));
    setIndex(0);
    setDirection(1);
    setStage("quiz");
    window.scrollTo({ top: 0 });
  }, [questions]);

  const choose = useCallback(
    (optionIndex: number) => {
      if (advanceTimer.current) return; // 翻页动画进行中，忽略连点
      const next = [...answers];
      next[index] = optionIndex;
      setAnswers(next);
      advanceTimer.current = window.setTimeout(() => {
        advanceTimer.current = null;
        if (index < questions.length - 1) {
          setDirection(1);
          setIndex(index + 1);
          return;
        }
        setStage("finishing");
        router.push(`/quiz/result?a=${encodeAnswers(next as number[])}`);
      }, ADVANCE_DELAY_MS);
    },
    [answers, index, questions.length, router],
  );

  const goBack = useCallback(() => {
    if (advanceTimer.current) return;
    if (index === 0) {
      setStage("intro");
      return;
    }
    setDirection(-1);
    setIndex(index - 1);
  }, [index]);

  // 桌面端可用数字键 1–4 作答
  useEffect(() => {
    if (stage !== "quiz") return;
    const onKey = (e: KeyboardEvent) => {
      const n = Number(e.key);
      const shown = order[index];
      if (shown && n >= 1 && n <= shown.length) choose(shown[n - 1]);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [stage, order, index, choose]);

  const question = questions[index];
  const siteName = tSite("name");

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-slate-800 dark:bg-[#0B0F19] dark:text-slate-200">
      <AppNavbar
        title={
          <>
            {siteName.substring(0, 2)}
            <span className="mx-2 h-5 w-[2px] translate-y-[1.5px] rounded-full bg-blue-600" />
            {siteName.substring(2)}
          </>
        }
        onTitleClick={() => router.push("/")}
      />

      <main className="mx-auto flex min-h-screen max-w-2xl flex-col px-6 pb-24 pt-32">
        <AnimatePresence mode="wait">
          {stage === "intro" && (
            <motion.section
              key="intro"
              initial={{ opacity: 0, y: 12 }}
              animate={{
                opacity: 1,
                y: 0,
                transition: { duration: 0.8, ease: EASE },
              }}
              exit={{
                opacity: 0,
                filter: "blur(8px)",
                transition: { duration: 0.3 },
              }}
              className="flex flex-1 flex-col items-center justify-center text-center"
            >
              <p className="pl-[0.5em] font-serif text-sm tracking-[0.5em] text-slate-400 dark:text-slate-500">
                {t("intro.eyebrow")}
              </p>
              <h1 className="my-8 font-calligraphy text-8xl text-slate-900 md:text-9xl dark:text-white">
                {t("title")}
              </h1>
              <p className="pl-[0.3em] font-serif text-base tracking-[0.3em] text-slate-600 md:text-lg dark:text-slate-300">
                {t("intro.subtitle", { count: poolSize })}
              </p>
              <p className="mt-4 font-kaiti text-sm text-slate-400 dark:text-slate-500">
                {t("intro.note")}
              </p>
              <button
                onClick={start}
                disabled={poolSize === 0}
                className="group relative mt-16 border border-slate-300 px-12 py-3 pl-[calc(3rem+0.6em)] font-serif text-lg tracking-[0.6em] text-slate-700 transition-all duration-500 hover:border-[#9A6B2F] hover:text-[#9A6B2F] disabled:opacity-40 dark:border-slate-700 dark:text-slate-200 dark:hover:border-[#D4A259] dark:hover:text-[#D4A259]"
              >
                {t("intro.start")}
              </button>
            </motion.section>
          )}

          {stage === "quiz" && question && (
            <motion.section
              key="quiz"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, transition: { duration: 0.25 } }}
              className="flex flex-1 flex-col"
            >
              {/* 进度 */}
              <div className="mb-12">
                <div className="h-px w-full bg-slate-200 dark:bg-slate-800">
                  <motion.div
                    className="h-px bg-[#9A6B2F] dark:bg-[#D4A259]"
                    animate={{
                      width: `${((index + 1) / questions.length) * 100}%`,
                    }}
                    transition={{ duration: 0.6, ease: EASE }}
                  />
                </div>
                <p className="mt-3 font-serif text-xs tracking-[0.3em] text-slate-400 dark:text-slate-500">
                  {t("question.progress", {
                    current: index + 1,
                    total: questions.length,
                  })}
                </p>
              </div>

              <AnimatePresence mode="wait" custom={direction}>
                <motion.div
                  key={index}
                  custom={direction}
                  initial={{ opacity: 0, x: 28 * direction }}
                  animate={{
                    opacity: 1,
                    x: 0,
                    transition: { duration: 0.5, ease: EASE },
                  }}
                  exit={{
                    opacity: 0,
                    x: -28 * direction,
                    transition: { duration: 0.2 },
                  }}
                >
                  <p className="font-calligraphy text-4xl text-[#9A6B2F] dark:text-[#D4A259]">
                    {question.title}
                  </p>
                  <h2 className="mt-5 font-serif text-2xl leading-relaxed text-slate-900 md:text-[28px] dark:text-slate-50">
                    {question.stem}
                  </h2>

                  <ul className="mt-10 space-y-3">
                    {(order[index] ?? []).map((optionIndex, n) => {
                      const selected = answers[index] === optionIndex;
                      return (
                        <li key={optionIndex}>
                          <button
                            onClick={() => choose(optionIndex)}
                            className={cn(
                              "group flex w-full items-baseline gap-4 rounded-sm border px-5 py-4 text-left font-serif text-base leading-relaxed transition-all duration-300 md:text-lg",
                              selected
                                ? "border-[#9A6B2F] bg-[#9A6B2F]/[0.06] text-[#7A5222] dark:border-[#D4A259] dark:bg-[#D4A259]/10 dark:text-[#E8C48A]"
                                : "border-slate-200 text-slate-700 hover:border-slate-400 hover:bg-white dark:border-slate-800 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:bg-slate-900/60",
                            )}
                          >
                            <span
                              className={cn(
                                "font-mono text-xs transition-colors",
                                selected
                                  ? "text-[#9A6B2F] dark:text-[#D4A259]"
                                  : "text-slate-300 group-hover:text-slate-500 dark:text-slate-600",
                              )}
                            >
                              {n + 1}
                            </span>
                            <span>{question.options[optionIndex]}</span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </motion.div>
              </AnimatePresence>

              <button
                onClick={goBack}
                className="mt-10 flex items-center gap-2 self-start font-serif text-sm tracking-widest text-slate-400 transition-colors hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-300"
              >
                <ArrowLeft size={14} />
                {t("question.prev")}
              </button>
            </motion.section>
          )}

          {stage === "finishing" && (
            <motion.section
              key="finishing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-1 items-center justify-center"
            >
              <motion.p
                animate={{ opacity: [0.3, 1, 0.3] }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
                className="font-kaiti text-2xl tracking-[0.4em] text-slate-500 dark:text-slate-400"
              >
                {t("question.finishing")}
              </motion.p>
            </motion.section>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
