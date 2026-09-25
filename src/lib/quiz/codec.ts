import type { Answers, QuizQuestion } from "./types";

const LETTERS = "ABCDEFGH";

/** 作答 → URL 短串，如 [0, 3, 1] → "ADB" */
export function encodeAnswers(answers: Answers): string {
  return answers.map((i) => LETTERS[i]).join("");
}

/**
 * URL 短串 → 作答；长度或选项不合法时返回 null。
 */
export function decodeAnswers(
  code: string | null | undefined,
  questions: readonly QuizQuestion[],
): number[] | null {
  if (!code || code.length !== questions.length) return null;
  const answers: number[] = [];
  for (let q = 0; q < questions.length; q += 1) {
    const index = LETTERS.indexOf(code[q].toUpperCase());
    if (index < 0 || index >= questions[q].options.length) return null;
    answers.push(index);
  }
  return answers;
}
