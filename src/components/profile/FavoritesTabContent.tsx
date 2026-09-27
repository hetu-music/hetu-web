"use client";

import { useFavorites } from "@/context/FavoritesContext";
import { getCoverUrl } from "@/lib/utils/utils-song";
import PlayButton from "@/components/shared/PlayButton";
import EnqueueButton from "@/components/shared/EnqueueButton";
import { Heart, Loader2, Trash2 } from "lucide-react";
import Image from "next/image";
import { useRouter } from "@/i18n/navigation";

export default function FavoritesTabContent() {
  const router = useRouter();
  const {
    favoriteSongs,
    toggleFavorite,
    clearFavorites,
    loaded: favoritesLoaded,
  } = useFavorites();

  if (!favoritesLoaded) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-320px)]">
        <Loader2 size={32} className="animate-spin text-blue-500" />
      </div>
    );
  }

  if (favoriteSongs.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[calc(100vh-320px)] bg-white dark:bg-slate-900 rounded-xl border border-slate-200/50 dark:border-slate-800/50 p-6 text-center shadow-xs">
        <Heart size={32} className="text-slate-200 dark:text-slate-800 mb-3" />
        <p className="text-slate-500 text-xs sm:text-sm">还没有收藏任何曲目</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 flex-1 flex flex-col">
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-slate-700 dark:text-slate-300">
            已收藏 {favoriteSongs.length} 首作品
          </span>
        </div>
        <button
          onClick={clearFavorites}
          className="text-xs font-bold text-rose-500 hover:text-rose-600 px-3 py-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors flex items-center gap-1.5"
        >
          <Trash2 size={12} />
          全部清除
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 pb-8">
        {favoriteSongs.map((song) => (
          <div
            key={song.id}
            className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/50 dark:border-slate-800/50 overflow-hidden transition-colors hover:border-blue-500/40 dark:hover:border-blue-500/30 group shadow-xs"
          >
            <div
              onClick={() => {
                const d = parseInt(
                  sessionStorage.getItem("__hetu_web_nav_depth") || "0",
                  10,
                );
                sessionStorage.setItem("__hetu_web_nav_depth", String(d + 1));
                router.push(`/song/${song.id}`);
              }}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 cursor-pointer"
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="w-12 h-12 rounded-lg overflow-hidden shrink-0 ring-1 ring-slate-900/5 dark:ring-white/10">
                  <Image
                    src={getCoverUrl(song)}
                    alt={song.title}
                    width={48}
                    height={48}
                    className="w-full h-full object-cover"
                  />
                </div>

                <div className="min-w-0">
                  <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                    {song.title}
                  </h4>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5 truncate">
                    {song.collectionInfo?.created_at && (
                      <span>
                        收藏于{" "}
                        {new Date(
                          song.collectionInfo.created_at,
                        ).toLocaleDateString()}
                      </span>
                    )}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 sm:pt-0 border-t border-slate-100 dark:border-slate-800/40 sm:border-0">
                <div className="flex items-center gap-1.5">
                  <PlayButton
                    songId={song.id}
                    title={song.title}
                    artist={song.artist?.join(" / ")}
                    coverUrl={getCoverUrl(song)}
                    hasAudio={song.has_audio}
                  />
                  <EnqueueButton
                    songId={song.id}
                    title={song.title}
                    artist={song.artist?.join(" / ")}
                    coverUrl={getCoverUrl(song)}
                    hasAudio={song.has_audio}
                  />
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleFavorite(song.id);
                    }}
                    className="p-2 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-all"
                    title="取消收藏"
                  >
                    <Heart size={16} className="fill-current" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
