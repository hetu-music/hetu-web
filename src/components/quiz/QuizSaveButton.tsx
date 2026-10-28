"use client";

import { addToast } from "@/components/ui/toast";
import { useUserContext } from "@/context/UserContext";
import { useGoToLogin } from "@/hooks/ui/useGoToLogin";
import { Link } from "@/i18n/navigation";
import { apiRequest } from "@/lib/api/request";
import { savedMonth } from "@/lib/quiz/saved-month";
import type { QuizRecordSummary } from "@/lib/quiz/views";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bookmark, BookmarkCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

/** 每人最多保留的记录数，与数据库里的触发器一致 */
const MAX_RECORDS = 5;

interface Props {
  /** 7 位乱码：只有未保存的结果才有保存按钮 */
  slug: string;
  className: string;
  /** 保存成功后传回记录的 id（10 位乱码），结果页就地换成记录的样子 */
  onSaved: (id: string) => void;
}

/**
 * 结果页的保存按钮，放在操作行的最后：满额时的替换提示占满一行，排在按钮下面。
 * 访客点击去登录，回来后仍在这个结果页，由用户再点一次，不自动保存。
 * 这份作答在当前题目版本下存过的，显示「已保存」并链到那条记录
 */
export default function QuizSaveButton({ slug, className, onSaved }: Props) {
  const t = useTranslations("quiz.result");
  const { user, loaded } = useUserContext();
  const goToLogin = useGoToLogin();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);

  const { data, isPending } = useQuery({
    queryKey: ["quiz-records", user?.id ?? null, slug],
    enabled: !!user,
    retry: false,
    queryFn: async (): Promise<{
      records: QuizRecordSummary[];
      savedId: string | null;
    }> => {
      const res = await fetch(`/api/public/quiz-results?slug=${slug}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
  });

  if (!loaded) return null;

  if (!user) {
    return (
      <button type="button" onClick={goToLogin} className={className}>
        <Bookmark size={14} />
        {t("loginToSave")}
      </button>
    );
  }

  if (data?.savedId) {
    return (
      <Link href={`/quiz/result/${data.savedId}`} className={className}>
        <BookmarkCheck size={14} />
        {t("saved")}
      </Link>
    );
  }

  const save = async () => {
    setSaving(true);
    try {
      const { id } = await apiRequest<{ id: string }>(
        "/api/public/quiz-results",
        {
          method: "POST",
          body: { slug },
          fallback: t("saveFailed"),
        },
      );
      void queryClient.invalidateQueries({ queryKey: ["quiz-records"] });
      addToast("success", t("savedToast"));
      // 地址栏换成记录的链接，分享出去的就是保存那一刻的结果。
      // 不走路由跳转：那会重新渲染整页，动画从头再播一遍，像是刷新了。
      // 刚存下的快照与眼前的结果是同一次计算，页面不用重画
      window.history.replaceState(
        null,
        "",
        window.location.pathname.replace(/[^/]+$/, id),
      );
      onSaved(id);
    } catch (e) {
      addToast("error", e instanceof Error ? e.message : t("saveFailed"));
      setSaving(false);
    }
  };

  const oldest =
    data && data.records.length >= MAX_RECORDS ? data.records.at(-1) : null;

  return (
    <>
      <button
        type="button"
        onClick={save}
        disabled={isPending || saving}
        className={className}
      >
        <Bookmark size={14} />
        {saving ? t("saving") : t("save")}
      </button>
      {oldest && (
        <p className="basis-full text-center font-serif text-xs tracking-wider text-slate-400 dark:text-slate-500">
          {t("replaceHint", {
            count: MAX_RECORDS,
            ...savedMonth(oldest.savedAt),
          })}
        </p>
      )}
    </>
  );
}
