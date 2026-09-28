import React from "react";
import { FILTER_OPTION_ALL, FILTER_OPTION_UNKNOWN } from "@/lib/constants";
import CustomSelect from "./CustomSelect";
import { Slider } from "@/components/ui/slider";
import { useTranslations } from "next-intl";

interface SongFiltersProps {
  yearRangeIndices: [number, number];
  setYearRangeIndices: (range: [number, number]) => void;
  sliderYears: (string | number)[];
  selectedGenre: string[];
  setSelectedGenre: (genre: string[]) => void;
  selectedArtist: string[];
  setSelectedArtist: (artist: string[]) => void;
  selectedLyricist: string[];
  setSelectedLyricist: (lyricist: string[]) => void;
  selectedComposer: string[];
  setSelectedComposer: (composer: string[]) => void;
  selectedArranger: string[];
  setSelectedArranger: (arranger: string[]) => void;
  filterOptions: {
    allTypes: string[];
    allGenres: string[];
    allYears: (string | number | null)[];
    allLyricists: string[];
    allComposers: string[];
    allArrangers: string[];
    allArtists: string[];
  };
}

const YearRangeSlider = ({
  range,
  setRange,
  values,
}: {
  range: [number, number];
  setRange: (range: [number, number]) => void;
  values: (string | number)[];
}) => {
  const maxIndex = values.length - 1;

  return (
    <div className="px-1 py-1 select-none">
      {/* Selected range labels */}
      <div className="flex justify-between mb-3">
        <span className="text-xs font-semibold tabular-nums text-(--tone)">
          {values[range[0]]}
        </span>
        <span className="text-xs font-semibold tabular-nums text-(--tone)">
          {values[range[1]]}
        </span>
      </div>

      <Slider
        min={0}
        max={maxIndex}
        step={1}
        value={[range[0], range[1]]}
        onValueChange={(v) => setRange([v[0], v[1]] as [number, number])}
        minStepsBetweenThumbs={0}
        aria-label="Year range"
      />

      {/* Boundary labels */}
      <div className="flex justify-between mt-2 text-[10px] text-slate-400/60 font-mono">
        <span>{values[0]}</span>
        <span>{values[maxIndex]}</span>
      </div>
    </div>
  );
};

const SongFilters: React.FC<SongFiltersProps> = ({
  yearRangeIndices,
  setYearRangeIndices,
  sliderYears,
  selectedGenre,
  setSelectedGenre,
  selectedArtist,
  setSelectedArtist,
  selectedLyricist,
  setSelectedLyricist,
  selectedComposer,
  setSelectedComposer,
  selectedArranger,
  setSelectedArranger,
  filterOptions,
}) => {
  const t = useTranslations("library.filter");
  const tEnum = useTranslations("enums");
  const tCommon = useTranslations("common");

  // 共享样式常量
  const labelStyle =
    "text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest";

  const getGenreLabel = (genre: string) => {
    if (genre === FILTER_OPTION_UNKNOWN) return tCommon("unknown");
    return tEnum.has(`genre.${genre}`) ? tEnum(`genre.${genre}`) : genre;
  };

  // If no years loaded yet, use dummy
  const displayYears =
    sliderYears.length > 0
      ? sliderYears
      : [new Date().getFullYear(), FILTER_OPTION_UNKNOWN];

  return (
    <div className="w-full flex flex-col gap-4 p-1">
      {/* Top Row: Year Slider */}
      <div className="w-full bg-white/30 dark:bg-slate-900/30 border border-slate-100 dark:border-slate-800/50 rounded-xl p-3">
        <div className={`${labelStyle} mb-1`}>{t("yearRange")}</div>
        <YearRangeSlider
          range={yearRangeIndices}
          setRange={setYearRangeIndices}
          values={displayYears}
        />
      </div>

      {/* Bottom Row: Other Filters */}
      <div className="w-full bg-white/30 dark:bg-slate-900/30 border border-slate-100 dark:border-slate-800/50 rounded-xl p-3">
        <div className="w-full grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {/* Genre Filter */}
          <div className="flex flex-col gap-1">
            <label className={`${labelStyle} ml-1`}>{t("genre")}</label>
            <CustomSelect
              value={selectedGenre}
              onChange={setSelectedGenre}
              placeholder={t("allGenres")}
              selectAllLabel={t("selectAll")}
              allSelectedLabel={t("allSelected")}
              options={filterOptions.allGenres
                .filter((genre) => genre !== FILTER_OPTION_ALL)
                .map((genre) => ({
                  value: genre,
                  label: getGenreLabel(genre),
                }))}
            />
          </div>

          {/* Artist Filter */}
          <div className="flex flex-col gap-1">
            <label className={`${labelStyle} ml-1`}>{t("artist")}</label>
            <CustomSelect
              value={selectedArtist}
              onChange={setSelectedArtist}
              placeholder={t("allArtists")}
              selectAllLabel={t("selectAll")}
              allSelectedLabel={t("allSelected")}
              options={filterOptions.allArtists
                .filter((artist) => artist !== FILTER_OPTION_ALL)
                .map((artist) => ({ value: artist, label: artist }))}
            />
          </div>

          {/* Lyricist Filter */}
          <div className="flex flex-col gap-1">
            <label className={`${labelStyle} ml-1`}>{t("lyricist")}</label>
            <CustomSelect
              value={selectedLyricist}
              onChange={setSelectedLyricist}
              placeholder={t("allLyricists")}
              selectAllLabel={t("selectAll")}
              allSelectedLabel={t("allSelected")}
              options={filterOptions.allLyricists
                .filter((lyricist) => lyricist !== FILTER_OPTION_ALL)
                .map((lyricist) => ({ value: lyricist, label: lyricist }))}
            />
          </div>

          {/* Composer Filter */}
          <div className="flex flex-col gap-1">
            <label className={`${labelStyle} ml-1`}>{t("composer")}</label>
            <CustomSelect
              value={selectedComposer}
              onChange={setSelectedComposer}
              placeholder={t("allComposers")}
              selectAllLabel={t("selectAll")}
              allSelectedLabel={t("allSelected")}
              options={filterOptions.allComposers
                .filter((composer) => composer !== FILTER_OPTION_ALL)
                .map((composer) => ({ value: composer, label: composer }))}
            />
          </div>

          {/* Arranger Filter */}
          <div className="flex flex-col gap-1">
            <label className={`${labelStyle} ml-1`}>{t("arranger")}</label>
            <CustomSelect
              value={selectedArranger}
              onChange={setSelectedArranger}
              placeholder={t("allArrangers")}
              selectAllLabel={t("selectAll")}
              allSelectedLabel={t("allSelected")}
              options={filterOptions.allArrangers
                .filter((arranger) => arranger !== FILTER_OPTION_ALL)
                .map((arranger) => ({ value: arranger, label: arranger }))}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default SongFilters;
