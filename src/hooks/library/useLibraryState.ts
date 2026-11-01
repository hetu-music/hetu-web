"use client";

/**
 * 曲库页的状态：都存在地址栏里（格式见 src/lib/library/url-state.ts），
 * 读写走 useUrlState，不用 nuqs（见 docs/LIBRARY.md 阶段 3「5.」）。
 *
 * 搜索框和年份滑轨各有一份草稿：界面上立刻变，停下 300 毫秒才写进地址栏；
 * 结果直接跟着地址栏走。每次改动只写一次地址栏，改筛选时顺带把页码清掉（X6）。
 */
import { useCallback, useMemo, useState } from "react";
import { useDebouncedDraft } from "@/hooks/ui/useDebouncedDraft";
import { useUrlState } from "@/hooks/utils/useUrlState";
import { FILTER_OPTION_ALL, type MusicLibraryViewMode } from "@/lib/constants";
import {
  ALL_SELECTED,
  checkedValues,
  FACET_KEYS,
  type FacetKey,
  type FacetSelection,
  isSelectionActive,
  type LibraryFilters,
  type LibraryOptions,
  nextSelection,
  yearFromSlider,
  yearToSlider,
} from "@/lib/library/filters";
import {
  clearFilters,
  parseLibraryUrl,
  writeAdvanced,
  writeFacet,
  writePage,
  writeQuery,
  writeType,
  writeView,
  writeYear,
} from "@/lib/library/url-state";

/** 搜索框、年份滑轨停下多久才写进地址栏 */
const INPUT_DEBOUNCE_MS = 300;

const sameRange = (a: [number, number], b: [number, number]) =>
  a[0] === b[0] && a[1] === b[1];

export function useLibraryState(options: LibraryOptions) {
  const [params, update] = useUrlState();
  const url = useMemo(() => parseLibraryUrl(params), [params]);

  // 全选在地址栏里不写（结果和不筛选一样），界面上却要显示成全部勾上，记在这里
  const [allSelected, setAllSelected] = useState<ReadonlySet<FacetKey>>(
    () => new Set(),
  );

  const facets = useMemo(() => {
    const out = { ...url.facets };
    for (const key of FACET_KEYS) {
      if (!isSelectionActive(out[key]) && allSelected.has(key)) {
        out[key] = ALL_SELECTED;
      }
    }
    return out;
  }, [url.facets, allSelected]);

  const checked = useMemo(
    () =>
      Object.fromEntries(
        FACET_KEYS.map((k) => [k, checkedValues(facets[k], options.facets[k])]),
      ) as Record<FacetKey, string[]>,
    [facets, options.facets],
  );

  const filters = useMemo<LibraryFilters>(
    () => ({ type: url.type, year: url.year, facets }),
    [url.type, url.year, facets],
  );

  // ─── 搜索框 ───
  const commitQuery = useCallback(
    (query: string) =>
      update((d) => {
        writeQuery(d, query);
        writePage(d, 1);
      }),
    [update],
  );
  const [searchInput, updateSearchInput] = useDebouncedDraft(
    url.query,
    commitQuery,
    INPUT_DEBOUNCE_MS,
  );
  const setSearchInput = useCallback(
    (query: string) => updateSearchInput(query, query === ""),
    [updateSearchInput],
  );

  // ─── 年份滑轨 ───
  const sliderValue = useMemo(
    () => yearToSlider(url.year, options.years),
    [url.year, options.years],
  );
  const commitYear = useCallback(
    (range: [number, number]) =>
      update((d) => {
        writeYear(d, yearFromSlider(range, options.years));
        writePage(d, 1);
      }),
    [update, options.years],
  );
  const [yearSlider, updateYearSlider] = useDebouncedDraft(
    sliderValue,
    commitYear,
    INPUT_DEBOUNCE_MS,
    sameRange,
  );
  const setYearSlider = useCallback(
    (range: [number, number]) => {
      // 拖回两端（不筛选）立刻生效
      const full = yearFromSlider(range, options.years) === null;
      updateYearSlider(range, full);
    },
    [updateYearSlider, options.years],
  );

  // ─── 其余各项：直接写 ───
  const setType = useCallback(
    (type: string) =>
      update((d) => {
        writeType(d, type);
        writePage(d, 1);
      }),
    [update],
  );

  const setFacetChecked = useCallback(
    (key: FacetKey, next: string[]) => {
      const sel: FacetSelection = nextSelection(
        next,
        facets[key],
        options.facets[key],
      );
      setAllSelected((prev) => {
        const isAll = sel.mode === "exclude" && sel.values.length === 0;
        if (isAll === prev.has(key)) return prev;
        const copy = new Set(prev);
        if (isAll) copy.add(key);
        else copy.delete(key);
        return copy;
      });
      update((d) => {
        writeFacet(d, key, sel);
        writePage(d, 1);
      });
    },
    [facets, options.facets, update],
  );

  const setView = useCallback(
    (view: MusicLibraryViewMode) => update((d) => writeView(d, view)),
    [update],
  );
  const setPage = useCallback(
    (page: number) => update((d) => writePage(d, page)),
    [update],
  );
  const setAdvanced = useCallback(
    (open: boolean) => update((d) => writeAdvanced(d, open)),
    [update],
  );

  const resetAll = useCallback(() => {
    setAllSelected(new Set());
    update(clearFilters);
  }, [update]);

  // 按界面上显示的算（搜索框、滑轨的草稿），「重置」随手就出现
  const isAnyFilterActive =
    searchInput !== "" ||
    url.type !== FILTER_OPTION_ALL ||
    yearFromSlider(yearSlider, options.years) !== null ||
    FACET_KEYS.some((k) => isSelectionActive(facets[k])) ||
    allSelected.size > 0;

  return {
    /** 地址栏里的搜索词：结果按它搜 */
    query: url.query,
    /** 搜索框里显示的：比地址栏早 300 毫秒 */
    searchInput,
    setSearchInput,
    filters,
    checked,
    setFacetChecked,
    yearSlider,
    setYearSlider,
    setType,
    view: url.view,
    setView,
    page: url.page,
    setPage,
    advanced: url.advanced,
    setAdvanced,
    resetAll,
    isAnyFilterActive,
  };
}
