"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
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

interface FavoritesState {
  userId: string | null;
  favorites: number[];
  favoriteSongs: Song[];
  loaded: boolean;
}

const FavoritesContext = createContext<FavoritesContextValue | null>(null);

export function FavoritesProvider({ children }: { children: React.ReactNode }) {
  const { user, loaded: userLoaded } = useUserContext();
  const [favoritesState, setFavoritesState] = useState<FavoritesState>({
    userId: null,
    favorites: [],
    favoriteSongs: [],
    loaded: false,
  });
  const prevUserIdRef = useRef<string | null>(null);
  const currentUserId = user?.id ?? null;
  const favorites = useMemo(
    () =>
      favoritesState.userId === currentUserId ? favoritesState.favorites : [],
    [currentUserId, favoritesState.favorites, favoritesState.userId],
  );
  const favoriteSongs = useMemo(
    () =>
      favoritesState.userId === currentUserId
        ? favoritesState.favoriteSongs
        : [],
    [currentUserId, favoritesState.favoriteSongs, favoritesState.userId],
  );
  const loaded = !userLoaded
    ? false
    : currentUserId === null
      ? true
      : favoritesState.userId === currentUserId && favoritesState.loaded;

  // Reload favorites when user changes
  const fetchFavorites = useCallback(async () => {
    if (!currentUserId) return;

    try {
      const res = await fetch("/api/public/collections");
      if (!res.ok) {
        setFavoritesState({
          userId: currentUserId,
          favorites: [],
          favoriteSongs: [],
          loaded: true,
        });
        return;
      }
      const data = await res.json();
      setFavoritesState({
        userId: currentUserId,
        favorites: data.songIds ?? [],
        favoriteSongs: Array.isArray(data.songs) ? data.songs : [],
        loaded: true,
      });
    } catch {
      setFavoritesState((prev) =>
        prev.userId === currentUserId
          ? { ...prev, loaded: true }
          : {
              userId: currentUserId,
              favorites: [],
              favoriteSongs: [],
              loaded: true,
            },
      );
    }
  }, [currentUserId]);

  useEffect(() => {
    if (!userLoaded) return;

    // Skip if user hasn't changed
    if (currentUserId === prevUserIdRef.current) return;
    prevUserIdRef.current = currentUserId;

    if (currentUserId) {
      void fetch("/api/public/collections")
        .then(async (res) => {
          if (!res.ok) {
            setFavoritesState({
              userId: currentUserId,
              favorites: [],
              favoriteSongs: [],
              loaded: true,
            });
            return;
          }

          const data = await res.json();
          setFavoritesState({
            userId: currentUserId,
            favorites: data.songIds ?? [],
            favoriteSongs: Array.isArray(data.songs) ? data.songs : [],
            loaded: true,
          });
        })
        .catch(() => {
          setFavoritesState({
            userId: currentUserId,
            favorites: [],
            favoriteSongs: [],
            loaded: true,
          });
        });
    }
  }, [currentUserId, userLoaded]);

  const toggleFavorite = useCallback(
    async (id: number) => {
      if (!user) return;

      // Read current state via functional update pattern to avoid stale closure
      let isCurrentlyFav = false;

      setFavoritesState((prev) => {
        const prevFavorites =
          prev.userId === currentUserId ? prev.favorites : [];
        isCurrentlyFav = prevFavorites.includes(id);
        return {
          userId: currentUserId,
          favorites: isCurrentlyFav
            ? prevFavorites.filter((x) => x !== id)
            : [...prevFavorites, id],
          favoriteSongs:
            prev.userId === currentUserId ? prev.favoriteSongs : [],
          loaded: true,
        };
      });

      // Also optimistically remove from favoriteSongs if unfavoriting
      // (we don't need to add song data on favorite — it'll be there on next full fetch)
      if (isCurrentlyFav) {
        setFavoritesState((prev) => ({
          ...prev,
          userId: currentUserId,
          favoriteSongs: prev.favoriteSongs.filter((s) => s.id !== id),
        }));
      }

      try {
        const csrf = await getCsrfToken();
        const res = await fetch("/api/public/collections", {
          method: isCurrentlyFav ? "DELETE" : "POST",
          headers: {
            "Content-Type": "application/json",
            "x-csrf-token": csrf,
          },
          body: JSON.stringify({ songId: id }),
        });

        if (!res.ok) {
          // Rollback
          setFavoritesState((prev) => ({
            ...prev,
            userId: currentUserId,
            favorites: isCurrentlyFav
              ? [...prev.favorites, id]
              : prev.favorites.filter((x) => x !== id),
          }));
          resetCsrfToken();
          // Re-fetch to get consistent state
          void fetchFavorites();
          return;
        }

        // After a successful add, re-fetch to get the full song data
        // so that the profile page shows the correct song info
        if (!isCurrentlyFav) {
          void fetchFavorites();
        }
      } catch {
        // Rollback on network error
        setFavoritesState((prev) => ({
          ...prev,
          userId: currentUserId,
          favorites: isCurrentlyFav
            ? [...prev.favorites, id]
            : prev.favorites.filter((x) => x !== id),
        }));
      }
    },
    [currentUserId, fetchFavorites, user],
  );

  const isFavorite = useCallback(
    (id: number) => favorites.includes(id),
    [favorites],
  );

  const clearFavorites = useCallback(async () => {
    if (!user || favorites.length === 0) return;
    const prevFavs = favorites;
    const prevSongs = favoriteSongs;
    setFavoritesState({
      userId: currentUserId,
      favorites: [],
      favoriteSongs: [],
      loaded: true,
    });

    try {
      const csrf = await getCsrfToken();
      await Promise.all(
        prevFavs.map((id) =>
          fetch("/api/public/collections", {
            method: "DELETE",
            headers: {
              "Content-Type": "application/json",
              "x-csrf-token": csrf,
            },
            body: JSON.stringify({ songId: id }),
          }),
        ),
      );
    } catch {
      // Rollback
      setFavoritesState({
        userId: currentUserId,
        favorites: prevFavs,
        favoriteSongs: prevSongs,
        loaded: true,
      });
    }
  }, [currentUserId, user, favorites, favoriteSongs]);

  return (
    <FavoritesContext.Provider
      value={{
        favorites,
        favoriteSongs,
        toggleFavorite,
        isFavorite,
        clearFavorites,
        refreshFavorites: fetchFavorites,
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
