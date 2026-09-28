import React from "react";
import { FILTER_OPTION_ALL, FILTER_OPTION_UNKNOWN } from "@/lib/constants";
import { FIELD_LABEL_CLASS } from "@/components/shared/form-field";
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

/** 一个筛选项：上面字段标签，下面控件 */
function Field({
  label,
  aside,
  className,
  children,
}: {
  label: string;
  /** 标签右侧的补充，如年份的当前区间 */
  aside?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <div className="flex items-baseline justify-between gap-3">
        <span className={FIELD_LABEL_CLASS}>{label}</span>
        {aside}
      </div>
      <div className="mt-2">{children}</div>
    </div>
  );
}

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

  const getGenreLabel = (genre: string) => {
    if (genre === FILTER_OPTION_UNKNOWN) return tCommon("unknown");
    return tEnum.has(`genre.${genre}`) ? tEnum(`genre.${genre}`) : genre;
  };

  // 年份还没算出来时先给个占位区间
  const years =
    sliderYears.length > 0
      ? sliderYears
      : [new Date().getFullYear(), FILTER_OPTION_UNKNOWN];
  const [from, to] = yearRangeIndices;
  const yearLabel = (i: number) => {
    const v = years[i];
    return v === FILTER_OPTION_UNKNOWN ? tCommon("unknown") : String(v);
  };

  const selects = [
    {
      key: "genre",
      value: selectedGenre,
      onChange: setSelectedGenre,
      placeholder: t("allGenres"),
      options: filterOptions.allGenres
        .filter((v) => v !== FILTER_OPTION_ALL)
        .map((v) => ({ value: v, label: getGenreLabel(v) })),
    },
    {
      key: "artist",
      value: selectedArtist,
      onChange: setSelectedArtist,
      placeholder: t("allArtists"),
      options: filterOptions.allArtists
        .filter((v) => v !== FILTER_OPTION_ALL)
        .map((v) => ({ value: v, label: v })),
    },
    {
      key: "lyricist",
      value: selectedLyricist,
      onChange: setSelectedLyricist,
      placeholder: t("allLyricists"),
      options: filterOptions.allLyricists
        .filter((v) => v !== FILTER_OPTION_ALL)
        .map((v) => ({ value: v, label: v })),
    },
    {
      key: "composer",
      value: selectedComposer,
      onChange: setSelectedComposer,
      placeholder: t("allComposers"),
      options: filterOptions.allComposers
        .filter((v) => v !== FILTER_OPTION_ALL)
        .map((v) => ({ value: v, label: v })),
    },
    {
      key: "arranger",
      value: selectedArranger,
      onChange: setSelectedArranger,
      placeholder: t("allArrangers"),
      options: filterOptions.allArrangers
        .filter((v) => v !== FILTER_OPTION_ALL)
        .map((v) => ({ value: v, label: v })),
    },
  ];

  return (
    // 不用卡片：宽屏一行字段，年份占两格；窄屏两列，年份与流派各占一行，
    // 演唱、作词、作曲、编曲四个人名字段排成两行两列
    <div className="grid grid-cols-2 gap-x-8 gap-y-6 lg:grid-cols-7">
      <Field
        label={t("yearRange")}
        className="col-span-2"
        aside={
          <span className="text-xs tabular-nums tracking-wider text-slate-700 dark:text-slate-300">
            {from === to
              ? yearLabel(from)
              : `${yearLabel(from)} — ${yearLabel(to)}`}
          </span>
        }
      >
        {/* 滑轨贴底，与下拉框的底线在同一高度（滑轨本身只有 2px 高） */}
        <div className="flex h-9 items-end">
          <Slider
            min={0}
            max={years.length - 1}
            step={1}
            value={[from, to]}
            onValueChange={(v) =>
              setYearRangeIndices([v[0], v[1]] as [number, number])
            }
            minStepsBetweenThumbs={0}
            aria-label={t("yearRange")}
          />
        </div>
      </Field>

      {selects.map((s) => (
        <Field
          key={s.key}
          label={t(s.key)}
          className={s.key === "genre" ? "col-span-2 lg:col-span-1" : undefined}
        >
          <CustomSelect
            value={s.value}
            onChange={s.onChange}
            label={t(s.key)}
            placeholder={s.placeholder}
            options={s.options}
          />
        </Field>
      ))}
    </div>
  );
};

export default SongFilters;
