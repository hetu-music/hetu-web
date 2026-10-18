"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import {
  apiGetImageryCategories,
  apiGetImageryItems,
  apiGetMeanings,
} from "@/lib/api/client-api";
import type { ImageryCategory, ImageryItem, ImageryMeaning } from "@/lib/types";

/**
 * 意象词典、分类、含义的查询：意象库各页与歌曲工作台的「意象」一栏共用同一份缓存，
 * 在两边之间来回切不必重取，一边改了另一边也跟着变。
 */
export const IMAGERY_KEYS = {
  items: ["admin", "imagery", "items"],
  categories: ["admin", "imagery", "categories"],
  meanings: ["admin", "imagery", "meanings"],
} as const;

const STALE_MS = 5 * 60 * 1000;

export function useImageryItemsQuery() {
  return useQuery<ImageryItem[]>({
    queryKey: IMAGERY_KEYS.items,
    queryFn: apiGetImageryItems,
    staleTime: STALE_MS,
  });
}

/** initialData：分类页由服务端先取好一份，不必在客户端再取 */
export function useImageryCategoriesQuery(initialData?: ImageryCategory[]) {
  return useQuery<ImageryCategory[]>({
    queryKey: IMAGERY_KEYS.categories,
    queryFn: apiGetImageryCategories,
    staleTime: STALE_MS,
    initialData,
  });
}

export function useImageryMeaningsQuery() {
  return useQuery<ImageryMeaning[]>({
    queryKey: IMAGERY_KEYS.meanings,
    queryFn: apiGetMeanings,
    staleTime: STALE_MS,
  });
}

/** 写操作成功后就地改缓存，不再整表重取 */
export function useUpdateCache<T>(key: readonly unknown[]) {
  const queryClient = useQueryClient();
  return useCallback(
    (update: (current: T[]) => T[]) =>
      queryClient.setQueryData<T[]>(key, (current = []) => update(current)),
    [key, queryClient],
  );
}
