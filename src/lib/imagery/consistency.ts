/**
 * 意象标注的一致性检查（规则见 IMAGERY.md）。纯逻辑，供 scripts/imagery-check.ts、
 * 写标注的服务端与单测共用。
 *
 * 检查四件事：
 * - 每个词都有默认母题
 * - 每条标注都挂在该词登记的母题上
 * - 并列词挂了默认母题时，其余组成也各有一条
 * - 时间标签恰好是词在本曲字面出现的所有行（被同曲更长标注覆盖的行除外）
 */
import { parseLrcLines, type LrcLine, type MotifEntry } from "./suggest";

export interface CheckOccurrence {
  id: number;
  song_id: number;
  imagery_id: number;
  category_id: number;
  lyric_timetag: string[] | null;
}

export interface TimetagIssue {
  occurrenceId: number;
  songId: number;
  name: string;
  current: string[];
  /** 应有的时间标签：词字面出现的行 */
  fixed: string[];
  /** 词字面出现但没标的行 */
  missing: string[];
  /** 多出的标签：标在没有该词的行上，或歌词里已不存在（多半是歌词改过时间轴） */
  extra: string[];
  /** 歌词里一处都找不到这个词：标注本身有误，要删掉或改标歌词里实际写的词 */
  notFound: boolean;
}

export interface ConsistencyReport {
  /** 没有默认母题的词 */
  noPrimary: Array<{ id: number; name: string }>;
  /** 挂在登记之外母题上的标注 */
  offCandidate: number[];
  /** 并列词缺的组成：哪首歌、哪个词、缺哪个母题 */
  missingParts: Array<{
    songId: number;
    imageryId: number;
    categoryId: number;
  }>;
  /** 时间标签有出入的标注 */
  timetags: TimetagIssue[];
}

/** 比对用的形式：英文不分大小写；行内空白不算（「地老 天荒」即「地老天荒」） */
function normalize(text: string): string {
  return text.toLowerCase().replace(/\s+/g, "");
}

/**
 * 词在歌词里出现的行：至少有一处不落在同曲更长的标注词里（「岁月」里的「月」不算）。
 * 返回时间标签，按时间顺序去重。
 */
export function linesForWord(
  lines: readonly LrcLine[],
  name: string,
  songNames: readonly string[],
): string[] {
  const target = normalize(name);
  if (!target) return [];
  const longer = songNames
    .map(normalize)
    .filter((n) => n.length > target.length && n.includes(target))
    .sort((a, b) => b.length - a.length);
  const tags: string[] = [];
  for (const line of lines) {
    let rest = normalize(line.text);
    for (const word of longer) rest = rest.split(word).join("\u0000");
    if (rest.includes(target) && !tags.includes(line.tag)) tags.push(line.tag);
  }
  return tags;
}

/**
 * 一首歌各标注词应有的时间标签。歌词没有时间轴时返回 null（无从定位，标签留空）。
 * names 为该歌标注的全部词，用来排除被更长词覆盖的行。
 */
export function songTimetags(
  lyrics: string | null | undefined,
  names: readonly string[],
): Map<string, string[]> | null {
  const lines = parseLrcLines(lyrics);
  if (lines.length === 0) return null;
  return new Map(names.map((n) => [n, linesForWord(lines, n, names)]));
}

export function checkConsistency(input: {
  imagery: ReadonlyArray<{ id: number; name: string }>;
  motifs: readonly MotifEntry[];
  occurrences: readonly CheckOccurrence[];
  songs: ReadonlyArray<{ id: number; lyrics: string | null }>;
}): ConsistencyReport {
  const nameOf = new Map(input.imagery.map((i) => [i.id, i.name]));
  const motifsOf = new Map<number, MotifEntry[]>();
  for (const m of input.motifs) {
    const list = motifsOf.get(m.imagery_id) ?? [];
    list.push(m);
    motifsOf.set(m.imagery_id, list);
  }

  const noPrimary = input.imagery
    .filter((i) => !motifsOf.get(i.id)?.some((m) => m.role === "primary"))
    .map((i) => ({ id: i.id, name: i.name }));

  const offCandidate = input.occurrences
    .filter(
      (o) =>
        !motifsOf
          .get(o.imagery_id)
          ?.some((m) => m.category_id === o.category_id),
    )
    .map((o) => o.id);

  // 按歌分组，便于查并列词与同曲的更长标注
  const bySong = new Map<number, CheckOccurrence[]>();
  for (const o of input.occurrences) {
    const list = bySong.get(o.song_id) ?? [];
    list.push(o);
    bySong.set(o.song_id, list);
  }

  const missingParts: ConsistencyReport["missingParts"] = [];
  for (const [songId, list] of bySong) {
    for (const o of list) {
      const motifs = motifsOf.get(o.imagery_id) ?? [];
      const primary = motifs.find((m) => m.role === "primary");
      if (primary?.category_id !== o.category_id) continue;
      for (const part of motifs.filter((m) => m.role === "part")) {
        const present = list.some(
          (x) =>
            x.imagery_id === o.imagery_id && x.category_id === part.category_id,
        );
        if (!present) {
          missingParts.push({
            songId,
            imageryId: o.imagery_id,
            categoryId: part.category_id,
          });
        }
      }
    }
  }

  const lyricsOf = new Map(input.songs.map((s) => [s.id, s.lyrics]));
  const timetags: TimetagIssue[] = [];
  for (const [songId, list] of bySong) {
    const names = [...new Set(list.map((o) => nameOf.get(o.imagery_id) ?? ""))];
    const expected = songTimetags(lyricsOf.get(songId), names);
    // 没有带时间轴的歌词时无从核对
    if (!expected) continue;
    for (const o of list) {
      const name = nameOf.get(o.imagery_id);
      if (!name) continue;
      const fixed = expected.get(name) ?? [];
      const current = o.lyric_timetag ?? [];
      const missing = fixed.filter((t) => !current.includes(t));
      const extra = current.filter((t) => !fixed.includes(t));
      // 长度不同说明有重复的标签
      if (
        missing.length + extra.length === 0 &&
        current.length === fixed.length
      ) {
        continue;
      }
      timetags.push({
        occurrenceId: o.id,
        songId,
        name,
        current,
        fixed,
        missing,
        extra,
        notFound: fixed.length === 0,
      });
    }
  }

  return { noPrimary, offCandidate, missingParts, timetags };
}
