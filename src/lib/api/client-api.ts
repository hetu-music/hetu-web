// Admin 管理页面 API 封装
import type { Song, UserRecord, UserUpdatePayload } from "@/lib/types";
import type { ImagerySuggestionsResult } from "@/lib/server/service-imagery-suggest";

// 新增歌曲
export async function apiCreateSong(song: Partial<Song>, csrfToken: string) {
  const res = await fetch("/api/admin/edit", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-csrf-token": csrfToken,
    },
    body: JSON.stringify(song),
  });
  if (!res.ok) throw new Error("新增失败");
  return res.json();
}

// 更新歌曲
export async function apiUpdateSong(
  id: number,
  song: Partial<Song>,
  csrfToken: string,
) {
  const res = await fetch("/api/admin/edit", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "x-csrf-token": csrfToken,
    },
    body: JSON.stringify({ id, ...song }),
  });
  if (res.status === 409) {
    throw new Error("数据已被他人修改，请刷新页面后重试");
  }
  if (!res.ok) throw new Error("更新失败");
  return res.json();
}

// 修改密码
export async function apiChangePassword(
  oldPassword: string,
  newPassword: string,
  csrfToken: string,
) {
  const res = await fetch("/api/auth/change-password", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-csrf-token": csrfToken,
    },
    body: JSON.stringify({ oldPassword, newPassword }),
  });
  return res.json();
}

// 获取账号信息（含 displayName, display, intro）
export async function apiGetAccountInfo() {
  const res = await fetch("/api/auth/account");
  return res.json();
}

// 更新账号信息（displayName, display, intro）
export async function apiUpdateAccountInfo(
  displayName: string,
  csrfToken: string,
  display?: boolean,
  intro?: string | null,
) {
  const body: {
    displayName: string;
    display?: boolean;
    intro?: string | null;
  } = { displayName };
  if (typeof display === "boolean") body.display = display;
  if (typeof intro === "string" || intro === null) body.intro = intro;
  const res = await fetch("/api/auth/account", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-csrf-token": csrfToken,
    },
    body: JSON.stringify(body),
  });
  return res.json();
}

// 检查文件是否存在
export async function apiCheckFileExists(
  songId: number,
  fileType: "cover" | "score",
  csrfToken: string,
) {
  const res = await fetch(
    `/api/admin/check-file?songId=${songId}&type=${fileType}`,
    {
      method: "GET",
      headers: {
        "x-csrf-token": csrfToken,
      },
    },
  );
  if (!res.ok) throw new Error("Failed to check file existence");
  return res.json();
}

// Auto-complete logic has been moved to src/lib/api-auto-complete.ts

// ─── Songs Admin API ───────────────────────────────────────────────────────────

export async function apiGetSongs(): Promise<
  { id: number; title: string; album?: string | null }[]
> {
  const res = await fetch("/api/admin/edit");
  if (!res.ok) throw new Error("获取歌曲列表失败");
  return res.json();
}

// ─── Imagery Admin API ─────────────────────────────────────────────────────────

export async function apiGetImageryItems() {
  const res = await fetch("/api/admin/imagery");
  if (!res.ok) throw new Error("获取意象列表失败");
  return res.json();
}

