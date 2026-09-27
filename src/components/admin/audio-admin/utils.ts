import {
  baseTitle,
  DURATION_TOLERANCE,
  normalize,
  type DbSong,
  type MappingRow,
  type NavSong,
} from "@/lib/navidrome/sync";

export type SongRow = {
  song: DbSong;
  /** navid_song 中记录的 ID，可能指向已不存在的曲目 */
  navidId: string | null;
  /** 映射指向的曲目；映射失效或未关联时为 null */
  nav: NavSong | null;
  /** 曲目时长 − 歌曲时长（秒），任一方未知时为 null */
  durationDiff: number | null;
};

export type RowFilter = "all" | "linked" | "unlinked" | "attention";

export function buildRows(
  songs: DbSong[],
  mappings: MappingRow[],
  library: NavSong[],
): SongRow[] {
  const navById = new Map(library.map((n) => [n.id, n]));
  const navidBySong = new Map(mappings.map((m) => [m.id, m.navid_id]));
  return songs.map((song) => {
    const navidId = navidBySong.get(song.id) ?? null;
    const nav = navidId ? (navById.get(navidId) ?? null) : null;
    const durationDiff =
      nav?.duration != null && song.length != null
        ? nav.duration - song.length
        : null;
    return { song, navidId, nav, durationDiff };
  });
}

/** 需要处理：映射失效、时长对不上，或 has_audio 与映射状态不一致 */
export function needsAttention(row: SongRow): boolean {
  if (row.navidId && !row.nav) return true;
  if (
    row.durationDiff != null &&
    Math.abs(row.durationDiff) > DURATION_TOLERANCE
  )
    return true;
  return Boolean(row.song.has_audio) !== Boolean(row.nav);
}

function matchesQuery(row: SongRow, query: string): boolean {
  if (!query) return true;
  if (String(row.song.id) === query.trim().replace(/^#/, "")) return true;
  const q = normalize(query);
  return [
    row.song.title,
    row.song.album,
    row.nav?.title,
    row.nav?.album,
    row.nav?.path,
  ].some((text) => normalize(text).includes(q));
}

export function filterRows(
  rows: SongRow[],
  filter: RowFilter,
  query: string,
): SongRow[] {
  return rows.filter((row) => {
    if (filter === "linked" && !row.nav) return false;
    if (filter === "unlinked" && row.nav) return false;
    if (filter === "attention" && !needsAttention(row)) return false;
    return matchesQuery(row, query);
  });
}

export type TrackCandidate = {
  nav: NavSong;
  /** 曲目时长 − 歌曲时长（秒） */
  durationDiff: number | null;
  /** 已关联该曲目的其他歌曲 */
  owner: DbSong | null;
};

const MAX_CANDIDATES = 50;

/** 时长未知的排在最后（不用 Infinity：Infinity − Infinity 是 NaN，会打乱排序） */
const distance = (diff: number | null) =>
  diff == null ? Number.MAX_SAFE_INTEGER : Math.abs(diff);

/**
 * 关联曲目时的候选列表。
 * 无搜索词时只列出标题相近（去括号后互相包含）或时长吻合的曲目；
 * 有搜索词时在标题、专辑、路径里搜索。都按「标题相近优先、时长差从小到大」排序。
 */
export function rankCandidates(
  song: DbSong,
  library: NavSong[],
  owners: Map<string, DbSong>,
  query: string,
): TrackCandidate[] {
  const base = baseTitle(song.title);
  const q = normalize(query);
  const titleRelated = (n: NavSong) => {
    const navBase = baseTitle(n.title);
    return (
      base.length > 0 &&
      navBase.length > 0 &&
      (navBase.includes(base) || base.includes(navBase))
    );
  };
  const diffOf = (n: NavSong) =>
    n.duration != null && song.length != null ? n.duration - song.length : null;

  return library
    .filter((n) => {
      if (q) {
        return [n.title, n.album, n.path].some((t) => normalize(t).includes(q));
      }
      const diff = diffOf(n);
      return (
        titleRelated(n) ||
        (diff != null && Math.abs(diff) <= DURATION_TOLERANCE)
      );
    })
    .map((nav) => ({
      nav,
      durationDiff: diffOf(nav),
      owner: owners.get(nav.id) ?? null,
      related: titleRelated(nav),
    }))
    .sort(
      (a, b) =>
        Number(b.related) - Number(a.related) ||
        distance(a.durationDiff) - distance(b.durationDiff),
    )
    .slice(0, MAX_CANDIDATES)
    .map(({ nav, durationDiff, owner }) => ({ nav, durationDiff, owner }));
}

export function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null) return "--:--";
  const s = Math.round(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function formatDiff(diff: number | null): string | null {
  if (diff == null || diff === 0) return null;
  return `${diff > 0 ? "+" : ""}${diff}s`;
}
