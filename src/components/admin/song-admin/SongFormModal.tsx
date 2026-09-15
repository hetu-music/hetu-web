import { Globe, Save, Wand2, X } from "lucide-react";
import { FormProvider, type UseFormReturn } from "react-hook-form";
import { songFields } from "@/lib/constants";
import type { MusicProviderType } from "@/lib/api/api-auto-complete";
import type { SongFormStateValues } from "@/lib/forms/song-form";
import type { SongDetail } from "@/lib/types";
import { cn } from "@/lib/utils/utils";
import SongFormField from "./SongFormFields";
import type { SongFormMode } from "./types";

const PROVIDER_BUTTONS: {
  provider: MusicProviderType;
  label: string;
  title: string;
  gradient: string;
}[] = [
  {
    provider: "netease",
    label: "网易云",
    title: "从网易云音乐自动补全",
    gradient:
      "bg-linear-to-r from-red-500 to-rose-500 hover:from-red-400 hover:to-rose-400 shadow-red-500/20 hover:shadow-red-500/30",
  },
  {
    provider: "kugou",
    label: "酷狗",
    title: "从酷狗音乐自动补全",
    gradient:
      "bg-linear-to-r from-blue-500 to-cyan-500 hover:from-blue-400 hover:to-cyan-400 shadow-blue-500/20 hover:shadow-blue-500/30",
  },
];

function Spinner() {
  return (
    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
  );
}

export default function SongFormModal({
  formMode,
  editSong,
  songForm,
  csrfToken,
  isPublishing,
  isAutoCompleting,
  currentProvider,
  onAutoComplete,
  onSubmit,
  onPublishClick,
  onClose,
}: {
  formMode: SongFormMode;
  editSong: SongDetail | null;
  songForm: UseFormReturn<SongFormStateValues>;
  csrfToken: string;
  isPublishing: boolean;
  isAutoCompleting: boolean;
  currentProvider: MusicProviderType | null;
  onAutoComplete: (provider: MusicProviderType) => void;
  onSubmit: React.FormEventHandler<HTMLFormElement>;
  onPublishClick: () => void;
  onClose: () => void;
}) {
  const isBusy = songForm.formState.isSubmitting || isPublishing;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-[#151921] w-full max-w-4xl max-h-[90vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col pt-0 animate-in zoom-in-95 duration-200 border border-slate-200/50 dark:border-slate-800">
        {/* Modal Header */}
        <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-white/50 dark:bg-[#151921]/50 backdrop-blur-md sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
              {formMode === "add" ? "添加新歌曲" : "编辑歌曲"}
            </h2>
            {/* 自动补全按钮 - 仅在编辑模式下显示 */}
            {formMode === "edit" &&
              editSong &&
              PROVIDER_BUTTONS.map(({ provider, label, title, gradient }) => (
                <button
                  key={provider}
                  type="button"
                  onClick={() => onAutoComplete(provider)}
                  disabled={isAutoCompleting}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all",
                    "text-white shadow-md hover:shadow-lg",
                    gradient,
                    "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-md",
                  )}
                  title={title}
                >
                  {isAutoCompleting && currentProvider === provider ? (
                    <Spinner />
                  ) : (
                    <Wand2 size={16} />
                  )}
                  <span>{label}</span>
                </button>
              ))}
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <FormProvider {...songForm}>
          <div className="flex-1 overflow-y-auto p-6 md:p-8">
            <form id="song-form" onSubmit={onSubmit} className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                {songFields.map((field) => (
                  <div
                    key={field.key}
                    className={cn(
                      "flex flex-col gap-2",
                      field.type === "textarea" ? "md:col-span-2" : "",
                    )}
                  >
                    <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 ml-1">
                      {field.label}
                      {field.key === "title" && (
                        <span className="text-red-500 ml-1">*</span>
                      )}
                    </label>
                    <SongFormField
                      field={field}
                      csrfToken={csrfToken}
                      songId={editSong?.id}
                    />
                  </div>
                ))}
              </div>
            </form>
          </div>

          {/* Modal Footer */}
          <div className="p-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-[#151921] flex justify-between items-center gap-3 sticky bottom-0 z-10">
            <div>
              {formMode === "edit" && (
                <button
                  type="button"
                  onClick={onPublishClick}
                  disabled={isBusy}
                  className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium shadow-lg shadow-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
                >
                  {isPublishing ? <Spinner /> : <Globe size={18} />}
                  <span>发布</span>
                </button>
              )}
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={isBusy}
                className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-medium hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                取消
              </button>
              <button
                type="submit"
                form="song-form"
                disabled={isBusy}
                className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium shadow-lg shadow-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
              >
                {songForm.formState.isSubmitting ? (
                  <Spinner />
                ) : (
                  <Save size={18} />
                )}
                {formMode === "add" ? "确认添加" : "保存修改"}
              </button>
            </div>
          </div>
        </FormProvider>
      </div>
    </div>
  );
}
