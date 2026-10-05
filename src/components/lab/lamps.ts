import type { Song } from "@/lib/types";

/**
 * 灯：主页唯一的检索机制。每盏灯照亮一些作品；
 * 同一组的灯相加（或），不同组的灯相交（且）——也就是分面筛选。
 */

export type CreditRole = "artist" | "lyricist" | "composer" | "arranger";

export const CREDIT_ROLES: readonly CreditRole[] = [
  "artist",
  "lyricist",
  "composer",
  "arranger",
];

export const ROLE_LABEL: Record<CreditRole, string> = {
  artist: "演唱",
  lyricist: "作词",
  composer: "作曲",
  arranger: "编曲",
};

export type Lamp =
  | { kind: "imagery"; id: number }
  /** 寻曲第一问的答案，照亮所选答案对应的招牌意象 */
  | { kind: "quiz"; option: number }
  | { kind: "type"; value: string }
  | { kind: "genre"; value: string }
  /** 年份区间，首尾都含；同时只有一盏 */
  | { kind: "year"; from: number; to: number }
  /** 不给角色时，任何署名里有这个名字都算 */
  | { kind: "credit"; name: string; role?: CreditRole }
  | { kind: "mine" };

export type LampGroup =
  "query" | "imagery" | "type" | "genre" | "year" | "credit" | "mine";

/** 寻曲的答案说的也是意象，与意象灯同组相加 */
export const groupOf = (lamp: Lamp): LampGroup =>
  lamp.kind === "quiz" ? "imagery" : lamp.kind;

export function lampKey(lamp: Lamp): string {
  switch (lamp.kind) {
    case "imagery":
      return `imagery:${lamp.id}`;
    case "quiz":
      return "quiz";
    case "type":
    case "genre":
      return `${lamp.kind}:${lamp.value}`;
    case "year":
      return "year";
    case "credit":
      return `credit:${lamp.role ?? "*"}:${lamp.name}`;
    case "mine":
      return "mine";
  }
}

export function lampLabel(
  lamp: Lamp,
  names: {
    imagery: (id: number) => string | undefined;
    quiz: (option: number) => string;
  },
): string {
  switch (lamp.kind) {
    case "imagery":
      return names.imagery(lamp.id) ?? "";
    case "quiz":
      return names.quiz(lamp.option);
    case "type":
    case "genre":
      return lamp.value;
    case "year":
      return lamp.from === lamp.to
        ? String(lamp.from)
        : `${lamp.from}—${lamp.to}`;
    case "credit":
      return lamp.role ? `${ROLE_LABEL[lamp.role]} ${lamp.name}` : lamp.name;
    case "mine":
      return "我的收藏";
  }
}

export const allCredits = (s: Song): string[] => [
  ...(s.artist ?? []),
  ...(s.lyricist ?? []),
  ...(s.composer ?? []),
  ...(s.arranger ?? []),
];

export interface LampContext {
  songImagery: Record<number, number[]>;
  quizImagery: (option: number) => number[];
  favorites: ReadonlySet<number>;
  /** 歌词纯文本（已转小写）；还没拉到时为 null，只按题名与署名搜 */
  lyrics: ReadonlyMap<number, string> | null;
}

export function matchLamp(lamp: Lamp, s: Song, ctx: LampContext): boolean {
  switch (lamp.kind) {
    case "imagery":
      return (ctx.songImagery[s.id] ?? []).includes(lamp.id);
    case "quiz": {
      const wanted = ctx.quizImagery(lamp.option);
      return (ctx.songImagery[s.id] ?? []).some((id) => wanted.includes(id));
    }
    case "type":
      return (s.type ?? []).includes(lamp.value);
    case "genre":
      return (s.genre ?? []).includes(lamp.value);
    case "year":
      return s.year != null && s.year >= lamp.from && s.year <= lamp.to;
    case "credit":
      return (lamp.role ? (s[lamp.role] ?? []) : allCredits(s)).includes(
        lamp.name,
      );
    case "mine":
      return ctx.favorites.has(s.id);
  }
}

export function matchQuery(q: string, s: Song, ctx: LampContext): boolean {
  const hay = [s.title, s.album, ...allCredits(s), ...(s.creditAliases ?? [])]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return hay.includes(q) || !!ctx.lyrics?.get(s.id)?.includes(q);
}

/**
 * 按当前的灯与搜索词建一个判定器。
 * `passes(s, except)` 判断一首歌是否通过除 `except` 那一组以外的全部灯，
 * 用来算「在其他灯之下，再点这一盏会亮几首」。
 */
export function makeTester(lamps: Lamp[], query: string, ctx: LampContext) {
  const q = query.trim().toLowerCase();
  const groups = new Map<LampGroup, Lamp[]>();
  for (const lamp of lamps) {
    const g = groupOf(lamp);
    groups.set(g, [...(groups.get(g) ?? []), lamp]);
  }
  const active: LampGroup[] = [
    ...(q ? ["query" as const] : []),
    ...groups.keys(),
  ];
  const testGroup = (g: LampGroup, s: Song) =>
    g === "query"
      ? matchQuery(q, s, ctx)
      : (groups.get(g) ?? []).some((lamp) => matchLamp(lamp, s, ctx));

  return {
    on: active.length > 0,
    passes: (s: Song, except?: LampGroup) =>
      active.every((g) => g === except || testGroup(g, s)),
    /** 在其他组的灯之下，这一盏能照亮几首 */
    count: (songs: Song[], lamp: Lamp) =>
      songs.filter(
        (s) =>
          active.every((g) => g === groupOf(lamp) || testGroup(g, s)) &&
          matchLamp(lamp, s, ctx),
      ).length,
  };
}

export type LampTester = ReturnType<typeof makeTester>;
