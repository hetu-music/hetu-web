"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  apiGetSongEmotions,
  apiSetSongEmotions,
  apiSuggestSongEmotions,
} from "@/lib/api/client-api";
import { parseLrcLines } from "@/lib/imagery/suggest";
import type { Emotion } from "@/lib/types";
import { cn } from "@/lib/utils/utils";
import { EmptyState, ErrorState, LoadingState } from "../kit/parts";
import {
  LABEL_CLASS,
  OUTLINE_BUTTON_CLASS,
  PANEL_CLASS,
  SOLID_BUTTON_CLASS,
  TEXT_BUTTON_CLASS,
  WARN_TEXT_CLASS,
} from "../kit/styles";
import { notify, notifyError } from "../kit/toast";

const MAX = 3;

/** 词表按「明 / 暗」「扬 / 抑」分四格；河图的歌多在「暗·抑」，放在最前 */
const QUADRANTS: Array<{ tone: Emotion["tone"]; energy: Emotion["energy"] }> = [
  { tone: "暗", energy: "抑" },
  { tone: "暗", energy: "扬" },
  { tone: "明", energy: "扬" },
  { tone: "明", energy: "抑" },
];

const songEmotionsKey = (songId: number) =>
  ["admin", "song-emotions", songId] as const;

/**
 * 一首歌的基调（见 IMAGERY.md）：左边整首歌词，右边词表。
 * 依次点选，第一个是主基调，其后最多两个副基调；再点一次取消。
 * 批量预标（来源 ai）的歌要人看过：改了就保存，没问题就点「确认」，两者都把来源记为 human。
 */
