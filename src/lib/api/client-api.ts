// Admin 管理页面 API 封装：一律走 lib/api/request 的 apiRequest，失败抛 ApiError
import { apiRequest } from "@/lib/api/request";
import type {
  CreateRequestPayload,
  Emotion,
  ImageryCategory,
  ImageryItem,
  ReplyRequestPayload,
  Song,
  SongCollation,
  UserRecord,
  UserRequest,
  UserUpdatePayload,
} from "@/lib/types";
import type { ReviewCandidate, ReviewResult } from "@/lib/imagery/review";
import type {
  OccurrenceBatchItem,
  OccurrenceWithSong,
  UnusedMotif,
} from "@/lib/server/service-imagery";
import type { ImagerySuggestionsResult } from "@/lib/server/service-imagery-suggest";
import type { AudioOverview } from "@/lib/server/service-navidrome";
import type { ApplyResult } from "@/lib/navidrome/store";
import type { NavSong } from "@/lib/navidrome/sync";
import type { CreditAliasRow } from "@/lib/server/service-credit-aliases";
import type { CreditNameUsage } from "@/lib/utils/utils-credits";
import type {
  CollationPayload,
  SupplementPayload,
} from "@/lib/utils/utils-collations";

/**
 * 没标返回类型的接口沿用原来 res.json() 的 any，调用方按各自的形状取用。
 * 新接口请写明返回类型。
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Untyped = any;

// ─── Songs Admin API ───────────────────────────────────────────────────────────

export function apiCreateSong(song: Partial<Song>) {
  return apiRequest<Untyped>("/api/admin/edit", {
    method: "POST",
    body: song,
    fallback: "新增失败",
  });
}

/** 409 是乐观锁冲突，服务端的提示（「数据已被他人修改…」）可以直接给用户看 */
export function apiUpdateSong(id: number, song: Partial<Song>) {
  return apiRequest<Untyped>("/api/admin/edit", {
    method: "PUT",
    body: { id, ...song },
    fallback: "更新失败",
    serverMessage: [409],
  });
}

export function apiCheckFileExists(
  songId: number,
  fileType: "cover" | "score",
) {
  return apiRequest<Untyped>(
    `/api/admin/check-file?songId=${songId}&type=${fileType}`,
    { csrf: true, fallback: "Failed to check file existence" },
  );
}

export function apiGetSongs() {
  return apiRequest<
    {
      id: number;
      title: string;
      album?: string | null;
      lyrics?: string | null;
    }[]
  >("/api/admin/edit", { fallback: "获取歌曲列表失败" });
}

// ─── Imagery Admin API ─────────────────────────────────────────────────────────
// 词不单独新建或改名：标注时按歌词原文创建（apiCreateOccurrencesBatch）。

export function apiGetImageryItems() {
  return apiRequest<ImageryItem[]>("/api/admin/imagery", {
    fallback: "获取意象词典失败",
  });
}

/** 整体改写一个词登记的母题；400 带着可读的原因（去掉的母题下还有标注等） */
export function apiSetWordMotifs(
  imageryId: number,
  motifs: { primary: number; alternatives: number[]; parts: number[] },
) {
  return apiRequest<typeof motifs>(`/api/admin/imagery/${imageryId}/motifs`, {
    method: "PUT",
    body: motifs,
    fallback: "保存词的母题失败",
    serverMessage: [400],
  });
}

export function apiGetImageryCategories() {
  return apiRequest<ImageryCategory[]>("/api/admin/imagery/categories", {
    fallback: "获取母题失败",
  });
}

/** 只能新建母题：挂在类别（第二级）下，说明必填 */
export function apiCreateMotif(data: {
  name: string;
  parent_id: number;
  description: string;
}) {
  return apiRequest<ImageryCategory>("/api/admin/imagery/categories", {
    method: "POST",
    body: data,
    fallback: "新增母题失败",
    serverMessage: [400],
  });
}

export function apiUpdateMotif(
  id: number,
  data: { name?: string; parent_id?: number; description?: string },
) {
  return apiRequest<ImageryCategory>(`/api/admin/imagery/categories/${id}`, {
    method: "PUT",
    body: data,
    fallback: "更新母题失败",
    serverMessage: [400],
  });
}

/** 整理：没有标注的母题，连同登记了它的词 */
export function apiGetUnusedMotifs() {
  return apiRequest<UnusedMotif[]>("/api/admin/imagery/categories/unused", {
    fallback: "查找空母题失败",
  });
}

