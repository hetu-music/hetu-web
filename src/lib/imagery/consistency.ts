/**
 * 意象标注的时间标签与一致性检查（规则见 IMAGERY.md）。纯逻辑，供服务端、scripts/imagery-check.ts 与单测共用。
 *
 * 时间标签不存（DATABASE.md 第四节）：恰好是词在本曲字面出现的行，读的时候按同一版本的歌词算。
 *
 * 一致性检查三件事：
 * - 每个词都有默认母题
 * - 每条标注都挂在该词登记的母题上
 * - 标注的词在歌词里找得到
 */
import { parseLrcLines, type LrcLine, type MotifEntry } from "./suggest";

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
 * 一首歌各标注词的时间标签。歌词没有时间轴时返回 null（无从定位）。
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

/** 一个版本的歌词与它标注的全部词名，算时间标签要用 */
export interface VersionWords {
  lyrics: string | null;
  names: readonly string[];
}

/**
 * 给标注补上时间标签。rows 可以只是一个版本里的部分标注（后台按词查），
 * 被更长词覆盖的判断看 versions 里这个版本的全部词名。歌词没有时间轴、或查不到版本时标签为空。
 */
export function withTimetags<
  T extends { version_id: number; imagery_name: string },
>(
  rows: readonly T[],
  versions: ReadonlyMap<number, VersionWords>,
): Array<T & { lyric_timetag: string[] }> {
  const namesOf = new Map<number, Set<string>>();
  for (const row of rows) {
    let names = namesOf.get(row.version_id);
    if (!names) {
      names = new Set(versions.get(row.version_id)?.names ?? []);
      namesOf.set(row.version_id, names);
    }
    names.add(row.imagery_name);
  }
  const tagsOf = new Map(
    [...namesOf].map(([versionId, names]) => [
      versionId,
      songTimetags(versions.get(versionId)?.lyrics, [...names]),
    ]),
  );
  return rows.map((row) => ({
    ...row,
    lyric_timetag: tagsOf.get(row.version_id)?.get(row.imagery_name) ?? [],
  }));
}

export interface CheckOccurrence {
  id: number;
  song_id: number;
  imagery_id: number;
  motif_id: number;
}

export interface ConsistencyReport {
  /** 没有默认母题的词 */
  noPrimary: Array<{ id: number; name: string }>;
  /** 挂在登记之外母题上的标注 */
  offCandidate: number[];
  /** 歌词里找不到的词（或只出现在同曲更长的标注词里）：要删掉，或改标歌词里实际写的词 */
  notFound: Array<{ occurrenceId: number; songId: number; name: string }>;
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
        !motifsOf.get(o.imagery_id)?.some((m) => m.motif_id === o.motif_id),
    )
    .map((o) => o.id);

  const bySong = new Map<number, CheckOccurrence[]>();
  for (const o of input.occurrences) {
    const list = bySong.get(o.song_id) ?? [];
    list.push(o);
    bySong.set(o.song_id, list);
  }
  const lyricsOf = new Map(input.songs.map((s) => [s.id, s.lyrics]));
  const notFound: ConsistencyReport["notFound"] = [];
  for (const [songId, list] of bySong) {
    const names = [...new Set(list.map((o) => nameOf.get(o.imagery_id) ?? ""))];
    const expected = songTimetags(lyricsOf.get(songId), names);
    // 没有带时间轴的歌词时无从核对
    if (!expected) continue;
    for (const o of list) {
      const name = nameOf.get(o.imagery_id);
      if (name && (expected.get(name) ?? []).length === 0) {
        notFound.push({ occurrenceId: o.id, songId, name });
      }
    }
  }

  return { noPrimary, offCandidate, notFound };
}

/**
 * 一条标注算进的一个母题。挂默认母题的并列词（「风雨」）展开成几行，
 * 母题不同，词与时间标签相同
 */
export type IndexOccurrence = {
  song_id: number;
  imagery_id: number;
  motif_id: number;
  lyric_timetag: string[];
};

/** published_song_imagery 的一行 */
export type PublishedAnnotation = {
  song_id: number;
  version_id: number;
  imagery_id: number;
  motif_id: number;
  part_motif_ids: number[] | null;
};

/** 按线上版本的歌词算时间标签，并把「同时算进」展开成行 */
export function expandAnnotations(
  annotations: readonly PublishedAnnotation[],
  lyricsOf: ReadonlyMap<number, string | null>,
  nameOf: ReadonlyMap<number, string>,
): IndexOccurrence[] {
  const namesByVersion = new Map<number, Set<string>>();
  for (const a of annotations) {
    const name = nameOf.get(a.imagery_id);
    if (!name) continue;
    let names = namesByVersion.get(a.version_id);
    if (!names) namesByVersion.set(a.version_id, (names = new Set()));
    names.add(name);
  }
  const tagsByVersion = new Map(
    [...namesByVersion].map(([versionId, names]) => [
      versionId,
      songTimetags(lyricsOf.get(versionId), [...names]),
    ]),
  );
  return annotations.flatMap((a) => {
    const name = nameOf.get(a.imagery_id);
    const lyric_timetag =
      (name && tagsByVersion.get(a.version_id)?.get(name)) || [];
    return [a.motif_id, ...(a.part_motif_ids ?? [])].map((motif_id) => ({
      song_id: a.song_id,
      imagery_id: a.imagery_id,
      motif_id,
      lyric_timetag,
    }));
  });
}
