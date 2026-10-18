import { Plus, X } from "lucide-react";
import { Controller, useFieldArray, useFormContext } from "react-hook-form";
import { genreColorMap, typeColorMap } from "@/lib/constants";
import type {
  SongArrayFieldItem,
  SongFormStateValues,
} from "@/lib/forms/song-form";
import type { SongFieldConfig } from "@/lib/types";
import { cn } from "@/lib/utils/utils";
import {
  INPUT_CLASS,
  INPUT_ERROR_CLASS,
  LABEL_CLASS,
  SELECT_CLASS,
  TEXT_BUTTON_CLASS,
} from "../kit/styles";
import { FieldErrorMessage } from "./shared";
import type { CreatorFieldKey } from "./types";
import { getInputValue, isCreatorFieldKey } from "./utils";

function inputClass(hasError: boolean, extra?: string) {
  return cn(INPUT_CLASS, hasError && INPUT_ERROR_CLASS, extra);
}

/** 创作者类字段：可增删的多行输入 */
function CreatorFieldArrayInput({ fieldKey }: { fieldKey: CreatorFieldKey }) {
  const { control, formState, getFieldState, register } =
    useFormContext<SongFormStateValues>();
  const { fields, append, remove } = useFieldArray({
    control,
    name: fieldKey,
  });
  const errorMessage = getFieldState(fieldKey, formState).error?.message;

  return (
    <div className="space-y-1.5">
      {fields.map((item, index) => (
        <div key={item.id} className="flex items-center gap-2">
          <input
            {...register(`${fieldKey}.${index}.value`)}
            className={inputClass(Boolean(errorMessage))}
          />
          <button
            type="button"
            onClick={() => remove(index)}
            className="p-1 text-slate-300 transition-colors hover:text-rose-500 dark:text-slate-600"
            aria-label="移除这一项"
          >
            <X size={14} />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => append({ value: "" } satisfies SongArrayFieldItem)}
        className={cn(TEXT_BUTTON_CLASS, "inline-flex items-center gap-1 py-1")}
      >
        <Plus size={12} /> 添加一项
      </button>
      <FieldErrorMessage message={errorMessage} />
    </div>
  );
}

/** 类型、流派：多选的文字开关，选中只变色 */
function ToggleOptions({
  options,
  value,
  onChange,
}: {
  options: string[];
  value: string[];
  onChange: (next: string[]) => void;
}) {
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1 py-1">
      {options.map((opt) => {
        const active = value.includes(opt);
        return (
          <button
            key={opt}
            type="button"
            aria-pressed={active}
            onClick={() =>
              onChange(
                active ? value.filter((x) => x !== opt) : [...value, opt],
              )
            }
            className={cn(
              "text-sm tracking-wider transition-colors",
              active
                ? "text-(--tone)"
                : "text-slate-400 hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-200",
            )}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}

const BOOLEAN_OPTIONS: Partial<
  Record<SongFieldConfig["key"], { value: string; label: string }[]>
> = {
  hascover: [
    { value: "", label: "白底狐狸（默认）" },
    { value: "false", label: "初号机（黑底）" },
    { value: "true", label: "定制封面" },
  ],
  nmn_status: [
    { value: "false", label: "无" },
    { value: "true", label: "有" },
  ],
};

/** 按字段配置分派到对应的输入控件 */
function SongFormInput({ field }: { field: SongFieldConfig }) {
  const { control } = useFormContext<SongFormStateValues>();

  if (isCreatorFieldKey(field.key)) {
    return <CreatorFieldArrayInput fieldKey={field.key} />;
  }

  return (
    <Controller
      control={control}
      name={field.key}
      render={({ field: controllerField, fieldState }) => {
        const value = controllerField.value;
        const errorMessage = fieldState.error?.message;
        const hasError = Boolean(errorMessage);
        const text = getInputValue(
          typeof value === "string" || typeof value === "number"
            ? value
            : undefined,
        );

        if (field.key === "genre" || field.key === "type") {
          const options = Object.keys(
            field.key === "genre" ? genreColorMap : typeColorMap,
          );
          const arr = Array.isArray(value)
            ? value.filter((item): item is string => typeof item === "string")
            : typeof value === "string"
              ? [value]
              : [];
          return (
            <>
              <ToggleOptions
                options={options}
                value={arr}
                onChange={controllerField.onChange}
              />
              <FieldErrorMessage message={errorMessage} />
            </>
          );
        }

        if (field.type === "textarea") {
          const isLyrics = field.key === "lyrics";
          return (
            <>
              <textarea
                {...controllerField}
                value={text}
                onChange={(e) => controllerField.onChange(e.target.value)}
                className={inputClass(
                  hasError,
                  cn(
                    "resize-y leading-relaxed",
                    isLyrics && "font-mono text-xs leading-6",
                  ),
                )}
                rows={isLyrics ? 18 : 4}
                spellCheck={!isLyrics}
                placeholder={field.placeholder ?? `请输入${field.label}`}
              />
              <FieldErrorMessage className="mt-1" message={errorMessage} />
            </>
          );
        }

        if (field.type === "boolean") {
          const options = BOOLEAN_OPTIONS[field.key] ?? [];
          return (
            <>
              <select
                {...controllerField}
                value={value === true ? "true" : value === false ? "false" : ""}
                onChange={(e) =>
                  controllerField.onChange(
                    e.target.value === "true"
                      ? true
                      : e.target.value === "false"
                        ? false
                        : null,
                  )
                }
                className={cn(SELECT_CLASS, hasError && INPUT_ERROR_CLASS)}
              >
                {options.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <FieldErrorMessage message={errorMessage} />
            </>
          );
        }

        return (
          <>
            <input
              {...controllerField}
              type={
                field.type === "number"
                  ? "number"
                  : field.type === "date"
                    ? "date"
                    : "text"
              }
              value={text}
              onChange={(e) =>
                controllerField.onChange(
                  field.type === "number"
                    ? e.target.value === ""
                      ? null
                      : Number(e.target.value)
                    : e.target.value,
                )
              }
              className={inputClass(hasError, "tabular-nums")}
              placeholder={field.placeholder ?? `请输入${field.label}`}
            />
            <FieldErrorMessage className="mt-1" message={errorMessage} />
          </>
        );
      }}
    />
  );
}

/** 一个字段：标签加输入。与线上版本不同的字段在标签旁标一个点 */
export default function SongFormField({
  field,
  changed = false,
  className,
}: {
  field: SongFieldConfig;
  /** 暂存版与线上版不同 */
  changed?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label className={cn(LABEL_CLASS, "flex items-center gap-1.5")}>
        {field.label}
        {field.required && <span className="text-rose-500">*</span>}
        {changed && (
          <span
            className="size-1.5 rounded-full bg-(--tone)"
            title="与线上版本不同"
            aria-label="与线上版本不同"
          />
        )}
      </label>
      <SongFormInput field={field} />
    </div>
  );
}