/** 只删服务端重查后仍然没用上的，返回实际删掉的 id 与换了默认母题的词 */
export function apiDeleteUnusedMotifs(ids: number[]) {
  return apiRequest<{
    deleted: number[];
    promoted: Array<{ word: string; motif: string }>;
  }>("/api/admin/imagery/categories/unused", {
    method: "DELETE",
    body: { ids },
    fallback: "删除空母题失败",
  });
}

// ─── Occurrences API（标注） ───────────────────────────────────────────────────

/** 一个词的全部标注：哪些歌、挂哪个母题 */
export function apiGetOccurrencesForImagery(imageryId: number) {
  return apiRequest<OccurrenceWithSong[]>(
    `/api/admin/occurrences?imagery_id=${imageryId}`,
    { fallback: "获取标注失败" },
  );
}

export function apiGetOccurrencesForSong(songId: number) {
  return apiRequest<Untyped>(`/api/admin/occurrences?song_id=${songId}`, {
    fallback: "获取歌曲意象失败",
  });
}

export function apiGetImagerySuggestions(songId: number) {
  return apiRequest<ImagerySuggestionsResult>(
    `/api/admin/occurrences/suggestions?song_id=${songId}`,
    { fallback: "生成意象候选失败" },
  );
}

/** 502/503 是 LLM 侧的问题，服务端给的信息可以直接展示 */
export function apiReviewImagery(
  songId: number,
  candidates: ReviewCandidate[],
) {
  return apiRequest<ReviewResult>("/api/admin/occurrences/review", {
    method: "POST",
    body: { song_id: songId, candidates },
    fallback: "AI 校验失败",
    serverMessage: [502, 503],
  });
}

/**
 * 新增标注：手动添加一条或审核后多条，词典里没有的词随之创建。
 * 400 带着可读的原因（歌曲未发布、词不在歌词里等）
 */
export function apiCreateOccurrencesBatch(
  songId: number,
  items: OccurrenceBatchItem[],
) {
  return apiRequest<{ created: number; skipped: number; newImagery: number }>(
    "/api/admin/occurrences/batch",
    {
      method: "POST",
      body: { song_id: songId, items },
      fallback: "保存意象标注失败",
      serverMessage: [400],
    },
  );
}

/** 词给 imagery_id 或 imagery_name（词典里没有时创建）；时间标签由服务端重算 */
export function apiUpdateOccurrence(
  id: number,
  data: {
    imagery_id?: number;
    imagery_name?: string;
    category_id?: number;
  },
) {
  return apiRequest<Untyped>(`/api/admin/occurrences/${id}`, {
    method: "PUT",
    body: data,
    fallback: "更新标注失败",
    serverMessage: [400],
  });
}

export function apiDeleteOccurrence(id: number) {
  return apiRequest<Untyped>(`/api/admin/occurrences/${id}`, {
    method: "DELETE",
    fallback: "删除标注失败",
  });
}

// ─── Song Emotions API ─────────────────────────────────────────────────────────

export function apiGetSongEmotions(songId: number) {
  return apiRequest<{
    emotions: Emotion[];
    selected: number[];
    /** ai：批量预标、尚未确认；human：人工标注或确认过；null：还没标 */
    source: "human" | "ai" | null;
    llmEnabled: boolean;
  }>(`/api/admin/song-emotions?song_id=${songId}`, {
    fallback: "获取基调失败",
  });
}

/** 每次调用都产生模型费用；502/503 是 LLM 侧的问题，服务端给的信息可以直接展示 */
export function apiSuggestSongEmotions(songId: number) {
  return apiRequest<{ emotionIds: number[]; reason: string }>(
    "/api/admin/song-emotions/suggest",
    {
      method: "POST",
      body: { song_id: songId },
      fallback: "AI 建议失败",
      serverMessage: [404, 502, 503],
    },
  );
}

/** emotionIds 按主、副顺序；400 带着可读的原因（歌曲未发布等） */
export function apiSetSongEmotions(songId: number, emotionIds: number[]) {
  return apiRequest<{ selected: number[] }>("/api/admin/song-emotions", {
    method: "PUT",
    body: { song_id: songId, emotion_ids: emotionIds },
    fallback: "保存基调失败",
    serverMessage: [400],
  });
}

// ─── Collations API ────────────────────────────────────────────────────────────

export function apiGetCollations(songId: number) {
  return apiRequest<{ collations: SongCollation[] }>(
    `/api/admin/collations?song_id=${songId}`,
    { fallback: "获取校记失败" },
  );
}

/** 400 带着可读的原因（歌曲未发布、字段校验），404 是校记已被别人删掉 */
export function apiCreateCollation(
  songId: number,
  collation: CollationPayload,
) {
  return apiRequest<{ id: number }>("/api/admin/collations", {
    method: "POST",
    body: { song_id: songId, entry: collation },
    fallback: "保存校记失败",
    serverMessage: [400],
  });
}

