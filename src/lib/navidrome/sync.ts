/**
 * Navidrome 映射同步：把 music 表里的歌曲与 Navidrome 曲库按元数据自动配对，
 * 生成 navid_song / has_audio 的变更计划。纯函数，不做任何 I/O，
 * 由 scripts/navidrome-sync.ts 负责拉取数据和落库。
 *
 * Navidrome 的曲目 ID 会随版本升级（ID 算法变化）或文件改名而整体改变，
 * 所以映射不能手工维护，只能以歌曲元数据为准定期重建。
 */

export type DbSong = {
  id: number;
  title: string;
  album: string | null;
  discnumber: number | null;
  track: number | null;
  length: number | null;
  has_audio: boolean | null;
};

export type NavSong = {
  id: string;
  title: string;
  album?: string;
  discNumber?: number;
  track?: number;
  duration?: number;
  path?: string;
};

export type MappingRow = { id: number; navid_id: string };

export type ReviewItem = {
  song: DbSong;
  reason: string;
  candidates: NavSong[];
};

export type SyncPlan = {
  /** 新增或替换失效 ID 的映射；loose 表示靠去括号标题+时长配上的宽松匹配 */
  upserts: {
    song: DbSong;
    nav: NavSong;
    previous: string | null;
    loose: boolean;
  }[];
  /** 指向已不存在曲目、且没有找到替代的映射 */
  deletes: MappingRow[];
  /** 现有映射仍然有效，保持不动 */
  unchanged: number;
  /** 保留下来但时长对不上的映射（不改动，只提示） */
  suspicious: { song: DbSong; nav: NavSong }[];
  /** 需要人工确认的歌曲（不会自动写入） */
  review: ReviewItem[];
  /** Navidrome 中找不到任何候选的歌曲 */
  missing: DbSong[];
  /** 执行计划后 has_audio 需要改变的歌曲 */
  hasAudioChanges: { song: DbSong; next: boolean }[];
  /** 没有被任何歌曲使用的 Navidrome 曲目 */
  unusedNav: NavSong[];
};

/** 时长容差（秒）：转码、编码器 padding 会造成一两秒的出入 */
export const DURATION_TOLERANCE = 3;

/** 统一全半角与大小写，去掉空白和标点，只保留字母、数字与汉字 */
export function normalize(text: string | null | undefined): string {
  if (!text) return "";
  return text
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, "");
}

/** 去掉括号里的版本说明（剧情版、纯歌版、Live……）后再归一化 */
export function baseTitle(text: string | null | undefined): string {
  if (!text) return "";
  return normalize(text.replace(/[（(【[][^）)】\]]*[）)】\]]/g, ""));
}

/** 宽松匹配要求的最短基础标题长度，避免单字标题到处命中 */
const MIN_LOOSE_TITLE = 2;

function pushTo<K, V>(map: Map<K, V[]>, key: K, value: V) {
  const list = map.get(key);
  if (list) list.push(value);
  else map.set(key, [value]);
}

const positionKey = (
  album: string,
  disc: number | null | undefined,
  track: number | null | undefined,
) => `${album}|${disc ?? 1}|${track ?? ""}`;

function durationMismatch(song: DbSong, nav: NavSong): boolean {
  if (song.length == null || nav.duration == null) return false;
  return Math.abs(song.length - nav.duration) > DURATION_TOLERANCE;
}

type Candidate =
  | { kind: "match"; nav: NavSong; loose: boolean }
  | { kind: "review"; reason: string; candidates: NavSong[] }
  | { kind: "missing" };

function findCandidate(
  song: DbSong,
  navSongs: NavSong[],
  byTitle: Map<string, NavSong[]>,
  byPosition: Map<string, NavSong[]>,
): Candidate {
  const title = normalize(song.title);
  const album = normalize(song.album);
  const sameTitle = byTitle.get(title) ?? [];
  let sameAlbum = sameTitle.filter((n) => normalize(n.album) === album);

  // 同专辑同名多条（比如 disc 2 收了另一个版本）：用碟号和曲序区分
  if (sameAlbum.length > 1) {
    sameAlbum = sameAlbum.filter(
      (n) =>
        (n.discNumber ?? 1) === (song.discnumber ?? 1) &&
        n.track === song.track,
    );
    if (sameAlbum.length !== 1) {
      return {
        kind: "review",
        reason: "同专辑内有多首同名曲目",
        candidates: sameTitle.filter((n) => normalize(n.album) === album),
      };
    }
  }

  if (sameAlbum.length === 1) {
    const nav = sameAlbum[0];
    if (durationMismatch(song, nav)) {
      return { kind: "review", reason: "时长不符", candidates: [nav] };
    }
    return { kind: "match", nav, loose: false };
  }

  // 曲库把单曲归进「河图单曲2009-2012」这类合集，专辑名对不上是常态。
  // 同名且时长吻合的只有一首时可以放心配对；无法校验时长则交给人确认
  if (song.length != null) {
    const sameDuration = sameTitle.filter(
      (n) => n.duration != null && !durationMismatch(song, n),
    );
    if (sameDuration.length === 1) {
      return { kind: "match", nav: sameDuration[0], loose: false };
    }

    // 标签里的标题常和数据库差一个版本后缀：数据库的「卫玠辞」对应曲库的
    // 「卫玠辞（剧情版）」，「卫玠辞（纯歌版）」反而对应曲库的「卫玠辞」。
    // 这时标题反而会误导，以时长为准：去括号后互相包含、且时长唯一吻合才配对
    const base = baseTitle(song.title);
    if (base.length >= MIN_LOOSE_TITLE) {
      const loose = navSongs.filter((n) => {
        const navBase = baseTitle(n.title);
        return (
          navBase.length >= MIN_LOOSE_TITLE &&
          (navBase.includes(base) || base.includes(navBase)) &&
          n.duration != null &&
          !durationMismatch(song, n)
        );
      });
      if (loose.length === 1) {
        return { kind: "match", nav: loose[0], loose: true };
      }
    }
  }
  // 标题对不上：同专辑同曲序的曲目多半是标签里标题写法不同，交给人确认
  const samePosition =
    byPosition.get(positionKey(album, song.discnumber, song.track)) ?? [];
  if (samePosition.length > 0) {
    return {
      kind: "review",
      reason: "同专辑同曲序，但标题不同",
      candidates: samePosition,
    };
  }
  if (sameTitle.length > 0) {
    return {
      kind: "review",
      reason: "同名曲目在其他专辑",
      candidates: sameTitle,
    };
  }
  return { kind: "missing" };
}

