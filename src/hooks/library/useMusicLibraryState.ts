"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from "react";
import {
  parseAsArrayOf,
  parseAsBoolean,
  parseAsInteger,
  parseAsString,
  parseAsStringLiteral,
} from "nuqs";
import {
  DEFAULT_MUSIC_LIBRARY_VIEW_MODE,
  FILTER_OPTION_ALL,
  type MusicLibraryViewMode,
  MUSIC_LIBRARY_VIEW_MODES,
} from "@/lib/constants";
import { useSyncedQueryState } from "@/hooks/utils/useSyncedQueryState";

export interface MusicLibraryState {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  filterType: string;
  setFilterType: (type: string) => void;
  yearRangeIndices: [number, number];
  setYearRangeIndices: (range: [number, number]) => void;
  filterGenre: string[];
  setFilterGenre: (genre: string[]) => void;
  filterLyricist: string[];
  setFilterLyricist: (lyricist: string[]) => void;
  filterComposer: string[];
  setFilterComposer: (composer: string[]) => void;
  filterArranger: string[];
  setFilterArranger: (arranger: string[]) => void;
  filterArtist: string[];
  setFilterArtist: (artist: string[]) => void;
  viewMode: MusicLibraryViewMode;
  setViewMode: (mode: MusicLibraryViewMode) => void;
  currentPage: number;
  setPaginationPage: (page: number) => void;
  showAdvancedFilters: boolean;
  setShowAdvancedFilters: (show: boolean) => void;
  resetAllFilters: () => void;
  handleSongClick: () => void;
  isRestoringScroll: boolean;
  notifyDataReady: () => void;
}

const STORAGE_KEY = "music_library_scrollY";

