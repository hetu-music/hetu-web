"use client";

import React, { createContext, useCallback, useContext } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useUserContext } from "@/context/UserContext";
import { getCsrfToken, resetCsrfToken } from "@/lib/api/csrf";
import type { Song } from "@/lib/types";

interface FavoritesContextValue {
  /** Array of favorited song IDs */
  favorites: number[];
  /** Full Song objects for favorited songs (populated on load) */
  favoriteSongs: Song[];
  /** Toggle favorite state for a given song ID */
  toggleFavorite: (id: number) => void;
  /** Check if a song is in favorites */
  isFavorite: (id: number) => boolean;
  /** Clear all favorites */
  clearFavorites: () => Promise<void>;
  /** Refresh favorites from server */
  refreshFavorites: () => Promise<void>;
  /** Whether favorites data has been loaded */
  loaded: boolean;
  /** Whether the current user is logged in */
  isLoggedIn: boolean;
}

interface FavoritesData {
  favorites: number[];
  favoriteSongs: Song[];
}

const EMPTY: FavoritesData = { favorites: [], favoriteSongs: [] };

/** 按用户分开缓存：换账号时直接落到新 key 上，不会残留上一个用户的收藏 */
const favoritesKey = (userId: string | null) => ["favorites", userId] as const;

async function fetchFavorites(): Promise<FavoritesData> {
  const res = await fetch("/api/public/collections");
  // 接口失败视为没有收藏，而不是卡在加载中
  if (!res.ok) return EMPTY;
  const data = await res.json();
  return {
    favorites: data.songIds ?? [],
    favoriteSongs: Array.isArray(data.songs) ? data.songs : [],
  };
}

function sendCollectionChange(
  method: "POST" | "DELETE",
  songId: number,
  csrf: string,
) {
  return fetch("/api/public/collections", {
    method,
    headers: {
      "Content-Type": "application/json",
      "x-csrf-token": csrf,
    },
    body: JSON.stringify({ songId }),
  });
}

const FavoritesContext = createContext<FavoritesContextValue | null>(null);

export function FavoritesProvider({ children }: { children: React.ReactNode }) {
  const { user, loaded: userLoaded } = useUserContext();
  const queryClient = useQueryClient();
  const currentUserId = user?.id ?? null;
  const queryKey = favoritesKey(currentUserId);

  const { data = EMPTY, isPending } = useQuery({
    queryKey,
    queryFn: fetchFavorites,
    enabled: userLoaded && currentUserId !== null,
    // 只在收藏变动后主动失效，不按时间重新拉取
    staleTime: Infinity,
    retry: false,
  });
  const { favorites, favoriteSongs } = data;

  const loaded = !userLoaded
    ? false
    : currentUserId === null
      ? true
      : !isPending;

  const refreshFavorites = useCallback(
    () =>
      queryClient.invalidateQueries({ queryKey: favoritesKey(currentUserId) }),
    [queryClient, currentUserId],
  );

  const toggleFavorite = useCallback(
    async (id: number) => {
      if (!currentUserId) return;
      const key = favoritesKey(currentUserId);

      // 从缓存读当前状态，避免闭包里的旧值
      const isCurrentlyFav =
        queryClient.getQueryData<FavoritesData>(key)?.favorites.includes(id) ??
        false;

      // 乐观更新；取消收藏时顺手把歌曲对象也移走，
      // 新加的收藏不补歌曲数据，成功后整体重拉一次
      queryClient.setQueryData<FavoritesData>(key, (prev = EMPTY) =>
        isCurrentlyFav
          ? {
              favorites: prev.favorites.filter((x) => x !== id),
              favoriteSongs: prev.favoriteSongs.filter((s) => s.id !== id),
            }
          : { ...prev, favorites: [...prev.favorites, id] },
      );

      const rollback = () =>
        queryClient.setQueryData<FavoritesData>(key, (prev = EMPTY) => ({
          ...prev,
          favorites: isCurrentlyFav
            ? [...prev.favorites, id]
            : prev.favorites.filter((x) => x !== id),
        }));

      try {
        const csrf = await getCsrfToken();
        const res = await sendCollectionChange(
          isCurrentlyFav ? "DELETE" : "POST",
          id,
          csrf,
        );

        if (!res.ok) {
          rollback();
          resetCsrfToken();
          void queryClient.invalidateQueries({ queryKey: key });
          return;
        }

        // 加收藏成功后重拉，个人页才有完整的歌曲信息
        if (!isCurrentlyFav) {
          void queryClient.invalidateQueries({ queryKey: key });
        }
      } catch {
        rollback();
      }
    },
    [queryClient, currentUserId],
  );

  const isFavorite = useCallback(
    (id: number) => favorites.includes(id),
    [favorites],
  );

  const clearFavorites = useCallback(async () => {
    if (!currentUserId || favorites.length === 0) return;
    const key = favoritesKey(currentUserId);
    const previous = queryClient.getQueryData<FavoritesData>(key);
    queryClient.setQueryData<FavoritesData>(key, EMPTY);

    try {
      const csrf = await getCsrfToken();
      await Promise.all(
        favorites.map((id) => sendCollectionChange("DELETE", id, csrf)),
      );
    } catch {
      queryClient.setQueryData(key, previous);
    }
  }, [queryClient, currentUserId, favorites]);

  return (
    <FavoritesContext.Provider
      value={{
        favorites,
        favoriteSongs,
        toggleFavorite,
        isFavorite,
        clearFavorites,
        refreshFavorites,
        loaded,
        isLoggedIn: !!user,
      }}
    >
      {children}
    </FavoritesContext.Provider>
  );
}

export function useFavorites(): FavoritesContextValue {
  const ctx = useContext(FavoritesContext);
  if (!ctx) {
    throw new Error("useFavorites must be used within FavoritesProvider");
  }
  return ctx;
}
