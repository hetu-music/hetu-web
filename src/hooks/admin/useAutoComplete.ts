"use client";

import { useState, useCallback } from "react";
import type { Song } from "@/lib/types";
import {
  apiSearchSongs,
  apiGetSongDetail,
  type SearchResultItem,
  type MusicProviderType,
  type AutoCompleteResponse,
} from "@/lib/api/api-auto-complete";

// ============================================
// 类型定义
// ============================================

export type AutoCompleteState = {
  isAutoCompleting: boolean;
  searchResults: SearchResultItem[];
  showSearchResults: boolean;
  currentProvider: MusicProviderType;
};

export type AutoCompleteActions = {
  /** 触发自动补全搜索 */
  handleAutoComplete: (
    provider: MusicProviderType,
    title: string,
    artists?: string[],
  ) => Promise<SearchResultItem[] | null>;
  /** 选择搜索结果并获取详情 */
  handleSelectSearchResult: (
    song: SearchResultItem,
  ) => Promise<AutoCompleteResponse | null>;
  /** 关闭搜索结果弹窗 */
  closeSearchResults: () => void;
  /** 重置状态 */
  reset: () => void;
};

export type UseAutoCompleteReturn = AutoCompleteState & AutoCompleteActions;

// ============================================
// 辅助函数
// ============================================

/**
 * 判断值是否为空
 */
function isEmpty(value: unknown): boolean {
  return (
    value === null ||
    value === undefined ||
    (Array.isArray(value) && value.length === 0) ||
    (typeof value === "string" && value.trim() === "")
  );
}

/**
 * 判断值是否有效（非空）
 */
function isValidValue(value: unknown): boolean {
  return (
    value !== null &&
    value !== undefined &&
    !(Array.isArray(value) && value.length === 0) &&
    !(typeof value === "string" && value.trim() === "")
  );
}

/**
 * 合并自动补全数据到表单
 * 只填充当前为空的字段，不覆盖已有数据
 */
export function mergeAutoCompleteData<T extends Partial<Song>>(
  currentForm: T,
  autoCompleteData: AutoCompleteResponse,
): T {
  const merged = { ...currentForm };

  for (const [key, value] of Object.entries(autoCompleteData)) {
    const currentValue = currentForm[key as keyof T];

    // 只有当前字段为空且 API 返回有效值时才填充
    if (isEmpty(currentValue) && isValidValue(value)) {
      (merged as Record<string, unknown>)[key] = value;
    }
  }

  return merged;
}

// ============================================
// Hook 实现
// ============================================

/**
 * 自动补全 Hook
 *
 * @param onError - 错误回调
 * @returns 自动补全状态和操作方法
 */
export function useAutoComplete(
  onError?: (message: string) => void,
): UseAutoCompleteReturn {
  const [isAutoCompleting, setIsAutoCompleting] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResultItem[]>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [currentProvider, setCurrentProvider] =
    useState<MusicProviderType>("netease");

  /**
   * 第一步：搜索歌曲
   */
  const handleAutoComplete = useCallback(
    async (
      provider: MusicProviderType,
      title: string,
      artists?: string[],
    ): Promise<SearchResultItem[] | null> => {
      if (!title) {
        onError?.("请先输入歌曲标题");
        return null;
      }

      try {
        setIsAutoCompleting(true);
        setCurrentProvider(provider);

        // 构建搜索关键词：标题 + 艺术家（如果有）
        const keywordsParts = [title];
        if (artists && artists.length > 0) {
          keywordsParts.push(...artists);
        }
        const keywords = keywordsParts.join(" ");

        const response = await apiSearchSongs(keywords, provider, 10);

        if (response.results.length === 0) {
          onError?.("未找到匹配的歌曲");
          return null;
        }

        // 显示搜索结果供用户选择
        setSearchResults(response.results);
        setShowSearchResults(true);
        return response.results;
      } catch (err) {
        onError?.(err instanceof Error ? err.message : "搜索失败");
        return null;
      } finally {
        setIsAutoCompleting(false);
      }
    },
    [onError],
  );

  /**
   * 第二步：用户选择歌曲后获取详情
   */
  const handleSelectSearchResult = useCallback(
    async (song: SearchResultItem): Promise<AutoCompleteResponse | null> => {
      try {
        setIsAutoCompleting(true);
        setShowSearchResults(false);

        const data = await apiGetSongDetail(song, currentProvider);
        return data;
      } catch (err) {
        onError?.(err instanceof Error ? err.message : "获取详情失败");
        return null;
      } finally {
        setIsAutoCompleting(false);
      }
    },
    [currentProvider, onError],
  );

  /**
   * 关闭搜索结果弹窗
   */
  const closeSearchResults = useCallback(() => {
    setShowSearchResults(false);
  }, []);

  /**
   * 重置状态
   */
  const reset = useCallback(() => {
    setIsAutoCompleting(false);
    setSearchResults([]);
    setShowSearchResults(false);
    setCurrentProvider("netease");
  }, []);

  return {
    // State
    isAutoCompleting,
    searchResults,
    showSearchResults,
    currentProvider,
    // Actions
    handleAutoComplete,
    handleSelectSearchResult,
    closeSearchResults,
    reset,
  };
}
