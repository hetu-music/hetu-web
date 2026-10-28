import type { Answers, QuizQuestion } from "./types";

const LETTERS = "ABCDEFGH";

/** 作答 → 字母短串，如 [0, 3, 1] → "ADB"；只作留档，不进链接 */
export function encodeAnswers(answers: Answers): string {
  return answers.map((i) => LETTERS[i]).join("");
}

/**
 * 字母短串 → 作答；长度或选项不合法时返回 null。
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

// ─── 结果页链接里的乱码 ───────────────────────────────────────────────────────
//
// 作答按各题选项数做混合进制，拼上校验位，再用 Feistel 网络打乱，最后转成 base62。
// 只是混淆，不是加密：目的是让链接看不出答案，只差一题的两个结果也互不相像。
// 校验位挡住手误改坏的链接；题目数或选项数变了，旧链接校验不过，视为无效。
// 不带题目版本：题目调整后旧链接按新题目解读，访客结果本来就随题库变。

const BASE62 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const CHECK_BITS = 16;
const FEISTEL_KEYS = [0x2f6b1a3d, 0x71c9e845, 0x0d5a93b7, 0x5e38c2f1];

type SlugLayout = {
  /** 作答组合总数 */
  combos: number;
  /** 校验位数：凑成偶数总位数，Feistel 两半才一样宽 */
  checkBits: number;
  /** 每半的位数 */
  half: number;
  length: number;
};

function slugLayout(optionCounts: readonly number[]): SlugLayout {
  const combos = optionCounts.reduce((n, c) => n * c, 1);
  const answerBits = Math.max(1, Math.ceil(Math.log2(combos)));
  const checkBits = CHECK_BITS + ((answerBits + CHECK_BITS) % 2);
  const half = (answerBits + checkBits) / 2;
  // 两半各自要能放进 32 位整数运算；12 道 4 选项的题是 20 位
  if (half > 26) throw new Error("题目组合太多，乱码放不下");
  let length = 1;
  while (62 ** length < 2 ** (half * 2)) length += 1;
  return { combos, checkBits, half, length };
}

/** 结果页乱码的长度；保存过的记录用别的长度，以此区分 */
export function resultSlugLength(optionCounts: readonly number[]): number {
  return slugLayout(optionCounts).length;
}

function checksum(value: number, bits: number): number {
  const lo = value % 2 ** 32;
  const hi = Math.floor(value / 2 ** 32);
  let h =
    Math.imul(lo ^ 0x5bd1e995, 0x27d4eb2d) ^ Math.imul(hi + 1, 0x85ebca6b);
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d);
  h ^= h >>> 13;
  return (h >>> 0) % 2 ** bits;
}

function round(x: number, key: number, half: number): number {
  return Math.imul((x + key) | 0, 0x9e3779b1) >>> (32 - half);
}

function scramble(value: number, half: number, inverse: boolean): number {
  const size = 2 ** half;
  let left = Math.floor(value / size);
  let right = value % size;
  const keys = inverse ? [...FEISTEL_KEYS].reverse() : FEISTEL_KEYS;
  for (const key of keys) {
    if (inverse) {
      [left, right] = [right ^ round(left, key, half), left];
    } else {
      [left, right] = [right, left ^ round(right, key, half)];
    }
  }
  return left * size + right;
}

/** 作答 → 结果页链接里的乱码 */
export function encodeResultSlug(
  answers: Answers,
  optionCounts: readonly number[],
): string {
  const layout = slugLayout(optionCounts);
  let index = 0;
  for (let q = answers.length - 1; q >= 0; q -= 1) {
    index = index * optionCounts[q] + answers[q];
  }
  let value = scramble(
    index * 2 ** layout.checkBits + checksum(index, layout.checkBits),
    layout.half,
    false,
  );
  let slug = "";
  for (let i = 0; i < layout.length; i += 1) {
    slug = BASE62[value % 62] + slug;
    value = Math.floor(value / 62);
  }
  return slug;
}

/** 乱码 → 作答；长度、字符或校验不对时返回 null */
export function decodeResultSlug(
  slug: string | null | undefined,
  optionCounts: readonly number[],
): number[] | null {
  const layout = slugLayout(optionCounts);
  if (!slug || slug.length !== layout.length) return null;
  let value = 0;
  for (const ch of slug) {
    const digit = BASE62.indexOf(ch);
    if (digit < 0) return null;
    value = value * 62 + digit;
  }
  if (value >= 2 ** (layout.half * 2)) return null;

  const plain = scramble(value, layout.half, true);
  const check = plain % 2 ** layout.checkBits;
  let index = Math.floor(plain / 2 ** layout.checkBits);
  if (index >= layout.combos) return null;
  if (check !== checksum(index, layout.checkBits)) return null;

  const answers: number[] = [];
  for (const count of optionCounts) {
    answers.push(index % count);
    index = Math.floor(index / count);
  }
  return answers;
}