export async function apiCreateImagery(name: string, csrfToken: string) {
  const res = await fetch("/api/admin/imagery", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-csrf-token": csrfToken },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) throw new Error("新增意象失败");
  return res.json();
}

export async function apiUpdateImagery(
  id: number,
  name: string,
  csrfToken: string,
) {
  const res = await fetch(`/api/admin/imagery/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", "x-csrf-token": csrfToken },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) throw new Error("更新意象失败");
  return res.json();
}

export async function apiGetImageryOccurrences(imageryId: number) {
  const res = await fetch(`/api/admin/imagery/${imageryId}`);
  if (!res.ok) throw new Error("获取出现记录失败");
  return res.json();
}

export async function apiGetImageryCategories() {
  const res = await fetch("/api/admin/imagery/categories");
  if (!res.ok) throw new Error("获取分类失败");
  return res.json();
}

export async function apiCreateImageryCategory(
  data: {
    name: string;
    parent_id?: number | null;
    level?: number | null;
    description?: string | null;
  },
  csrfToken: string,
) {
  const res = await fetch("/api/admin/imagery/categories", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-csrf-token": csrfToken },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("新增分类失败");
  return res.json();
}

export async function apiUpdateImageryCategory(
  id: number,
  data: {
    name?: string;
    parent_id?: number | null;
    level?: number | null;
    description?: string | null;
  },
  csrfToken: string,
) {
  const res = await fetch(`/api/admin/imagery/categories/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", "x-csrf-token": csrfToken },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("更新分类失败");
  return res.json();
}

// ─── Imagery meanings API ──────────────────────────────────────────────────────

export async function apiGetMeanings() {
  const res = await fetch("/api/admin/meanings");
  if (!res.ok) throw new Error("获取含义列表失败");
  return res.json();
}

export async function apiCreateMeaning(
  imageryId: number,
  data: { label: string; description?: string | null },
  csrfToken: string,
) {
  const res = await fetch(`/api/admin/imagery/${imageryId}/meanings`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-csrf-token": csrfToken },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("新增含义失败");
  return res.json();
}

export async function apiUpdateMeaning(
  imageryId: number,
  meaningId: number,
  data: { label: string; description?: string | null },
  csrfToken: string,
) {
  const res = await fetch(
    `/api/admin/imagery/${imageryId}/meanings/${meaningId}`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "x-csrf-token": csrfToken,
      },
      body: JSON.stringify(data),
    },
  );
  if (!res.ok) throw new Error("更新含义失败");
  return res.json();
}

export async function apiDeleteMeaning(
  imageryId: number,
  meaningId: number,
  csrfToken: string,
) {
  const res = await fetch(
    `/api/admin/imagery/${imageryId}/meanings/${meaningId}`,
    {
      method: "DELETE",
      headers: { "x-csrf-token": csrfToken },
    },
  );
  if (!res.ok) throw new Error("删除含义失败");
  return res.json();
}

export async function apiCreateGlobalMeaning(
  data: { label: string; description?: string | null },
  csrfToken: string,
) {
  const res = await fetch("/api/admin/meanings", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-csrf-token": csrfToken },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("新增含义失败");
  return res.json();
}

export async function apiUpdateGlobalMeaning(
  meaningId: number,
  data: { label: string; description?: string | null },
  csrfToken: string,
) {
  const res = await fetch(`/api/admin/meanings/${meaningId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", "x-csrf-token": csrfToken },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("更新含义失败");
  return res.json();
}

export async function apiDeleteGlobalMeaning(
  meaningId: number,
  csrfToken: string,
) {
  const res = await fetch(`/api/admin/meanings/${meaningId}`, {
    method: "DELETE",
    headers: { "x-csrf-token": csrfToken },
  });
  if (!res.ok) throw new Error("删除含义失败");
  return res.json();
}

// ─── Occurrences API ───────────────────────────────────────────────────────────

export async function apiGetOccurrencesForImagery(imageryId: number) {
  const res = await fetch(`/api/admin/occurrences?imagery_id=${imageryId}`);
  if (!res.ok) throw new Error("获取关系列表失败");
  return res.json();
}

export async function apiGetOccurrencesForSong(songId: number) {
  const res = await fetch(`/api/admin/occurrences?song_id=${songId}`);
  if (!res.ok) throw new Error("获取歌曲意象失败");
  return res.json();
}

export async function apiCreateOccurrence(
  data: {
    song_id: number;
    imagery_id: number;
    category_id: number;
    meaning_id?: number | null;
    lyric_timetag: string[];
  },
  csrfToken: string,
) {
  const res = await fetch("/api/admin/occurrences", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-csrf-token": csrfToken },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("新增关系失败");
  return res.json();
}

export async function apiGetImagerySuggestions(
  songId: number,
): Promise<ImagerySuggestionsResult> {
  const res = await fetch(
    `/api/admin/occurrences/suggestions?song_id=${songId}`,
  );
  if (!res.ok) throw new Error("生成意象候选失败");
  return res.json();
}

export async function apiCreateOccurrencesBatch(
  songId: number,
  items: Array<{
    imagery_id: number;
    category_id: number;
    lyric_timetag: string[];
  }>,
  csrfToken: string,
): Promise<{ created: number; skipped: number }> {
  const res = await fetch("/api/admin/occurrences/batch", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-csrf-token": csrfToken },
    body: JSON.stringify({ song_id: songId, items }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(
      res.status === 400 && typeof body?.error === "string" && !body.details
        ? body.error
        : "保存意象标注失败",
    );
  }
  return res.json();
}

export async function apiUpdateOccurrence(
  id: number,
  data: {
    imagery_id?: number;
    category_id?: number;
    meaning_id?: number | null;
    lyric_timetag?: string[];
  },
  csrfToken: string,
) {
  const res = await fetch(`/api/admin/occurrences/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", "x-csrf-token": csrfToken },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("更新关系失败");
  return res.json();
}

export async function apiDeleteOccurrence(id: number, csrfToken: string) {
  const res = await fetch(`/api/admin/occurrences/${id}`, {
    method: "DELETE",
    headers: { "x-csrf-token": csrfToken },
  });
  if (!res.ok) throw new Error("删除关系失败");
  return res.json();
}

// ─── Super Admin Users API ─────────────────────────────────────────────────────

export async function apiGetUsers(): Promise<{ users: UserRecord[] }> {
  const res = await fetch("/api/admin/users");
  if (!res.ok) throw new Error("获取用户列表失败");
  return res.json();
}

export async function apiUpdateUser(
  payload: UserUpdatePayload,
  csrfToken: string,
) {
  const res = await fetch("/api/admin/users", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "x-csrf-token": csrfToken,
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const d = await res.json().catch(() => ({}));
    throw new Error((d as { error?: string }).error || "更新用户失败");
  }
  return res.json();
}

// ─── User Requests API ─────────────────────────────────────────────────────────

export async function apiGetMyRequests(): Promise<{
  requests: import("../types").UserRequest[];
}> {
  const res = await fetch("/api/public/requests");
  if (!res.ok) throw new Error("获取请求列表失败");
  return res.json();
}

export async function apiCreateRequest(
  payload: import("../types").CreateRequestPayload,
  csrfToken: string,
): Promise<{ request: import("../types").UserRequest }> {
  const res = await fetch("/api/public/requests", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-csrf-token": csrfToken,
    },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "提交失败");
  return data;
}

export async function apiGetAdminRequests(params?: {
  type?: string;
  status?: string;
  page?: number;
}): Promise<{
  requests: import("../types").UserRequest[];
  total: number;
  page: number;
  pageSize: number;
}> {
  const sp = new URLSearchParams();
  if (params?.type) sp.set("type", params.type);
  if (params?.status) sp.set("status", params.status);
  if (params?.page) sp.set("page", String(params.page));
  const res = await fetch(`/api/admin/requests?${sp.toString()}`);
  if (!res.ok) throw new Error("获取请求列表失败");
  return res.json();
}

export async function apiReplyRequest(
  payload: import("../types").ReplyRequestPayload,
  csrfToken: string,
): Promise<{ success: boolean }> {
  const res = await fetch("/api/admin/requests", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "x-csrf-token": csrfToken,
    },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "操作失败");
  return data;
}
