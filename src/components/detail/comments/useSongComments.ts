"use client";

import { useUserContext } from "@/context/UserContext";
import { getCsrfToken } from "@/lib/api/csrf";
import type { SongComment } from "@/lib/types";
import type { NewCommentAnchor } from "@/lib/utils/utils-comments";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale } from "next-intl";
import { useCallback, useMemo } from "react";

export type NewComment =
  | (NewCommentAnchor & { body: string; private: boolean })
  | { parentId: number; body: string };

async function send(method: string, url: string, body?: unknown) {
  const csrf = await getCsrfToken();
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json", "x-csrf-token": csrf },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new Error(data?.error || `HTTP ${res.status}`);
  }
  return res.json();
}

/**
 * 某首歌的批注与增删改赞。
 * 列表随登录身份而变（私批、赞过与否），查询键带上用户 id；
 * 被批原文随页面简繁而转，查询键也带上语言。
 */
export function useSongComments(songId: number) {
  const { user, loaded } = useUserContext();
  const locale = useLocale();
  const queryClient = useQueryClient();
  const queryKey = useMemo(
    () => ["song-comments", songId, user?.id ?? null, locale] as const,
    [songId, user?.id, locale],
  );

  const query = useQuery({
    queryKey,
    enabled: loaded,
    staleTime: 30_000,
    queryFn: async (): Promise<SongComment[]> => {
      const res = await fetch(
        `/api/public/songs/${songId}/comments?locale=${encodeURIComponent(locale)}`,
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: { comments: SongComment[] } = await res.json();
      return data.comments;
    },
  });

  const refresh = useCallback(
    () => queryClient.invalidateQueries({ queryKey }),
    [queryClient, queryKey],
  );

  const create = useMutation({
    mutationFn: (input: NewComment) =>
      send("POST", "/api/public/comments", { songId, ...input }),
    onSuccess: refresh,
  });

  const edit = useMutation({
    mutationFn: ({ id, body }: { id: number; body: string }) =>
      send("PATCH", `/api/public/comments/${id}`, { body }),
    onSuccess: refresh,
  });

  const remove = useMutation({
    mutationFn: (id: number) => send("DELETE", `/api/public/comments/${id}`),
    onSuccess: refresh,
  });

  // 赞：先改本地，失败再回滚
  const like = useMutation({
    mutationFn: ({ id, liked }: { id: number; liked: boolean }) =>
      send(liked ? "POST" : "DELETE", `/api/public/comments/${id}/like`),
    onMutate: async ({ id, liked }) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<SongComment[]>(queryKey);
      queryClient.setQueryData<SongComment[]>(queryKey, (list) =>
        list?.map((c) =>
          c.id === id && c.liked !== liked
            ? { ...c, liked, likeCount: c.likeCount + (liked ? 1 : -1) }
            : c,
        ),
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous)
        queryClient.setQueryData(queryKey, context.previous);
    },
  });

  return {
    comments: query.data ?? [],
    loading: query.isPending,
    create: create.mutateAsync,
    edit: edit.mutateAsync,
    remove: remove.mutateAsync,
    like: like.mutate,
  };
}
