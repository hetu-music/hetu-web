// Admin 管理页面 API 封装：一律走 lib/api/request 的 apiRequest，失败抛 ApiError
import { apiRequest } from "@/lib/api/request";
import type {
  CreateRequestPayload,
  ReplyRequestPayload,
  Song,
  UserRecord,
  UserRequest,
  UserUpdatePayload,
} from "@/lib/types";
import type { ReviewCandidate, ReviewResult } from "@/lib/imagery/review";
import type { OccurrenceBatchItem } from "@/lib/server/service-imagery";
import type { ImagerySuggestionsResult } from "@/lib/server/service-imagery-suggest";
import type { AudioOverview } from "@/lib/server/service-navidrome";
import type { ApplyResult } from "@/lib/navidrome/store";
import type { NavSong } from "@/lib/navidrome/sync";
import type { CreditAliasRow } from "@/lib/server/service-credit-aliases";
import type { CreditNameUsage } from "@/lib/utils/utils-credits";

/**
 * 没标返回类型的接口沿用原来 res.json() 的 any，调用方按各自的形状取用。
 * 新接口请写明返回类型。
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Untyped = any;

// ─── Songs Admin API ───────────────────────────────────────────────────────────

export function apiCreateSong(song: Partial<Song>, csrfToken: string) {
  return apiRequest<Untyped>("/api/admin/edit", {
    method: "POST",
    body: song,
    csrfToken,
    fallback: "新增失败",
  });
}

/** 409 是乐观锁冲突，服务端的提示（「数据已被他人修改…」）可以直接给用户看 */
export function apiUpdateSong(
  id: number,
  song: Partial<Song>,
  csrfToken: string,
) {
  return apiRequest<Untyped>("/api/admin/edit", {
    method: "PUT",
    body: { id, ...song },
    csrfToken,
    fallback: "更新失败",
    serverMessage: [409],
  });
}