function areStringArraysEqual(left: string[], right: string[]) {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

export function useMusicLibraryState(
  initialSliderYearsLength: number,
  defaultViewMode: MusicLibraryViewMode = DEFAULT_MUSIC_LIBRARY_VIEW_MODE,
): MusicLibraryState {
  const getMaxYearIndex = useCallback(
    () => Math.max(0, initialSliderYearsLength - 1),
    [initialSliderYearsLength],
  );

  const [searchQuery, setSearchQueryState] = useSyncedQueryState<string>(
    "q",
    parseAsString.withDefault("").withOptions({ shallow: true }),
  );
  const [filterType, setFilterTypeState] = useSyncedQueryState<string>(
    "type",
    parseAsString.withDefault(FILTER_OPTION_ALL).withOptions({ shallow: true }),
  );
  const [filterGenre, setFilterGenreState] = useSyncedQueryState<string[]>(
    "genre",
    parseAsArrayOf(parseAsString)
      .withDefault([])
      .withOptions({ shallow: true }),
    { equals: areStringArraysEqual },
  );
  const [filterLyricist, setFilterLyricistState] = useSyncedQueryState<
    string[]
  >(
    "lyricist",
    parseAsArrayOf(parseAsString)
      .withDefault([])
      .withOptions({ shallow: true }),
    { equals: areStringArraysEqual },
  );
  const [filterComposer, setFilterComposerState] = useSyncedQueryState<
    string[]
  >(
    "composer",
    parseAsArrayOf(parseAsString)
      .withDefault([])
      .withOptions({ shallow: true }),
    { equals: areStringArraysEqual },
  );
  const [filterArranger, setFilterArrangerState] = useSyncedQueryState<
    string[]
  >(
    "arranger",
    parseAsArrayOf(parseAsString)
      .withDefault([])
      .withOptions({ shallow: true }),
    { equals: areStringArraysEqual },
  );
  const [filterArtist, setFilterArtistState] = useSyncedQueryState<string[]>(
    "artist",
    parseAsArrayOf(parseAsString)
      .withDefault([])
      .withOptions({ shallow: true }),
    { equals: areStringArraysEqual },
  );
  const [yearStart, setYearStartState] = useSyncedQueryState<number>(
    "yearStart",
    parseAsInteger.withDefault(0).withOptions({ shallow: true }),
  );
  const [yearEnd, setYearEndState] = useSyncedQueryState<number>(
    "yearEnd",
    parseAsInteger
      .withDefault(getMaxYearIndex())
      .withOptions({ shallow: true }),
  );
  const [viewMode, setViewModeState] =
    useSyncedQueryState<MusicLibraryViewMode>(
      "view",
      parseAsStringLiteral(MUSIC_LIBRARY_VIEW_MODES)
        .withDefault(defaultViewMode)
        .withOptions({ shallow: true }),
    );
  const [currentPage, setCurrentPageState] = useSyncedQueryState<number>(
    "page",
    parseAsInteger.withDefault(1).withOptions({ shallow: true }),
  );
  const [showAdvancedFilters, setShowAdvancedFiltersState] =
    useSyncedQueryState<boolean>(
      "advanced",
      parseAsBoolean.withDefault(false).withOptions({ shallow: true }),
    );

  const yearRangeIndices = useMemo<[number, number]>(() => {
    const maxIndex = getMaxYearIndex();
    const start = Math.max(0, Math.min(yearStart, maxIndex));
    const end = Math.max(0, Math.min(yearEnd, maxIndex));
    return start <= end ? [start, end] : [end, start];
  }, [getMaxYearIndex, yearEnd, yearStart]);

  // 初始值必须与服务端一致，不能在初始化时读 sessionStorage，否则 hydration 不匹配，
  // 而 React 不会修补不匹配的属性，隐藏就不生效。改为挂载后、绘制前再读。
  const [isRestoringScroll, setIsRestoringScroll] = useState(false);

  useLayoutEffect(() => {
    if (sessionStorage.getItem(STORAGE_KEY) !== null) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsRestoringScroll(true);
    }
  }, []);

  useEffect(() => {
    const handlePopState = () => {
      if (sessionStorage.getItem(STORAGE_KEY)) {
        setIsRestoringScroll(true);
      }
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const restoreScroll = useCallback(() => {
    const savedScroll = sessionStorage.getItem(STORAGE_KEY);
    if (!savedScroll) {
      setIsRestoringScroll(false);
      return;
    }

    window.scrollTo(0, parseInt(savedScroll, 10));
    sessionStorage.removeItem(STORAGE_KEY);
    requestAnimationFrame(() => setIsRestoringScroll(false));
  }, []);

  const notifyDataReady = useCallback(() => {
    restoreScroll();
  }, [restoreScroll]);

  const handleSongClick = useCallback(() => {
    if (typeof window !== "undefined") {
      sessionStorage.setItem(STORAGE_KEY, window.scrollY.toString());
    }
  }, []);

  const setSearchQuery = useCallback(
    (query: string) => {
      setSearchQueryState(query);
      setCurrentPageState(1);
    },
    [setCurrentPageState, setSearchQueryState],
  );

  const setFilterType = useCallback(
    (type: string) => {
      setFilterTypeState(type);
      setCurrentPageState(1);
    },
    [setCurrentPageState, setFilterTypeState],
  );

  const setFilterGenre = useCallback(
    (genre: string[]) => {
      setFilterGenreState(genre);
      setCurrentPageState(1);
    },
    [setCurrentPageState, setFilterGenreState],
  );

  const setFilterLyricist = useCallback(
    (lyricist: string[]) => {
      setFilterLyricistState(lyricist);
      setCurrentPageState(1);
    },
    [setCurrentPageState, setFilterLyricistState],
  );

  const setFilterComposer = useCallback(
    (composer: string[]) => {
      setFilterComposerState(composer);
      setCurrentPageState(1);
    },
    [setCurrentPageState, setFilterComposerState],
  );

  const setFilterArranger = useCallback(
    (arranger: string[]) => {
      setFilterArrangerState(arranger);
      setCurrentPageState(1);
    },
    [setCurrentPageState, setFilterArrangerState],
  );

  const setFilterArtist = useCallback(
    (artist: string[]) => {
      setFilterArtistState(artist);
      setCurrentPageState(1);
    },
    [setCurrentPageState, setFilterArtistState],
  );

  const setYearRangeIndices = useCallback(
    (range: [number, number]) => {
      const maxIndex = getMaxYearIndex();
      const start = Math.max(0, Math.min(range[0], maxIndex));
      const end = Math.max(start, Math.min(range[1], maxIndex));

      setYearStartState(start);
      setYearEndState(end);
      setCurrentPageState(1);
    },
    [getMaxYearIndex, setCurrentPageState, setYearEndState, setYearStartState],
  );

  const setViewMode = useCallback(
    (mode: MusicLibraryViewMode) => {
      setViewModeState(mode);
    },
    [setViewModeState],
  );

  const setPaginationPage = useCallback(
    (page: number) => {
      setCurrentPageState(Math.max(1, page));
    },
    [setCurrentPageState],
  );

  const setShowAdvancedFilters = useCallback(
    (show: boolean) => {
      setShowAdvancedFiltersState(show);
    },
    [setShowAdvancedFiltersState],
  );

  const resetAllFilters = useCallback(() => {
    setSearchQueryState("");
    setFilterTypeState(FILTER_OPTION_ALL);
    setFilterGenreState([]);
    setFilterLyricistState([]);
    setFilterComposerState([]);
    setFilterArrangerState([]);
    setFilterArtistState([]);
    setYearStartState(0);
    setYearEndState(getMaxYearIndex());
    setCurrentPageState(1);
    setShowAdvancedFiltersState(false);
  }, [
    getMaxYearIndex,
    setCurrentPageState,
    setFilterArrangerState,
    setFilterArtistState,
    setFilterComposerState,
    setFilterGenreState,
    setFilterLyricistState,
    setFilterTypeState,
    setSearchQueryState,
    setShowAdvancedFiltersState,
    setYearEndState,
    setYearStartState,
  ]);

  return {
    searchQuery,
    setSearchQuery,
    filterType,
    setFilterType,
    yearRangeIndices,
    setYearRangeIndices,
    filterGenre,
    setFilterGenre,
    filterLyricist,
    setFilterLyricist,
    filterComposer,
    setFilterComposer,
    filterArranger,
    setFilterArranger,
    filterArtist,
    setFilterArtist,
    viewMode,
    setViewMode,
    currentPage: Math.max(1, currentPage),
    setPaginationPage,
    showAdvancedFilters,
    setShowAdvancedFilters,
    resetAllFilters,
    handleSongClick,
    isRestoringScroll,
    notifyDataReady,
  };
}
