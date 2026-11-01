import React from "react";
import { FILTER_OPTION_UNKNOWN } from "@/lib/constants";
import { FIELD_LABEL_CLASS } from "@/components/shared/form-field";
import CustomSelect from "./CustomSelect";
import { Slider } from "@/components/ui/slider";
import { useTranslations } from "next-intl";
import {
  FACET_KEYS,
  type FacetKey,
  type LibraryOptions,
} from "@/lib/library/filters";

interface SongFiltersProps {
  options: LibraryOptions;
  /** 每个维度界面上勾着的值（归一化后的） */
  checked: Record<FacetKey, string[]>;
  onFacetChange: (key: FacetKey, values: string[]) => void;
  /** 每个维度里勾上之后还有歌的值；其余的置灰（F5） */
  available: Record<FacetKey, ReadonlySet<string>>;
  yearSlider: [number, number];
  onYearChange: (range: [number, number]) => void;
}

/** 各维度「全部」时的占位文字 */
const PLACEHOLDER_KEYS: Record<FacetKey, string> = {
  genre: "allGenres",
  artist: "allArtists",
  lyricist: "allLyricists",
  composer: "allComposers",
  arranger: "allArrangers",
};

/** 一个筛选项：上面字段标签，下面控件 */
function Field({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <span className={FIELD_LABEL_CLASS}>{label}</span>
      <div className="mt-2">{children}</div>
    </div>
  );
}

const SongFilters: React.FC<SongFiltersProps> = ({
  options,
  checked,
  onFacetChange,
  available,
  yearSlider,
  onYearChange,
}) => {
  const t = useTranslations("library.filter");
  const tEnum = useTranslations("enums");
  const tCommon = useTranslations("common");

  const labelOf = (key: FacetKey, label: string) => {
    if (label === FILTER_OPTION_UNKNOWN) return tCommon("unknown");
    if (key === "genre" && tEnum.has(`genre.${label}`)) {
      return tEnum(`genre.${label}`);
    }
    return label;
  };

  // 年份还没算出来时先给个占位区间
  const years =
    options.years.length > 0
      ? options.years
      : [new Date().getFullYear(), FILTER_OPTION_UNKNOWN];
  const [left, right] = yearSlider;
  const yearLabel = (i: number) => {
    const v = years[i];
    return v === FILTER_OPTION_UNKNOWN ? tCommon("unknown") : String(v);
  };

  return (
    // 不用卡片。年份滑轨单独一行：宽屏「标签 — 滑轨 — 区间」排成一行，
    // 窄屏标签与区间在上、滑轨在下。下面五个下拉框：宽屏一行五个；
    // 窄屏两列，流派独占一行，演唱、作词、作曲、编曲排成两行两列
    <div className="grid grid-cols-2 gap-x-8 gap-y-6 lg:grid-cols-5">
      <div className="col-span-full grid grid-cols-[1fr_auto] items-center gap-x-6 gap-y-3 lg:grid-cols-[auto_1fr_auto]">
        <span className={FIELD_LABEL_CLASS}>{t("yearRange")}</span>
        {/* 区间文字定宽右对齐，拖动时滑轨长度不跟着变 */}
        <span className="text-right text-xs tabular-nums tracking-wider text-slate-700 dark:text-slate-300 lg:order-last lg:min-w-28">
          {left === right
            ? yearLabel(left)
            : `${yearLabel(left)} — ${yearLabel(right)}`}
        </span>
        <div className="col-span-2 flex h-5 items-center lg:col-span-1">
          <Slider
            min={0}
            max={years.length - 1}
            step={1}
            value={[left, right]}
            onValueChange={(v) => onYearChange([v[0], v[1]])}
            minStepsBetweenValues={0}
            aria-label={t("yearRange")}
          />
        </div>
      </div>

      {FACET_KEYS.map((key) => {
        const selected = checked[key];
        return (
          <Field
            key={key}
            label={t(key)}
            className={key === "genre" ? "col-span-2 lg:col-span-1" : undefined}
          >
            <CustomSelect
              value={selected}
              onChange={(values) => onFacetChange(key, values)}
              label={t(key)}
              placeholder={t(PLACEHOLDER_KEYS[key])}
              options={options.facets[key].map((o) => ({
                value: o.value,
                label: labelOf(key, o.label),
                // 勾上之后一首都没有的置灰；已经勾着的不置灰，可以取消
                disabled:
                  !available[key].has(o.value) && !selected.includes(o.value),
              }))}
            />
          </Field>
        );
      })}
    </div>
  );
};

export default SongFilters;
