"use client";

import { useDebouncedValue } from "@mantine/hooks";
import { useMemo } from "react";
import {
  FILTER_OPTION_ALL,
  MUSIC_LIBRARY_ITEMS_PER_PAGE,
} from "@/lib/constants";
import type { FilterOptions, Song } from "@/lib/types";
import {
  calculateFilterOptions,
  createFuseInstance,
  searchAndFilterSongs,
} from "@/lib/utils/utils-song";
import { useLyricsIndex } from "./useLyricsIndex";

interface UseFilteredSongsOptions {
  songs: Song[];
  filterOptions?: FilterOptions;
  sliderYears?: (string | number)[];
  searchQuery: string;
  filterType: string;
  yearRangeIndices: [number, number];
  filterGenre: string[];
  filterLyricist: string[];
  filterComposer: string[];
  filterArranger: string[];
  filterArtist: string[];
}

export function useFilteredSongs({
  songs,
  filterOptions: providedFilterOptions,
  sliderYears: providedSliderYears,
  searchQuery,
  filterType,
  yearRangeIndices,
  filterGenre,
  filterLyricist,
  filterComposer,
  filterArranger,
  filterArtist,
}: UseFilteredSongsOptions) {
  const filterOptions = useMemo(
    () => providedFilterOptions ?? calculateFilterOptions(songs),
    [providedFilterOptions, songs],
  );

  const sliderYears = useMemo(
    () => providedSliderYears ?? filterOptions.allYears.slice(1),
    [providedSliderYears, filterOptions.allYears],
  );

  const [debouncedSearchQuery] = useDebouncedValue(searchQuery, 300);
  const searchQueryForFiltering =
    searchQuery === "" ? searchQuery : debouncedSearchQuery;

  const [debouncedYearRangeIndices] = useDebouncedValue(yearRangeIndices, 300);
  const resolvedYearRangeIndices =
    yearRangeIndices[0] === 0 && yearRangeIndices[1] === sliderYears.length - 1
      ? yearRangeIndices
      : debouncedYearRangeIndices;

  const fuseInstance = useMemo(() => createFuseInstance(songs), [songs]);
  const {
    lyricsFuseInstance,
    lyricsMap,
    state: lyricsState,
  } = useLyricsIndex(songs);

  const activeFuseInstance = searchQueryForFiltering
    ? (lyricsFuseInstance ?? fuseInstance)
    : fuseInstance;

  const selectedYear = useMemo(() => {
    if (sliderYears.length === 0) {
      return FILTER_OPTION_ALL as string | (string | number)[];
    }

    const [start, end] = resolvedYearRangeIndices;
    if (start === 0 && end === sliderYears.length - 1) {
      return FILTER_OPTION_ALL as string | (string | number)[];
    }

    return sliderYears.slice(start, end + 1);
  }, [resolvedYearRangeIndices, sliderYears]);

  const searchResult = useMemo(
    () =>
      searchAndFilterSongs(
        songs,
        searchQueryForFiltering,
        filterType,
        selectedYear,
        filterLyricist,
        filterComposer,
        filterArranger,
        filterGenre,
        filterArtist,
        activeFuseInstance,
      ),
    [
      songs,
      searchQueryForFiltering,
      filterType,
      selectedYear,
      filterLyricist,
      filterComposer,
      filterArranger,
      filterGenre,
      filterArtist,
      activeFuseInstance,
    ],
  );

  const filteredSongs = searchResult.songs;
  const lyricMatchesById = searchResult.lyricMatchesById;

  const isAnyFilterActive =
    searchQuery !== "" ||
    filterType !== FILTER_OPTION_ALL ||
    filterGenre.length > 0 ||
    filterLyricist.length > 0 ||
    filterComposer.length > 0 ||
    filterArranger.length > 0 ||
    filterArtist.length > 0 ||
    (sliderYears.length > 0 &&
      (yearRangeIndices[0] !== 0 ||
        yearRangeIndices[1] !== sliderYears.length - 1));

  return {
    filterOptions,
    sliderYears,
    filteredSongs,
    lyricMatchesById,
    lyricsMap,
    lyricsState,
    searchQueryForFiltering,
    isAnyFilterActive,
    itemsPerPage: MUSIC_LIBRARY_ITEMS_PER_PAGE,
  };
}