export default function SongEmotionTab({
  song,
}: {
  song: { id: number; lyrics?: string | null };
}) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: songEmotionsKey(song.id),
    queryFn: () => apiGetSongEmotions(song.id),
  });
  // null：还没动过，跟着已保存的走
  const [draft, setDraft] = useState<number[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [suggestion, setSuggestion] = useState<{
    emotionIds: number[];
    reason: string;
  } | null>(null);
  const [suggesting, setSuggesting] = useState(false);
  const lines = useMemo(() => parseLrcLines(song.lyrics), [song.lyrics]);

  if (query.isError) {
    return (
      <ErrorState
        message={query.error.message}
        onRetry={() => void query.refetch()}
      />
    );
  }
  if (query.isPending) return <LoadingState text="加载基调…" />;

  const { emotions, selected: saved, source, llmEnabled } = query.data;
  const selected = draft ?? saved;
  const dirty = selected.join() !== saved.join();
  // AI 预标未确认时，原样保存也算确认
  const pending = source === "ai";
  const canSave = (dirty || pending) && !saving;
  const byId = new Map(emotions.map((e) => [e.id, e]));

  const toggle = (id: number) => {
    setDraft(
      selected.includes(id)
        ? selected.filter((x) => x !== id)
        : selected.length < MAX
          ? [...selected, id]
          : selected,
    );
  };

  const suggest = async () => {
    setSuggesting(true);
    try {
      setSuggestion(await apiSuggestSongEmotions(song.id));
    } catch (error) {
      notifyError(error, "AI 建议失败");
    } finally {
      setSuggesting(false);
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      await apiSetSongEmotions(song.id, selected);
      await queryClient.invalidateQueries({
        queryKey: songEmotionsKey(song.id),
      });
      setDraft(null);
      notify({ type: "success", text: dirty ? "基调已保存" : "基调已确认" });
    } catch (error) {
      notifyError(error, "保存基调失败");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <section className={cn(PANEL_CLASS, "px-5 py-4")}>
        <p className={LABEL_CLASS}>歌词</p>
        {lines.length === 0 && !song.lyrics?.trim() ? (
          <EmptyState>这首歌还没有歌词，先在「资料」里补上</EmptyState>
        ) : (
          <div className="mt-3 max-h-[70vh] space-y-1 overflow-y-auto text-sm leading-relaxed text-slate-700 dark:text-slate-200">
            {lines.length > 0
              ? lines.map((l, i) => <p key={`${l.tag}-${i}`}>{l.text}</p>)
              : song.lyrics
                  ?.split("\n")
                  .map((t, i) => <p key={i}>{t || " "}</p>)}
          </div>
        )}
      </section>

      <section className="space-y-6">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <p className={LABEL_CLASS}>基调</p>
          <p className="text-sm text-slate-700 dark:text-slate-200">
            {selected.length === 0
              ? "未标"
              : selected
                  .map(
                    (id, i) =>
                      `${byId.get(id)?.name ?? `#${id}`}${i === 0 ? "（主）" : ""}`,
                  )
                  .join(" · ")}
          </p>
          {pending && !dirty && (
            <span className={`text-xs ${WARN_TEXT_CLASS}`}>
              AI 预标，待确认
            </span>
          )}
        </div>

        {llmEnabled && (
          <div className="space-y-1 text-xs">
            <button
              type="button"
              onClick={() => void suggest()}
              disabled={suggesting}
              className={TEXT_BUTTON_CLASS}
              title="请模型读整首歌词给出基调，每次调用都有费用"
            >
              {suggesting ? "AI 正在读歌词…" : "AI 建议"}
            </button>
            {suggestion && (
              <p className="leading-relaxed text-slate-500 dark:text-slate-400">
                <span className="text-slate-700 dark:text-slate-200">
                  {suggestion.emotionIds
                    .map((id) => byId.get(id)?.name ?? `#${id}`)
                    .join(" · ")}
                </span>
                ：{suggestion.reason}
                <button
                  type="button"
                  onClick={() => setDraft(suggestion.emotionIds)}
                  className={cn(TEXT_BUTTON_CLASS, "ml-2")}
                >
                  采用
                </button>
              </p>
            )}
          </div>
        )}

        {QUADRANTS.map(({ tone, energy }) => {
          const group = emotions.filter(
            (e) => e.tone === tone && e.energy === energy,
          );
          if (group.length === 0) return null;
          return (
            <div key={tone + energy} className="space-y-2">
              <p className="text-xs text-slate-400">
                {tone} · {energy}
              </p>
              <div className="space-y-1">
                {group.map((e) => {
                  const rank = selected.indexOf(e.id);
                  const full = rank < 0 && selected.length >= MAX;
                  return (
                    <button
                      key={e.id}
                      type="button"
                      onClick={() => toggle(e.id)}
                      disabled={full}
                      aria-pressed={rank >= 0}
                      className={cn(
                        "flex w-full items-baseline gap-3 rounded-md border px-3 py-1.5 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-40",
                        rank >= 0
                          ? "border-(--tone) bg-(--tone)/5"
                          : "border-slate-200/70 hover:border-slate-300 dark:border-slate-800 dark:hover:border-slate-700",
                      )}
                    >
                      <span
                        className={cn(
                          "w-10 shrink-0 text-sm",
                          rank >= 0
                            ? "text-(--tone)"
                            : "text-slate-800 dark:text-slate-100",
                        )}
                      >
                        {e.name}
                      </span>
                      <span className="min-w-0 flex-1 text-xs text-slate-500 dark:text-slate-400">
                        {e.description}
                      </span>
                      {rank >= 0 && (
                        <span className="shrink-0 text-[11px] text-(--tone)">
                          {rank === 0 ? "主" : "副"}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setDraft(null)}
            disabled={!dirty || saving}
            className={OUTLINE_BUTTON_CLASS}
          >
            还原
          </button>
          <button
            type="button"
            onClick={() => void save()}
            disabled={!canSave}
            className={SOLID_BUTTON_CLASS}
          >
            {saving ? "保存中…" : pending && !dirty ? "确认" : "保存"}
          </button>
        </div>
      </section>
    </div>
  );
}
