"use client";

import ProfileSectionHeading from "@/components/profile/ProfileSectionHeading";
import {
  FIELD_CLASS,
  FIELD_LABEL_CLASS,
  TEXTAREA_CLASS,
} from "@/components/shared/form-field";
import {
  PRIMARY_BUTTON_CLASS,
  TEXT_BUTTON_CLASS,
} from "@/components/shared/text-button";
import { useUserContext } from "@/context/UserContext";
import { useAutoGrow } from "@/hooks/ui";
import { useCsrfToken } from "@/hooks/utils/useCsrfToken";
import { apiCreateRequest, apiGetMyRequests } from "@/lib/api/client-api";
import type { RequestStatus, RequestType, UserRequest } from "@/lib/types";
import { cn } from "@/lib/utils/utils";
import { Loader2, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import {
  type FormEvent,
  useCallback,
  useEffect,
  useReducer,
  useRef,
  useState,
} from "react";

const CONTENT_MAX = 2000;
/** 字数接近上限时才显示计数 */
const SHOW_COUNT_FROM = CONTENT_MAX - 200;

/** 状态只用文字颜色区分；已拒绝用 rose，其余不另加色 */
const STATUS_CLASS: Record<RequestStatus, string> = {
  pending: "text-slate-400 dark:text-slate-500",
  replied: "text-(--tone)",
  approved: "text-(--tone)",
  rejected: "text-rose-500 dark:text-rose-400",
};

/** 建议反馈：提交纠错或申请，下方列出自己提交过的记录 */
export default function FeedbackSection() {
  const t = useTranslations("profile");
  const [requests, setRequests] = useState<UserRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      const { requests: data } = await apiGetMyRequests();
      setRequests(data);
    } catch {
      // 静默失败，保持空列表
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchRequests();
  }, [fetchRequests]);

  return (
    <section>
      <ProfileSectionHeading label={t("tabs.feedback")} />

      <div className="mt-8 lg:mt-12 max-w-[40em]">
        <h3 className="text-xs tracking-[0.3em] text-slate-400 dark:text-slate-500">
          {t("feedback.submitTitle")}
        </h3>
        <SubmitForm onSubmitted={fetchRequests} />
      </div>

      <div className="mt-20">
        <div className="flex items-baseline justify-between gap-4">
          <h3 className="text-xs tracking-[0.3em] text-slate-400 dark:text-slate-500">
            {t("feedback.historyTitle")}
          </h3>
          {!loading && (
            <span className="text-xs text-slate-400 dark:text-slate-500">
              {t("feedback.historyCount", { count: requests.length })}
            </span>
          )}
        </div>
        <RequestList
          requests={requests}
          loading={loading}
          onRefresh={fetchRequests}
        />
      </div>
    </section>
  );
}

// ─── 歌曲搜索 ─────────────────────────────────────────────────────────────────

interface SongOption {
  id: number;
  title: string;
}

