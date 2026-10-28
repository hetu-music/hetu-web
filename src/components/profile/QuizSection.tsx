"use client";

import ProfileSectionHeading, {
  GroupHeading,
} from "@/components/profile/ProfileSectionHeading";
import { bumpNavDepth } from "@/components/profile/profile-ui";
import { TEXT_BUTTON_CLASS } from "@/components/shared/text-button";
import { addToast } from "@/components/ui/toast";
import { useUserContext } from "@/context/UserContext";
import { useTwoStepConfirm } from "@/hooks/ui";
import { Link } from "@/i18n/navigation";
import { apiRequest } from "@/lib/api/request";
import { savedMonth } from "@/lib/quiz/saved-month";
import type { QuizRecordSummary, QuizResultView } from "@/lib/quiz/views";
import { cn } from "@/lib/utils/utils";
import { getCoverUrl } from "@/lib/utils/utils-song";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import Image from "next/image";
import { useState } from "react";

/** 倾向条的满格对应的 z 分数，与结果页一致 */
const Z_RANGE = 2.5;

type QuizRecords = {
  records: QuizRecordSummary[];
  latest: QuizResultView | null;
};

/** 我的气韵：保存过的寻曲结果。最近一条展开，往次各占一行 */
export default function QuizSection() {
  const t = useTranslations("profile");
  const { user } = useUserContext();
  const queryClient = useQueryClient();

  const { data, isPending } = useQuery({
    queryKey: ["quiz-records", user?.id ?? null, "latest"],
    enabled: !!user,
    queryFn: async (): Promise<QuizRecords> => {
      const res = await fetch("/api/public/quiz-results?latest=1");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
  });

  const remove = async (id: string) => {
    try {
      await apiRequest("/api/public/quiz-results", {
        method: "DELETE",
        body: { id },
        fallback: t("quiz.deleteFailed"),
      });
    } catch (e) {
      addToast(
        "error",
        e instanceof Error ? e.message : t("quiz.deleteFailed"),
      );
      throw e;
    }
    // 结果页保存按钮的「已保存」也一并作废
    await queryClient.invalidateQueries({ queryKey: ["quiz-records"] });
  };

  const records = data?.records ?? [];
  const latest = data?.latest ?? null;
  // 最近一条渲染不出来时（如快照里的维度已删），也列进往次，不让它消失
  const past = latest ? records.slice(1) : records;

  return (
    <section>
      <ProfileSectionHeading label={t("tabs.quiz")}>
        <Link href="/quiz" className={TEXT_BUTTON_CLASS}>
          {t("quiz.retry")}
        </Link>
      </ProfileSectionHeading>

      {isPending ? (
        <Loader2 size={20} className="mt-12 animate-spin text-slate-400" />
      ) : records.length === 0 ? (
        <div className="mt-12 font-kaiti text-[15px] leading-[1.85] text-slate-400 dark:text-slate-500">
          <p>{t("quiz.empty")}</p>
          <p>{t("quiz.emptyHint")}</p>
        </div>
      ) : (
        <>
          {latest && (
            <LatestRecord
              record={records[0]}
              result={latest}
              onDelete={() => remove(records[0].id)}
            />
          )}
          {past.length > 0 && (
            <div className={latest ? "mt-16" : "mt-8 lg:mt-12"}>
              <GroupHeading label={t("quiz.past")} />
              <ul className="mt-6 space-y-5">
                {past.map((record) => (
                  <PastRow
                    key={record.id}
                    record={record}
                    onDelete={() => remove(record.id)}
                  />
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </section>
  );
}

function LatestRecord({
  record,
  result,
  onDelete,
}: {
  record: QuizRecordSummary;
  result: QuizResultView;
  onDelete: () => Promise<void>;
}) {
  const t = useTranslations("profile.quiz");
  const href = `/quiz/result/${record.id}`;

  return (
    <article className="mt-8 lg:mt-12">
      <Link
        href={href}
        className="font-calligraphy text-5xl text-slate-900 dark:text-white hover:text-(--tone) dark:hover:text-(--tone) transition-colors"
      >
        {result.persona.motto}
      </Link>
      {result.secondary && (
        <p className="mt-4 font-serif text-xs tracking-[0.2em] text-(--tone)">
          {t("secondary", { motto: result.secondary.motto })}
        </p>
      )}
      <p className="mt-6 max-w-xl font-kaiti text-[15px] leading-[1.85] text-slate-600 dark:text-slate-400">
        {result.persona.description}
      </p>

      <div className="mt-10 grid gap-10 sm:grid-cols-[1fr_1.4fr]">
        {result.imagery.length > 0 && (
          <div>
            <h3 className="font-serif text-xs tracking-[0.3em] text-slate-400 dark:text-slate-500">
              {t("imagery")}
            </h3>
            <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2">
              {result.imagery.map((name) => (
                <span
                  key={name}
                  className="font-calligraphy text-2xl text-slate-800 dark:text-slate-100"
                >
                  {name}
                </span>
              ))}
            </div>
          </div>
        )}
        <div className={cn(result.imagery.length === 0 && "sm:col-span-2")}>
          <h3 className="font-serif text-xs tracking-[0.3em] text-slate-400 dark:text-slate-500">
            {t("profile")}
          </h3>
          <ul className="mt-4 space-y-2">
            {result.profile.map((p) => {
              const ratio = Math.min(Math.abs(p.z) / Z_RANGE, 1) * 50;
              return (
                <li key={p.key} className="flex items-center gap-4">
                  <span className="w-10 shrink-0 font-serif text-xs text-slate-500 dark:text-slate-400">
                    {p.label}
                  </span>
                  <span className="relative h-1 flex-1 rounded-full bg-slate-100 dark:bg-slate-800/70">
                    <span
                      className={cn(
                        "absolute inset-y-0 rounded-full",
                        p.z >= 0
                          ? "left-1/2 bg-(--tone)"
                          : "right-1/2 bg-slate-300 dark:bg-slate-600",
                      )}
                      style={{ width: `${ratio}%` }}
                    />
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      {result.matches.length > 0 && (
        <div className="mt-10">
          <h3 className="font-serif text-xs tracking-[0.3em] text-slate-400 dark:text-slate-500">
            {t("matches")}
          </h3>
          <ol className="mt-6 space-y-7">
            {result.matches.map(({ song, percent, reasons, lines }) => (
              <li
                key={song.id}
                className="group flex items-start gap-4 sm:gap-5"
              >
                <Link
                  href={`/song/${song.id}`}
                  onClick={bumpNavDepth}
                  tabIndex={-1}
                  aria-hidden
                  className="shrink-0 size-16 sm:size-20 overflow-hidden rounded-md bg-slate-100 dark:bg-slate-800 ring-1 ring-slate-900/5 dark:ring-white/10"
                >
                  <Image
                    src={getCoverUrl(song)}
                    alt=""
                    width={80}
                    height={80}
                    className="w-full h-full object-cover grayscale-35 transition duration-700 group-hover:grayscale-0 group-hover:scale-[1.04]"
                  />
                </Link>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-4">
                    <Link
                      href={`/song/${song.id}`}
                      onClick={bumpNavDepth}
                      className="min-w-0 flex-1 truncate font-serif text-base text-slate-900 dark:text-slate-100 hover:text-(--tone) transition-colors"
                    >
                      {song.title}
                    </Link>
                    <span className="shrink-0 font-serif text-sm tabular-nums text-slate-400 dark:text-slate-500">
                      {percent}%
                    </span>
                  </div>
                  {reasons.length > 0 && (
                    <p className="mt-1 font-serif text-xs tracking-wider text-slate-500 dark:text-slate-400">
                      {t("reasons", { reasons: reasons.join(" · ") })}
                    </p>
                  )}
                  {lines.length > 0 && (
                    <div className="mt-2.5 space-y-1 border-l-2 border-(--tone)/30 pl-3">
                      {lines.map((line) => (
                        <p
                          key={line}
                          className="font-kaiti text-[15px] leading-relaxed text-slate-600 dark:text-slate-300"
                        >
                          {line}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* 日期与删除排在整条结果之后，与往次各行的写法一致 */}
      <div className="mt-8 flex items-baseline justify-end gap-4">
        <span className="text-xs tracking-wider text-slate-400 dark:text-slate-500">
          {t("savedAt", savedMonth(record.savedAt))}
        </span>
        <DeleteButton onDelete={onDelete} />
      </div>
    </article>
  );
}

function PastRow({
  record,
  onDelete,
}: {
  record: QuizRecordSummary;
  onDelete: () => Promise<void>;
}) {
  const t = useTranslations("profile.quiz");

  return (
    <li className="flex items-baseline gap-4">
      <Link
        href={`/quiz/result/${record.id}`}
        className="group flex min-w-0 flex-1 items-baseline gap-3"
      >
        <span className="shrink-0 font-serif text-base text-slate-900 dark:text-slate-100 group-hover:text-(--tone) transition-colors">
          {record.persona.motto}
        </span>
        {record.secondary && (
          <span className="truncate font-serif text-xs tracking-wider text-slate-400 dark:text-slate-500">
            {t("secondary", { motto: record.secondary.motto })}
          </span>
        )}
      </Link>
      <span className="shrink-0 text-xs tracking-wider text-slate-400 dark:text-slate-500">
        {t("savedAt", savedMonth(record.savedAt))}
      </span>
      <DeleteButton onDelete={onDelete} />
    </li>
  );
}

/** 两步确认的删除：第一下变成「确认删除」，三秒内再点才删 */
function DeleteButton({ onDelete }: { onDelete: () => Promise<void> }) {
  const t = useTranslations("profile.quiz");
  const del = useTwoStepConfirm();
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!del.request()) return;
    setDeleting(true);
    try {
      await onDelete();
    } catch {
      setDeleting(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleDelete}
      disabled={deleting}
      className={cn(
        TEXT_BUTTON_CLASS,
        "shrink-0",
        del.confirming
          ? "text-rose-500 dark:text-rose-400"
          : "hover:text-rose-500 dark:hover:text-rose-400",
      )}
    >
      {del.confirming ? t("confirmDelete") : t("delete")}
    </button>
  );
}
