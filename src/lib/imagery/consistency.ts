/**
 * 意象标注的一致性检查（规则见 IMAGERY.md）。纯逻辑，供 scripts/imagery-check.ts 与单测共用。
 *
 * 检查四件事：
 * - 每个词都有默认母题
 * - 每条标注都挂在该词登记的母题上
 * - 并列词挂了默认母题时，其余组成也各有一条
 * - 时间标签覆盖词在本曲字面出现的所有行（被同曲更长标注覆盖的行除外），且都指向现存的歌词行
 *
 * 标在没有出现该词、但确实在写它的行上（「雪吹满鬓发」之于白发）是允许的，只提示不算错。
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
  /** 修复后的时间标签：补上漏标的行、去掉歌词里已不存在的标签，其余保持原样 */
  fixed: string[];
  /** 词字面出现但没标的行 */
  missing: string[];
  /** 歌词里已不存在的时间标签（多半是歌词改过时间轴） */
  stale: string[];
  /** 标在没有出现该词的行上：可能是有意的引申，也可能标错了，由人判断 */
  offLine: string[];
  /** 歌词里一处都找不到这个词 */
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

/**
 * 词在歌词里出现的行：至少有一处不落在同曲更长的标注词里（「岁月」里的「月」不算）。
 * 英文词大小写不敏感。返回时间标签，按时间顺序去重。
 */
export function linesForWord(
  lines: readonly LrcLine[],
  name: string,
  longerNames: readonly string[],
): string[] {
  const target = name.toLowerCase();
  const longer = longerNames
    .map((n) => n.toLowerCase())
    .filter((n) => n.length > target.length && n.includes(target))
    .sort((a, b) => b.length - a.length);
  const tags: string[] = [];
  for (const line of lines) {
    let rest = line.text.toLowerCase();
    for (const word of longer) rest = rest.split(word).join("\u0000");
    if (rest.includes(target) && !tags.includes(line.tag)) tags.push(line.tag);
  }
  return tags;
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
    const lines = parseLrcLines(lyricsOf.get(songId));
    // 没有带时间标签的歌词时无从核对
    if (lines.length === 0) continue;
    const names = [...new Set(list.map((o) => nameOf.get(o.imagery_id) ?? ""))];
    for (const o of list) {
      const name = nameOf.get(o.imagery_id);
      if (!name) continue;
      const literal = linesForWord(lines, name, names);
      const current = o.lyric_timetag ?? [];
      const existing = new Set(lines.map((l) => l.tag));
      const missing = literal.filter((t) => !current.includes(t));
      const stale = current.filter((t) => !existing.has(t));
      const offLine = current.filter(
        (t) => existing.has(t) && !literal.includes(t),
      );
      if (missing.length + stale.length + offLine.length === 0) continue;
      timetags.push({
        occurrenceId: o.id,
        songId,
        name,
        current,
        fixed: lines
          .map((l) => l.tag)
          .filter(
            (t, i, all) =>
              all.indexOf(t) === i &&
              (literal.includes(t) || (current.includes(t) && existing.has(t))),
          ),
        missing,
        stale,
        offLine,
        notFound: literal.length === 0,
      });
    }
  }

  return { noPrimary, offCandidate, missingParts, timetags };
}