function SongPicker({
  value,
  onChange,
}: {
  value: SongOption | null;
  onChange: (song: SongOption | null) => void;
}) {
  const t = useTranslations("profile.feedback");
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<SongOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // 防抖搜索
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!query.trim()) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOptions([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    timerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/public/songs/search?q=${encodeURIComponent(query)}&limit=10`,
        );
        const data = await res.json();
        setOptions(data.songs ?? []);
      } catch {
        setOptions([]);
      } finally {
        setLoading(false);
      }
    }, 300);
  }, [query]);

  const select = (song: SongOption) => {
    onChange(song);
    setQuery("");
    setOptions([]);
    setOpen(false);
  };

  if (value) {
    return (
      <div className="flex items-center gap-2 py-1.5 border-b border-(--tone)/40">
        <span className="flex-1 min-w-0 truncate font-serif text-[15px] text-slate-900 dark:text-slate-100">
          {value.title}
        </span>
        <button
          type="button"
          onClick={() => onChange(null)}
          aria-label={t("clearSong")}
          className="shrink-0 p-0.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
        >
          <X size={14} />
        </button>
      </div>
    );
  }

  const showEmpty = open && query.trim() && !loading && options.length === 0;

  return (
    // 输入时弹出的候选直接挂在输入框下方；窄屏弹出软键盘时底部面板会被挡住
    <div ref={wrapperRef} className="relative">
      <input
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => query && setOpen(true)}
        placeholder={t("songPlaceholder")}
        className={cn(FIELD_CLASS, "pr-6")}
      />
      {loading && (
        <Loader2
          size={14}
          className="absolute right-0 top-1/2 -translate-y-1/2 animate-spin text-slate-400"
        />
      )}

      {open && (options.length > 0 || showEmpty) && (
        <div className="absolute z-40 top-full mt-2 w-full min-w-56 rounded-xl border border-slate-200/70 dark:border-slate-800 bg-[#FAFAFA] dark:bg-[#0B0F19] shadow-[0_16px_40px_-12px_rgba(15,23,42,0.25)] py-1.5">
          {options.length > 0 ? (
            options.map((song) => (
              <button
                key={song.id}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  select(song);
                }}
                className="block w-full px-4 py-2 text-left font-serif text-sm text-slate-700 dark:text-slate-300 hover:text-(--tone) truncate transition-colors"
              >
                {song.title}
              </button>
            ))
          ) : (
            <p className="px-4 py-2 text-xs text-slate-400">
              {t("songNotFound")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── 提交表单 ─────────────────────────────────────────────────────────────────

interface SubmitFormState {
  type: RequestType;
  selectedSong: SongOption | null;
  category: string;
  content: string;
  submitting: boolean;
  error: string | null;
  success: boolean;
}

type SubmitFormAction =
  | { type: "SET_TYPE"; payload: RequestType }
  | { type: "SET_SONG"; payload: SongOption | null }
  | { type: "SET_CATEGORY"; payload: string }
  | { type: "SET_CONTENT"; payload: string }
  | { type: "SUBMIT_START" }
  | { type: "SUBMIT_SUCCESS" }
  | { type: "SUBMIT_ERROR"; payload: string }
  | { type: "RESET" };

const initialSubmitFormState: SubmitFormState = {
  type: "song_feedback",
  selectedSong: null,
  category: "",
  content: "",
  submitting: false,
  error: null,
  success: false,
};

function submitFormReducer(
  state: SubmitFormState,
  action: SubmitFormAction,
): SubmitFormState {
  switch (action.type) {
    case "SET_TYPE":
      return { ...state, type: action.payload, error: null };
    case "SET_SONG":
      return { ...state, selectedSong: action.payload };
    case "SET_CATEGORY":
      return { ...state, category: action.payload };
    case "SET_CONTENT":
      return { ...state, content: action.payload };
    case "SUBMIT_START":
      return { ...state, submitting: true, error: null };
    case "SUBMIT_SUCCESS":
      return {
        ...state,
        submitting: false,
        success: true,
        content: "",
        selectedSong: null,
        category: "",
      };
    case "SUBMIT_ERROR":
      return { ...state, submitting: false, error: action.payload };
    case "RESET":
      return initialSubmitFormState;
    default:
      return state;
  }
}

function SubmitForm({ onSubmitted }: { onSubmitted: () => void }) {
  const t = useTranslations("profile.feedback");
  const { user } = useUserContext();
  const csrfToken = useCsrfToken();
  const [state, dispatch] = useReducer(
    submitFormReducer,
    initialSubmitFormState,
  );
  const { type, selectedSong, category, content, submitting, error, success } =
    state;
  const contentRef = useRef<HTMLTextAreaElement>(null);
  useAutoGrow(contentRef, content);

  // 已有权益、已是管理员的，不再列出对应的申请
  const types: RequestType[] = [
    "song_feedback",
    ...(!user?.hasBenefits ? (["benefit_apply"] as const) : []),
    ...(!user?.isAdmin ? (["admin_apply"] as const) : []),
  ];

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!content.trim()) {
      dispatch({ type: "SUBMIT_ERROR", payload: t("errors.empty") });
      return;
    }
    if (type === "song_feedback" && !selectedSong) {
      dispatch({ type: "SUBMIT_ERROR", payload: t("errors.song") });
      return;
    }

    dispatch({ type: "SUBMIT_START" });
    try {
      await apiCreateRequest(
        {
          type,
          song_id: selectedSong?.id ?? null,
          category: category.trim() || null,
          content: content.trim(),
        },
        csrfToken,
      );
      dispatch({ type: "SUBMIT_SUCCESS" });
      onSubmitted();
      setTimeout(() => dispatch({ type: "RESET" }), 1500);
    } catch (err) {
      dispatch({
        type: "SUBMIT_ERROR",
        payload: err instanceof Error ? err.message : t("errors.submit"),
      });
    }
  };

  const length = content.length;

  return (
    <form onSubmit={handleSubmit} className="mt-8 space-y-8">
      <div>
        <span className={FIELD_LABEL_CLASS}>{t("type")}</span>
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
          {types.map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => dispatch({ type: "SET_TYPE", payload: v })}
              aria-pressed={type === v}
              className={cn(
                "text-sm tracking-wider transition-colors",
                type === v
                  ? "text-(--tone)"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200",
              )}
            >
              {t(`types.${v}`)}
            </button>
          ))}
        </div>
      </div>

      {type === "song_feedback" && (
        <div className="grid gap-x-10 gap-y-8 sm:grid-cols-2">
          <div>
            <span className={FIELD_LABEL_CLASS}>{t("song")}</span>
            <div className="mt-2">
              <SongPicker
                value={selectedSong}
                onChange={(song) =>
                  dispatch({ type: "SET_SONG", payload: song })
                }
              />
            </div>
          </div>
          <label className="block">
            <span className={FIELD_LABEL_CLASS}>
              {t("category")}
              <span className="ml-1 tracking-normal text-slate-300 dark:text-slate-600">
                {t("optional")}
              </span>
            </span>
            <input
              type="text"
              maxLength={100}
              value={category}
              onChange={(e) =>
                dispatch({ type: "SET_CATEGORY", payload: e.target.value })
              }
              placeholder={t("categoryPlaceholder")}
              className={cn(FIELD_CLASS, "mt-2")}
            />
          </label>
        </div>
      )}

      <label className="block">
        <span className={FIELD_LABEL_CLASS}>{t(`contentLabel.${type}`)}</span>
        <textarea
          ref={contentRef}
          rows={1}
          maxLength={CONTENT_MAX}
          value={content}
          onChange={(e) =>
            dispatch({ type: "SET_CONTENT", payload: e.target.value })
          }
          placeholder={t(`contentPlaceholder.${type}`)}
          className={cn(TEXTAREA_CLASS, "mt-2")}
        />
      </label>

      <div className="flex items-center gap-5">
        <button
          type="submit"
          disabled={submitting || success || !csrfToken}
          className={PRIMARY_BUTTON_CLASS}
        >
          {submitting && <Loader2 size={12} className="animate-spin" />}
          {success ? t("submitted") : t("submit")}
        </button>
        {error && (
          <span
            role="alert"
            className="text-xs text-rose-500 dark:text-rose-400"
          >
            {error}
          </span>
        )}
        <span className="flex-1" />
        {length >= SHOW_COUNT_FROM && (
          <span className="text-xs tabular-nums text-slate-400">
            {length}/{CONTENT_MAX}
          </span>
        )}
      </div>
    </form>
  );
}

// ─── 提交记录 ─────────────────────────────────────────────────────────────────

function RequestList({
  requests,
  loading,
  onRefresh,
}: {
  requests: UserRequest[];
  loading: boolean;
  onRefresh: () => void;
}) {
  const t = useTranslations("profile.feedback");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (loading && requests.length === 0) {
    return <Loader2 size={20} className="mt-8 animate-spin text-slate-400" />;
  }

  if (requests.length === 0) {
    return (
      <p className="mt-8 font-kaiti text-[15px] text-slate-400 dark:text-slate-500">
        {t("historyEmpty")}
      </p>
    );
  }

  return (
    <>
      <ul className="mt-6 divide-y divide-slate-200/70 dark:divide-slate-800">
        {requests.map((req) => (
          <RequestRow
            key={req.id}
            req={req}
            expanded={expandedId === req.id}
            onToggle={() =>
              setExpandedId((prev) => (prev === req.id ? null : req.id))
            }
          />
        ))}
      </ul>
      <button
        type="button"
        onClick={onRefresh}
        disabled={loading}
        className={cn(
          TEXT_BUTTON_CLASS,
          "mt-6 inline-flex items-center gap-1.5",
        )}
      >
        {loading && <Loader2 size={12} className="animate-spin" />}
        {t("refresh")}
      </button>
    </>
  );
}

function RequestRow({
  req,
  expanded,
  onToggle,
}: {
  req: UserRequest;
  expanded: boolean;
  onToggle: () => void;
}) {
  const t = useTranslations("profile.feedback");
  const locale = useLocale();
  const formatTime = (iso: string) =>
    new Date(iso).toLocaleString(locale, {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });

  return (
    <li className="py-5">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="group w-full text-left"
      >
        <span className="flex items-baseline gap-3 text-xs">
          <span className="tracking-[0.2em] text-slate-400 dark:text-slate-500">
            {t(`types.${req.type}`)}
          </span>
          {req.song_title && (
            <span className="min-w-0 truncate font-serif text-slate-600 dark:text-slate-300">
              {req.song_title}
            </span>
          )}
          <span className="flex-1" />
          <span className={cn("shrink-0", STATUS_CLASS[req.status])}>
            {t(`status.${req.status}`)}
          </span>
        </span>
        <span
          className={cn(
            "mt-2 block font-kaiti text-[15px] leading-[1.85] text-slate-700 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-slate-100 transition-colors wrap-break-word",
            expanded ? "whitespace-pre-wrap" : "line-clamp-2",
          )}
        >
          {req.content}
        </span>
      </button>

      {/* 展开：CSS grid 0fr → 1fr 做高度过渡 */}
      <div
        className={cn(
          "grid transition-[grid-template-rows] duration-300 ease-[cubic-bezier(0.23,1,0.32,1)]",
          expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        <div className="overflow-hidden">
          <dl className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-xs">
            {req.category && (
              <div className="flex gap-2">
                <dt className="text-slate-400 dark:text-slate-500">
                  {t("detail.category")}
                </dt>
                <dd className="text-slate-600 dark:text-slate-300">
                  {req.category}
                </dd>
              </div>
            )}
            <div className="flex gap-2">
              <dt className="text-slate-400 dark:text-slate-500">
                {t("detail.submittedAt")}
              </dt>
              <dd className="tabular-nums text-slate-600 dark:text-slate-300">
                {formatTime(req.created_at)}
              </dd>
            </div>
          </dl>

          {req.reply && (
            <div className="mt-5 border-l border-(--tone)/40 pl-4">
              <p className="text-xs tracking-[0.2em] text-(--tone)">
                {t("detail.reply")}
              </p>
              <p className="mt-1.5 font-kaiti text-[15px] leading-[1.85] text-slate-700 dark:text-slate-300 whitespace-pre-wrap wrap-break-word">
                {req.reply}
              </p>
              {req.replied_at && (
                <p className="mt-1 text-xs tabular-nums text-slate-400 dark:text-slate-500">
                  {formatTime(req.replied_at)}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </li>
  );
}
