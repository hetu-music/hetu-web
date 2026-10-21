"use client";

import { useUserContext } from "@/context/UserContext";
import { apiRequest, type RequestOptions } from "@/lib/api/request";
import type { SongComment } from "@/lib/types";
import type { NewCommentAnchor } from "@/lib/utils/utils-comments";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale } from "next-intl";
import { useCallback, useMemo } from "react";

export type NewComment =
  | (NewCommentAnchor & { body: string; private: boolean })
  | { parentId: number; body: string };

/** 批注的写操作：服务端的提示（字数超限、被批原文已改等）都是给用户看的 */
function send<T>(
  method: RequestOptions["method"],
  url: string,
  body?: unknown,
) {
  return apiRequest<T>(url, {
    method,
    body,
    fallback: "操作失败，请稍后重试",
    serverMessage: true,
  });
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