export function apiUpdateCollation(id: number, collation: CollationPayload) {
  return apiRequest<{ success: true }>("/api/admin/collations", {
    method: "PUT",
    body: { id, entry: collation },
    fallback: "保存校记失败",
    serverMessage: [400, 404],
  });
}

export function apiCreateSupplement(
  songId: number,
  supplement: SupplementPayload,
) {
  return apiRequest<{ id: number }>("/api/admin/supplements", {
    method: "POST",
    body: { song_id: songId, entry: supplement },
    fallback: "保存补遗失败",
    serverMessage: [400],
  });
}

export function apiUpdateSupplement(id: number, supplement: SupplementPayload) {
  return apiRequest<{ success: true }>("/api/admin/supplements", {
    method: "PUT",
    body: { id, entry: supplement },
    fallback: "保存补遗失败",
    serverMessage: [400, 404],
  });
}

/** 校记与补遗同表，删除共用 */
export function apiDeleteCollation(id: number) {
  return apiRequest<{ success: true }>("/api/admin/collations", {
    method: "DELETE",
    body: { id },
    fallback: "删除校记失败",
    serverMessage: [404],
  });
}

// ─── Credit Aliases API ────────────────────────────────────────────────────────

export function apiGetCreditAliases() {
  return apiRequest<{ aliases: CreditAliasRow[]; names: CreditNameUsage[] }>(
    "/api/admin/credit-aliases",
    { fallback: "获取署名别名失败", serverMessage: true },
  );
}

export function apiCreateCreditAlias(alias: string, name: string) {
  return apiRequest<CreditAliasRow>("/api/admin/credit-aliases", {
    method: "POST",
    body: { alias, name },
    fallback: "登记别名失败",
    serverMessage: true,
  });
}

export function apiDeleteCreditAlias(alias: string) {
  return apiRequest<Untyped>(
    `/api/admin/credit-aliases?alias=${encodeURIComponent(alias)}`,
    {
      method: "DELETE",
      fallback: "删除别名失败",
      serverMessage: true,
    },
  );
}

// ─── Super Admin Users API ─────────────────────────────────────────────────────

export function apiGetUsers() {
  return apiRequest<{ users: UserRecord[] }>("/api/admin/users", {
    fallback: "获取用户列表失败",
  });
}

export function apiUpdateUser(payload: UserUpdatePayload) {
  return apiRequest<Untyped>("/api/admin/users", {
    method: "PUT",
    body: payload,
    fallback: "更新用户失败",
    serverMessage: true,
  });
}

// ─── User Requests API ─────────────────────────────────────────────────────────

export function apiGetMyRequests() {
  return apiRequest<{ requests: UserRequest[] }>("/api/public/requests", {
    fallback: "获取请求列表失败",
  });
}

export function apiCreateRequest(payload: CreateRequestPayload) {
  return apiRequest<{ request: UserRequest }>("/api/public/requests", {
    method: "POST",
    body: payload,
    fallback: "提交失败",
    serverMessage: true,
  });
}

export function apiGetAdminRequests(params?: {
  type?: string;
  status?: string;
  page?: number;
}) {
  const sp = new URLSearchParams();
  if (params?.type) sp.set("type", params.type);
  if (params?.status) sp.set("status", params.status);
  if (params?.page) sp.set("page", String(params.page));
  return apiRequest<{
    requests: UserRequest[];
    total: number;
    page: number;
    pageSize: number;
  }>(`/api/admin/requests?${sp.toString()}`, {
    fallback: "获取请求列表失败",
  });
}

export function apiReplyRequest(payload: ReplyRequestPayload) {
  return apiRequest<{ success: boolean }>("/api/admin/requests", {
    method: "PUT",
    body: payload,
    fallback: "操作失败",
    serverMessage: true,
  });
}

// ─── Audio (Navidrome) API ────────────────────────────────────────────────────

export function apiGetAudioOverview() {
  return apiRequest<AudioOverview>("/api/admin/audio", {
    cache: "no-store",
    fallback: "获取音频数据失败",
    serverMessage: true,
  });
}

export function apiRunAudioSync() {
  return apiRequest<ApplyResult>("/api/admin/audio/sync", {
    method: "POST",
    fallback: "同步失败",
    serverMessage: true,
  });
}

export function apiUpdateAudioMapping(songId: number, navidId: string | null) {
  return apiRequest<{ nav: NavSong | null }>("/api/admin/audio/mapping", {
    method: "PUT",
    body: { songId, navidId },
    fallback: "更新关联失败",
    serverMessage: true,
  });
}
