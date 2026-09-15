import { Plus, X } from "lucide-react";
import { Controller, useFieldArray, useFormContext } from "react-hook-form";
import CoverUpload from "@/components/admin/CoverUpload";
import ScoreUpload from "@/components/admin/ScoreUpload";
import { genreColorMap, typeColorMap } from "@/lib/constants";
import type {
  SongArrayFieldItem,
  SongFormStateValues,
} from "@/lib/forms/song-form";
import type { SongFieldConfig } from "@/lib/types";
import { cn } from "@/lib/utils/utils";
import { FieldErrorMessage } from "./shared";
import type { CreatorFieldKey } from "./types";
import { getInputValue, hasSongId, isCreatorFieldKey } from "./utils";

function inputClass(hasError: boolean) {
  return cn(
    "w-full px-4 py-2.5 bg-white dark:bg-black/20 border rounded-xl outline-none transition-all",
    hasError
      ? "border-red-300 focus:border-red-500 focus:ring-2 focus:ring-red-500/10"
      : "border-slate-200 dark:border-slate-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10",
  );
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
  const baseClass = inputClass(Boolean(errorMessage));

  return (
    <div className="space-y-2">
      {fields.map((item, index) => (
        <div key={item.id} className="flex gap-2">
          <input
            {...register(`${fieldKey}.${index}.value`)}
            className={baseClass}
          />
          <button
            type="button"
            onClick={() => remove(index)}
            className="p-2 text-red-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
          >
            <X size={18} />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => append({ value: "" } satisfies SongArrayFieldItem)}
        className="text-xs font-medium text-blue-600 hover:text-blue-500 flex items-center gap-1"
      >
        <Plus size={14} /> 添加一项
      </button>
      <FieldErrorMessage message={errorMessage} />
    </div>
  );
}

/** 按字段配置分派到对应的输入控件 */
export default function SongFormField({
  field,
  csrfToken,
  songId,
}: {
  field: SongFieldConfig;
  csrfToken: string;
  songId?: number;
}) {
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
        const baseClass = inputClass(Boolean(errorMessage));

        if (field.key === "genre" || field.key === "type") {
          const options =
            field.key === "genre"
              ? Object.keys(genreColorMap)
              : Object.keys(typeColorMap);
          const arr = Array.isArray(value)
            ? value.filter((item): item is string => typeof item === "string")
            : typeof value === "string"
              ? [value]
              : [];

          return (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2">
                {options.map((opt) => {
                  const isActive = arr.includes(opt);
                  const colorClass =
                    (field.key === "genre" ? genreColorMap : typeColorMap)[
                      opt
                    ] || "bg-slate-100 text-slate-600";

                  return (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => {
                        const next = isActive
                          ? arr.filter((x) => x !== opt)
                          : [...arr, opt];
                        controllerField.onChange(next);
                      }}
                      className={cn(
                        "px-3 py-1 rounded-full text-xs font-medium border transition-all",
                        isActive
                          ? "ring-2 ring-offset-1 ring-blue-500 dark:ring-offset-[#151921]"
                          : "opacity-80 grayscale-[0.3] hover:grayscale-0 hover:opacity-100",
                        colorClass
                          .replace("bg-", "bg-opacity-20 bg-")
                          .replace("text-", "text-"),
                      )}
                      style={{
                        backgroundColor: isActive ? undefined : "transparent",
                        borderColor: isActive ? "transparent" : "currentColor",
                      }}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>
              <FieldErrorMessage message={errorMessage} />
            </div>
          );
        }

        if (field.type === "textarea") {
          return (
            <>
              <textarea
                {...controllerField}
                value={getInputValue(
                  typeof value === "string" || typeof value === "number"
                    ? value
                    : undefined,
                )}
                onChange={(e) => controllerField.onChange(e.target.value)}
                className={baseClass}
                rows={4}
                placeholder={`请输入${field.label}`}
              />
              <FieldErrorMessage className="mt-1" message={errorMessage} />
            </>
          );
        }

        if (field.type === "boolean") {
          const isCover = field.key === "hascover";
          const isScore = field.key === "nmn_status";

          return (
            <div className="space-y-3">
              <div className="flex gap-4">
                <select
                  {...controllerField}
                  value={
                    value === true ? "true" : value === false ? "false" : ""
                  }
                  onChange={(e) => {
                    const nextValue =
                      e.target.value === "true"
                        ? true
                        : e.target.value === "false"
                          ? false
                          : null;
                    controllerField.onChange(nextValue);
                  }}
                  className={cn(
                    baseClass,
                    "bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100",
                    "[&>option]:bg-white [&>option]:dark:bg-slate-800 [&>option]:text-slate-900 [&>option]:dark:text-slate-100",
                  )}
                >
                  {isCover ? (
                    <>
                      <option value="">白底狐狸 (默认)</option>
                      <option value="false">初号机 (黑底)</option>
                      <option value="true">定制封面</option>
                    </>
                  ) : (
                    <>
                      <option value="false">否 / 无</option>
                      <option value="true">是 / 有</option>
                    </>
                  )}
                </select>
              </div>

              {isCover && value === true && hasSongId(songId) && (
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-black/20 border border-slate-100 dark:border-slate-800">
                  <CoverUpload
                    songId={songId}
                    csrfToken={csrfToken}
                    onUploadSuccess={() => void 0}
                    onUploadError={console.error}
                  />
                </div>
              )}

              {isScore && value === true && hasSongId(songId) && (
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-black/20 border border-slate-100 dark:border-slate-800">
                  <ScoreUpload
                    songId={songId}
                    csrfToken={csrfToken}
                    onUploadSuccess={() => void 0}
                    onUploadError={console.error}
                  />
                </div>
              )}

              <FieldErrorMessage message={errorMessage} />
            </div>
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
              value={getInputValue(
                typeof value === "string" || typeof value === "number"
                  ? value
                  : undefined,
              )}
              onChange={(e) =>
                controllerField.onChange(
                  field.type === "number"
                    ? e.target.value === ""
                      ? null
                      : Number(e.target.value)
                    : e.target.value,
                )
              }
              className={baseClass}
              placeholder={`请输入${field.label}`}
            />
            <FieldErrorMessage className="mt-1" message={errorMessage} />
          </>
        );
      }}
    />
  );
}