export function planSync(
  songs: DbSong[],
  navSongs: NavSong[],
  existing: MappingRow[],
): SyncPlan {
  const navById = new Map(navSongs.map((n) => [n.id, n]));
  const byTitle = new Map<string, NavSong[]>();
  const byPosition = new Map<string, NavSong[]>();
  for (const n of navSongs) {
    pushTo(byTitle, normalize(n.title), n);
    pushTo(
      byPosition,
      positionKey(normalize(n.album), n.discNumber, n.track),
      n,
    );
  }
  const existingById = new Map(existing.map((r) => [r.id, r.navid_id]));

  const review: ReviewItem[] = [];
  const missing: DbSong[] = [];
  type Match = { song: DbSong; nav: NavSong; loose: boolean };
  const matches: Match[] = [];
  const kept = new Map<number, string>(); // 仍然有效、保持不动的映射

  for (const song of songs) {
    const current = existingById.get(song.id);
    // 现有映射仍有效时一律保留：人工修正过的映射不会被下次同步冲掉
    if (current && navById.has(current)) {
      kept.set(song.id, current);
      continue;
    }
    const result = findCandidate(song, navSongs, byTitle, byPosition);
    if (result.kind === "match")
      matches.push({ song, nav: result.nav, loose: result.loose });
    else if (result.kind === "review")
      review.push({
        song,
        reason: result.reason,
        candidates: result.candidates,
      });
    else missing.push(song);
  }

  // 一个文件只能对应一首歌。被已保留的映射占用、或被多首歌抢到时转人工；
  // 唯一的精确匹配优先于宽松匹配，输掉的宽松匹配单独转人工
  const claimed = new Set(kept.values());
  const byNav = new Map<string, Match[]>();
  for (const m of matches) pushTo(byNav, m.nav.id, m);
  const upserts: SyncPlan["upserts"] = [];
  const toReview = (m: Match, reason: string) =>
    review.push({ song: m.song, reason, candidates: [m.nav] });
  for (const [navId, group] of byNav) {
    if (claimed.has(navId)) {
      for (const m of group) toReview(m, "候选曲目已被其他歌曲的映射占用");
      continue;
    }
    const exact = group.filter((m) => !m.loose);
    const winner =
      exact.length === 1 ? exact[0] : group.length === 1 ? group[0] : null;
    for (const m of group) {
      if (m === winner) {
        upserts.push({ ...m, previous: existingById.get(m.song.id) ?? null });
      } else {
        toReview(
          m,
          winner ? "候选曲目已被精确匹配占用" : "多首歌匹配到同一曲目",
        );
      }
    }
  }

  const upserted = new Set(upserts.map((u) => u.song.id));
  const deletes = existing.filter(
    (r) => !navById.has(r.navid_id) && !upserted.has(r.id),
  );

  const finalMapped = new Set([...kept.keys(), ...upserted]);
  const hasAudioChanges = songs
    .filter((s) => (s.has_audio ?? false) !== finalMapped.has(s.id))
    .map((song) => ({ song, next: finalMapped.has(song.id) }));

  const songById = new Map(songs.map((s) => [s.id, s]));
  const suspicious: SyncPlan["suspicious"] = [];
  for (const [songId, navId] of kept) {
    const song = songById.get(songId);
    const nav = navById.get(navId);
    if (song && nav && durationMismatch(song, nav))
      suspicious.push({ song, nav });
  }

  const used = new Set([...kept.values(), ...upserts.map((u) => u.nav.id)]);
  const unusedNav = navSongs.filter((n) => !used.has(n.id));

  return {
    upserts,
    deletes,
    unchanged: kept.size,
    suspicious,
    review,
    missing,
    hasAudioChanges,
    unusedNav,
  };
}
