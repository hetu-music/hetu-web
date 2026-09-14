"use client";

import React, { useState, useEffect } from "react";
import { FileText, Loader2, MessageSquarePlus, Pencil } from "lucide-react";
import { useUserContext } from "@/context/UserContext";
import { useFavorites } from "@/context/FavoritesContext";
import { getCsrfToken } from "@/lib/api/csrf";
import { cn } from "@/lib/utils/utils";

interface UserReviewProps {
  songId: number;
}

const UserReview: React.FC<UserReviewProps> = ({ songId }) => {
  const { user } = useUserContext();
  const { isFavorite, refreshFavorites } = useFavorites();
  const [review, setReview] = useState("");
  const [isEditingReview, setIsEditingReview] = useState(false);
  const [isSavingReview, setIsSavingReview] = useState(false);

  useEffect(() => {
    if (!user) return;
    fetch(`/api/public/collections/review?songId=${songId}`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch review");
        return res.json();
      })
      .then((data) => {
        if (data.review) setReview(data.review);
      })
      .catch((err) => console.error(err));
  }, [user, songId]);

  const handleSaveReview = async () => {
    setIsSavingReview(true);
    try {
      const csrf = await getCsrfToken();

      // 确保收藏行存在（唯一约束保证不会重复，23505 冲突视为成功）
      if (!isFavorite(songId)) {
        await fetch("/api/public/collections", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-csrf-token": csrf,
          },
          body: JSON.stringify({ songId }),
        });
      }

      // 保存评论（upsert：基于唯一约束原子更新）
      const res = await fetch("/api/public/collections/review", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": csrf,
        },
        body: JSON.stringify({ songId, review }),
      });
      if (!res.ok) throw new Error("Failed to save review");
      setIsEditingReview(false);

      // Refresh context so other pages pick up updated data
      refreshFavorites();
    } catch (err) {
      console.error(err);
      alert("保存评论失败，请稍后重试");
    } finally {
      setIsSavingReview(false);
    }
  };

  if (!user) return null;

  return (
    <div
      id="my-review"
      className="p-6 rounded-2xl bg-slate-100/70 dark:bg-slate-800/30 border border-slate-200/60 dark:border-slate-800"
    >
      {/* 标题行 */}
      <div className="flex items-center gap-2 mb-4 text-slate-400">
        <FileText size={16} />
        <h2 className="text-xs font-bold uppercase tracking-wider">
          My Review
        </h2>
      </div>

      {/* 内容区 */}
      {isEditingReview ? (
        <div className="space-y-3">
          <textarea
            value={review}
            onChange={(e) => setReview(e.target.value)}
            placeholder="写下你对这首歌的想法..."
            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/50 resize-y min-h-[100px] transition-shadow"
          />
          {/* 操作按钮组 */}
          <div className="flex items-center justify-end gap-2">
            <button
              onClick={() => setIsEditingReview(false)}
              className="px-4 py-2 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 hover:border-slate-300 dark:hover:border-slate-600 transition-all active:scale-95"
            >
              取消
            </button>
            <button
              onClick={handleSaveReview}
              disabled={isSavingReview}
              className={cn(
                "px-4 py-2 rounded-xl text-sm font-medium transition-all active:scale-95",
                "bg-blue-500 hover:bg-blue-600 text-white shadow-sm shadow-blue-500/20",
                "disabled:opacity-60 disabled:cursor-not-allowed disabled:active:scale-100",
                "flex items-center gap-1.5",
              )}
            >
              {isSavingReview ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  保存中
                </>
              ) : (
                "保存"
              )}
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-sm whitespace-pre-line break-words min-w-0">
            {review || <span className="text-slate-400 italic">暂无评论</span>}
          </p>
          {/* 添加/编辑按钮 — 右对齐 */}
          <div className="flex justify-end">
            <button
              onClick={() => setIsEditingReview(true)}
              className={cn(
                "flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all active:scale-95",
                "text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-800",
                "border border-slate-200 dark:border-slate-700",
                "hover:bg-slate-50 dark:hover:bg-slate-700 hover:border-slate-300 dark:hover:border-slate-600",
              )}
            >
              {review ? (
                <>
                  <Pencil size={13} />
                  编辑评论
                </>
              ) : (
                <>
                  <MessageSquarePlus size={14} />
                  添加评论
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserReview;