export function apiCheckFileExists(
  songId: number,
  fileType: "cover" | "score",
  csrfToken: string,
) {
  return apiRequest<Untyped>(
    `/api/admin/check-file?songId=${songId}&type=${fileType}`,
    { csrfToken, fallback: "Failed to check file existence" },
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

export function apiGetImageryItems() {
  return apiRequest<Untyped>("/api/admin/imagery", {
    fallback: "获取意象列表失败",
  });
}

export function apiCreateImagery(name: string, csrfToken: string) {
  return apiRequest<Untyped>("/api/admin/imagery", {
    method: "POST",
    body: { name },
    csrfToken,
    fallback: "新增意象失败",
  });
}

export function apiUpdateImagery(id: number, name: string, csrfToken: string) {
  return apiRequest<Untyped>(`/api/admin/imagery/${id}`, {
    method: "PUT",
    body: { name },
    csrfToken,
    fallback: "更新意象失败",
  });
}

export function apiGetImageryOccurrences(imageryId: number) {
  return apiRequest<Untyped>(`/api/admin/imagery/${imageryId}`, {
    fallback: "获取出现记录失败",
  });
}

export function apiGetImageryCategories() {
  return apiRequest<Untyped>("/api/admin/imagery/categories", {
    fallback: "获取分类失败",
  });
}

export function apiCreateImageryCategory(
  data: {
    name: string;
    parent_id?: number | null;
    level?: number | null;
    description?: string | null;
  },
  csrfToken: string,
) {
  return apiRequest<Untyped>("/api/admin/imagery/categories", {
    method: "POST",
    body: data,
    csrfToken,
    fallback: "新增分类失败",
  });
}

export function apiUpdateImageryCategory(
  id: number,
  data: {
    name?: string;
    parent_id?: number | null;
    level?: number | null;
    description?: string | null;
  },
  csrfToken: string,
) {
  return apiRequest<Untyped>(`/api/admin/imagery/categories/${id}`, {
    method: "PUT",
    body: data,
    csrfToken,
    fallback: "更新分类失败",
  });
}

// ─── Imagery meanings API ──────────────────────────────────────────────────────

type MeaningInput = { label: string; description?: string | null };

export function apiGetMeanings() {
  return apiRequest<Untyped>("/api/admin/meanings", {
    fallback: "获取含义列表失败",
  });
}

export function apiCreateMeaning(
  imageryId: number,
  data: MeaningInput,
  csrfToken: string,
) {
  return apiRequest<Untyped>(`/api/admin/imagery/${imageryId}/meanings`, {
    method: "POST",
    body: data,
    csrfToken,
    fallback: "新增含义失败",
  });
}

export function apiUpdateMeaning(
  imageryId: number,
  meaningId: number,
  data: MeaningInput,
  csrfToken: string,
) {
  return apiRequest<Untyped>(
    `/api/admin/imagery/${imageryId}/meanings/${meaningId}`,
    { method: "PUT", body: data, csrfToken, fallback: "更新含义失败" },
  );
}

export function apiDeleteMeaning(
  imageryId: number,
  meaningId: number,
  csrfToken: string,
) {
  return apiRequest<Untyped>(
    `/api/admin/imagery/${imageryId}/meanings/${meaningId}`,
    { method: "DELETE", csrfToken, fallback: "删除含义失败" },
  );
}

export function apiCreateGlobalMeaning(data: MeaningInput, csrfToken: string) {
  return apiRequest<Untyped>("/api/admin/meanings", {
    method: "POST",
    body: data,
    csrfToken,
    fallback: "新增含义失败",
  });
}

export function apiUpdateGlobalMeaning(
  meaningId: number,
  data: MeaningInput,
  csrfToken: string,
) {
  return apiRequest<Untyped>(`/api/admin/meanings/${meaningId}`, {
    method: "PUT",
    body: data,
    csrfToken,
    fallback: "更新含义失败",
  });
}

export function apiDeleteGlobalMeaning(meaningId: number, csrfToken: string) {
  return apiRequest<Untyped>(`/api/admin/meanings/${meaningId}`, {
    method: "DELETE",
    csrfToken,
    fallback: "删除含义失败",
  });
}

// ─── Occurrences API ───────────────────────────────────────────────────────────

export function apiGetOccurrencesForImagery(imageryId: number) {
  return apiRequest<Untyped>(`/api/admin/occurrences?imagery_id=${imageryId}`, {
    fallback: "获取关系列表失败",
  });
}

export function apiGetOccurrencesForSong(songId: number) {
  return apiRequest<Untyped>(`/api/admin/occurrences?song_id=${songId}`, {
    fallback: "获取歌曲意象失败",
  });
}

export function apiCreateOccurrence(
  data: {
    song_id: number;
    imagery_id: number;
    category_id: number;
    meaning_id?: number | null;
    lyric_timetag: string[];
  },
  csrfToken: string,
) {
  return apiRequest<Untyped>("/api/admin/occurrences", {
    method: "POST",
    body: data,
    csrfToken,
    fallback: "新增关系失败",
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
  csrfToken: string,
) {
  return apiRequest<ReviewResult>("/api/admin/occurrences/review", {
    method: "POST",
    body: { song_id: songId, candidates },
    csrfToken,
    fallback: "AI 校验失败",
    serverMessage: [502, 503],
  });
}

/** 400 带着可读的原因（歌曲未发布、校验不过等） */
export function apiCreateOccurrencesBatch(
  songId: number,
  items: OccurrenceBatchItem[],
  csrfToken: string,
) {
  return apiRequest<{ created: number; skipped: number; newImagery: number }>(
    "/api/admin/occurrences/batch",
    {
      method: "POST",
      body: { song_id: songId, items },
      csrfToken,
      fallback: "保存意象标注失败",
      serverMessage: [400],
    },
  );
}

export function apiUpdateOccurrence(
  id: number,
  data: {
    imagery_id?: number;
    category_id?: number;
    meaning_id?: number | null;
    lyric_timetag?: string[];
  },
  csrfToken: string,
) {
  return apiRequest<Untyped>(`/api/admin/occurrences/${id}`, {
    method: "PUT",
    body: data,
    csrfToken,
    fallback: "更新关系失败",
  });
}

export function apiDeleteOccurrence(id: number, csrfToken: string) {
  return apiRequest<Untyped>(`/api/admin/occurrences/${id}`, {
    method: "DELETE",
    csrfToken,
    fallback: "删除关系失败",
  });
}

// ─── Credit Aliases API ────────────────────────────────────────────────────────

export function apiGetCreditAliases() {
  return apiRequest<{ aliases: CreditAliasRow[]; names: CreditNameUsage[] }>(
    "/api/admin/credit-aliases",
    { fallback: "获取署名别名失败", serverMessage: true },
  );
}

export function apiCreateCreditAlias(
  alias: string,
  name: string,
  csrfToken: string,
) {
  return apiRequest<CreditAliasRow>("/api/admin/credit-aliases", {
    method: "POST",
    body: { alias, name },
    csrfToken,
    fallback: "登记别名失败",
    serverMessage: true,
  });
}

export function apiDeleteCreditAlias(alias: string, csrfToken: string) {
  return apiRequest<Untyped>(
    `/api/admin/credit-aliases?alias=${encodeURIComponent(alias)}`,
    {
      method: "DELETE",
      csrfToken,
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

export function apiUpdateUser(payload: UserUpdatePayload, csrfToken: string) {
  return apiRequest<Untyped>("/api/admin/users", {
    method: "PUT",
    body: payload,
    csrfToken,
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

export function apiCreateRequest(
  payload: CreateRequestPayload,
  csrfToken: string,
) {
  return apiRequest<{ request: UserRequest }>("/api/public/requests", {
    method: "POST",
    body: payload,
    csrfToken,
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

export function apiReplyRequest(
  payload: ReplyRequestPayload,
  csrfToken: string,
) {
  return apiRequest<{ success: boolean }>("/api/admin/requests", {
    method: "PUT",
    body: payload,
    csrfToken,
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

export function apiRunAudioSync(csrfToken: string) {
  return apiRequest<ApplyResult>("/api/admin/audio/sync", {
    method: "POST",
    csrfToken,
    fallback: "同步失败",
    serverMessage: true,
  });
}

export function apiUpdateAudioMapping(
  songId: number,
  navidId: string | null,
  csrfToken: string,
) {
  return apiRequest<{ nav: NavSong | null }>("/api/admin/audio/mapping", {
    method: "PUT",
    body: { songId, navidId },
    csrfToken,
    fallback: "更新关联失败",
    serverMessage: true,
  });
}
