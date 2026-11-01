"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useUserContext } from "@/context/UserContext";
import {
  apiCreateCollation,
  apiDeleteCollation,
  apiGetCollations,
  apiUpdateCollation,
} from "@/lib/api/client-api";
import type { CollationKind, SongCollation } from "@/lib/types";
import { cn } from "@/lib/utils/utils";
import {
  COLLATION_BODY_MAX,
  COLLATION_KINDS,
  COLLATION_QUOTE_MAX,
  type CollationPayload,
  collationInputSchema,
  resolveCollations,
  willSignAsReviser,
} from "@/lib/utils/utils-collations";
import {
  type AnchorContext,
  anchorForSlot,
  lyricsSlot,
} from "@/lib/utils/utils-comments";
import { buildFolio } from "@/lib/utils/utils-folio";
import {
  ConfirmButton,
  EmptyState,
  ErrorState,
  LoadingState,
} from "../kit/parts";
import {
  INPUT_CLASS,
  LABEL_CLASS,
  META_CLASS,
  OUTLINE_BUTTON_CLASS,
  PANEL_CLASS,
  SOLID_BUTTON_CLASS,
  TAG_CLASS,
  TEXT_BUTTON_CLASS,
  WARN_TEXT_CLASS,
  optionClass,
} from "../kit/styles";
import { notify, notifyError } from "../kit/toast";

/** 与前台文案 song.folio.collations / supplements 的 kinds 一致；后台只有简体 */
export const KIND_LABEL: Record<SongCollation["kind"], string> = {
  slip: "口误",
  sung: "异唱",
  version: "异本",
  note: "附记",
  release: "版本",
  draft: "旧稿",
};

const KIND_HINT: Record<CollationKind, string> = {
  slip: "歌词没错，歌手唱错了",
  sung: "唱的与歌词稿不同，说不清谁对",
  version: "专辑版、现场版等不同版本唱得不一样",
  note: "以上都不算的补充说明",
};

/** 校记与补遗同一个接口，两个标签页共用这份缓存 */
export const collationsKey = (songId: number) =>
  ["admin", "collations", songId] as const;

/** 正在编辑的一条：id 为 null 是新写；line 是要挂到的那一句 */
type Editing = { id: number | null; line: number };

/**
 * 一首歌的校记：整首歌词逐句列出，点哪一句就在句下就地写。
 * 行的切分与详情页同一套（buildFolio），存下的原句才对得上前台那一行。
 * 歌词改过、原句找不回的校记列在最前，可以删掉，或改挂到新的一句。
 */
export default function SongCollationTab({
  song,
}: {
  song: {
    id: number;
    title: string;
    lyrics?: string | null;
    lyrics_start?: string | null;
  };
}) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: collationsKey(song.id),
    queryFn: () => apiGetCollations(song.id),
  });
  const [editing, setEditing] = useState<Editing | null>(null);
  // 改挂原句已找不回的校记：先选它，再点要挂到的那一句
  const [relinking, setRelinking] = useState<SongCollation | null>(null);

  const ctx = useMemo<AnchorContext>(
    () => ({
      lines: buildFolio(song.lyrics, {
        title: song.title,
        lyricsStart: song.lyrics_start,
      }).lines,
      paragraphs: [],
    }),
    [song.lyrics, song.title, song.lyrics_start],
  );
  // 同一接口也带着补遗，这里只要挂在歌词上的
  const collations = useMemo(
    () => (query.data?.collations ?? []).filter((c) => c.anchor === "lyrics"),
    [query.data],
  );
  const { byLine, orphans } = useMemo(() => {
    const { entries, byLine } = resolveCollations(collations, ctx);
    return {
      byLine,
      orphans: entries.filter((e) => e.line === null).map((e) => e.collation),
    };
  }, [collations, ctx]);

  if (query.isError) {
    return (
      <ErrorState
        message={query.error.message}
        onRetry={() => void query.refetch()}
      />
    );
  }
  if (query.isPending) return <LoadingState text="加载校记…" />;
  if (ctx.lines.length === 0) {
    return <EmptyState>这首歌还没有歌词，先在「资料」里补上</EmptyState>;
  }

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: collationsKey(song.id) });
  const byId = new Map(collations.map((c) => [c.id, c]));
  const editingCollation =
    editing && editing.id !== null ? (byId.get(editing.id) ?? null) : null;

  const pickLine = (line: number) => {
    if (relinking) {
      setEditing({ id: relinking.id, line });
      setRelinking(null);
    } else {
      setEditing({ id: null, line });
    }
  };

  return (
    <div className="space-y-6">
      <p className={META_CLASS}>
        点一句歌词，在句下写校记。署名为你的用户名，在详情页用小字写在所校那一句下面。
        歌词按官方歌词稿，实际唱的写在校记里。
      </p>

      {orphans.length > 0 && (
        <section className={cn(PANEL_CLASS, "space-y-4 px-5 py-4")}>
          <p className={`text-sm ${WARN_TEXT_CLASS}`}>
            歌词改过，下面 {orphans.length} 条找不到原句：删掉，或改挂到新的一句
          </p>
          {orphans.map((c) => (
            <CollationItem
              key={c.id}
              collation={c}
              quoteLine={c.anchorQuote}
              onEdit={() => setRelinking(relinking?.id === c.id ? null : c)}
              editLabel={relinking?.id === c.id ? "取消改挂" : "改挂"}
              onDeleted={refresh}
            />
          ))}
        </section>
      )}

      {relinking && (
        <p className={`text-sm ${WARN_TEXT_CLASS}`}>点要挂到的那一句</p>
      )}

      <section className={cn(PANEL_CLASS, "px-5 py-4")}>
        <p className={LABEL_CLASS}>歌词</p>
        <ol className="mt-3">
          {ctx.lines.map((line, i) => {
            const list = byLine.get(i) ?? [];
            const editingHere = editing !== null && editing.line === i;
            return (
              <li key={i} className={cn(line.stanzaStart && i > 0 && "mt-4")}>
                {/* 整行可点：手机上没有悬停，只靠悬停才露出的按钮点不到。
                    桌面悬停时右侧露出提示，手机上按下时整行变底色作反馈 */}
                <button
                  type="button"
                  onClick={() => pickLine(i)}
                  disabled={editingHere}
                  className="group flex w-full items-baseline gap-3 rounded px-2 -mx-2 py-0.5 text-left hover:bg-slate-100/60 active:bg-slate-100 dark:hover:bg-slate-900/60 dark:active:bg-slate-900 disabled:pointer-events-none"
                >
                  <span className="min-w-0 flex-1 text-sm leading-relaxed text-slate-700 dark:text-slate-200">
                    {line.text}
                  </span>
                  {!editingHere && (
                    <span
                      className={cn(
                        TEXT_BUTTON_CLASS,
                        "shrink-0 group-hover:text-slate-700 dark:group-hover:text-slate-200",
                        !relinking &&
                          "opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100",
                      )}
                    >
                      {relinking ? "挂到这一句" : "写校记"}
                    </span>
                  )}
                </button>
                {list.length > 0 && (
                  <div className="mt-1 mb-3 ml-4 space-y-3 border-l border-slate-200 dark:border-slate-800 pl-4">
                    {list.map((c) =>
                      editing?.id === c.id ? null : (
                        <CollationItem
                          key={c.id}
                          collation={c}
                          onEdit={() => setEditing({ id: c.id, line: i })}
                          onDeleted={refresh}
                        />
                      ),
                    )}
                  </div>
                )}
                {editing && editingHere && (
                  <CollationForm
                    // 换一条编辑时重新取初值
                    key={editing.id ?? "new"}
                    songId={song.id}
                    lineText={line.text}
                    initial={editingCollation}
                    anchor={anchorForSlot(lyricsSlot(i), ctx)}
                    onDone={async (saved) => {
                      if (saved) await refresh();
                      setEditing(null);
                    }}
                  />
                )}
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}

/** 后台列出全部订者，不缩写 */
function signature(c: SongCollation) {
  const revisers = c.revisers.length ? ` · ${c.revisers.join("、")} 订` : "";
  return `${c.collator || "佚名"} 校${revisers}`;
}

function CollationItem({
  collation: c,
  quoteLine,
  onEdit,
  editLabel = "修改",
  onDeleted,
}: {
  collation: SongCollation;
  /** 原句已找不回时，显示当时校的那一句 */
  quoteLine?: string | null;
  onEdit: () => void;
  editLabel?: string;
  onDeleted: () => Promise<unknown>;
}) {
  const [deleting, setDeleting] = useState(false);
  const remove = async () => {
    setDeleting(true);
    try {
      await apiDeleteCollation(c.id);
      await onDeleted();
      notify({ type: "success", text: "校记已删除" });
    } catch (error) {
      notifyError(error, "删除校记失败");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-1 text-sm">
      {quoteLine && (
        <p className="text-slate-500 dark:text-slate-400">「{quoteLine}」</p>
      )}
      <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-slate-700 dark:text-slate-200">
        <span className={TAG_CLASS}>{KIND_LABEL[c.kind]}</span>
        {c.quote && c.sung && (
          <span>
            「{c.quote}」唱作「{c.sung}」。
          </span>
        )}
        {c.body && <span className="min-w-0 wrap-break-word">{c.body}</span>}
      </p>
      <p className="flex items-baseline gap-3">
        <span className={META_CLASS}>{signature(c)}</span>
        <button type="button" onClick={onEdit} className={TEXT_BUTTON_CLASS}>
          {editLabel}
        </button>
        <ConfirmButton onConfirm={() => void remove()} busy={deleting} />
      </p>
    </div>
  );
}

function CollationForm({
  songId,
  lineText,
  initial,
  anchor,
  onDone,
}: {
  songId: number;
  lineText: string;
  /** null 为新写 */
  initial: SongCollation | null;
  anchor: ReturnType<typeof anchorForSlot>;
  onDone: (saved: boolean) => Promise<void>;
}) {
  const { user } = useUserContext();
  const [kind, setKind] = useState<CollationKind>(
    (initial?.kind as CollationKind | undefined) ?? "slip",
  );
  const [quote, setQuote] = useState(initial?.quote ?? "");
  const [sung, setSung] = useState(initial?.sung ?? "");
  const [body, setBody] = useState(initial?.body ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // 原文要能在这一句里找到；找不到只提醒，不拦（可能是想标整句以外的写法）
  const quoteMissing = quote.trim() !== "" && !lineText.includes(quote.trim());

  const save = async () => {
    const payload: CollationPayload = {
      kind,
      anchor_index: anchor.anchorIndex ?? 0,
      anchor_time: anchor.anchorTime,
      anchor_quote: anchor.anchorQuote ?? lineText,
      quote,
      sung,
      body,
    };
    const parsed = collationInputSchema.safeParse(payload);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "内容有误");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      if (initial) await apiUpdateCollation(initial.id, payload);
      else await apiCreateCollation(songId, payload);
      notify({ type: "success", text: "校记已保存" });
      await onDone(true);
    } catch (e) {
      notifyError(e, "保存校记失败");
      setSaving(false);
    }
  };

  return (
    <div className="mt-2 mb-4 ml-4 space-y-4 border-l-2 border-(--tone) pl-4">
      <div>
        <p className={LABEL_CLASS}>类型</p>
        <div className="mt-1 flex flex-wrap gap-x-5">
          {COLLATION_KINDS.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setKind(k)}
              aria-pressed={kind === k}
              title={KIND_HINT[k]}
              className={optionClass(kind === k)}
            >
              {KIND_LABEL[k]}
            </button>
          ))}
        </div>
        <p className={cn(META_CLASS, "mt-1")}>{KIND_HINT[kind]}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block space-y-1">
          <span className={LABEL_CLASS}>原文（句中的哪几个字，可不填）</span>
          <input
            value={quote}
            onChange={(e) => setQuote(e.target.value)}
            maxLength={COLLATION_QUOTE_MAX}
            className={INPUT_CLASS}
          />
          {quoteMissing && (
            <span className={`block text-xs ${WARN_TEXT_CLASS}`}>
              这一句里没有这几个字
            </span>
          )}
        </label>
        <label className="block space-y-1">
          <span className={LABEL_CLASS}>实唱（可不填）</span>
          <input
            value={sung}
            onChange={(e) => setSung(e.target.value)}
            maxLength={COLLATION_QUOTE_MAX}
            className={INPUT_CLASS}
          />
        </label>
      </div>

      <label className="block space-y-1">
        <span className={LABEL_CLASS}>说明</span>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={COLLATION_BODY_MAX}
          rows={2}
          placeholder="如：现场版此句唱作……；或补充出处"
          className={cn(INPUT_CLASS, "field-sizing-content min-h-16")}
        />
      </label>

      <div className="flex flex-wrap items-center justify-end gap-3">
        <span className={cn(META_CLASS, "mr-auto")}>
          {initial
            ? `${signature(initial)}${willSignAsReviser(initial, user?.name) ? "，保存后署你为订者" : ""}`
            : `署名：${user?.name ?? ""} 校`}
        </span>
        {error && <span className="text-xs text-rose-500">{error}</span>}
        <button
          type="button"
          onClick={() => void onDone(false)}
          disabled={saving}
          className={OUTLINE_BUTTON_CLASS}
        >
          取消
        </button>
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving}
          className={SOLID_BUTTON_CLASS}
        >
          {saving ? "保存中…" : "保存"}
        </button>
      </div>
    </div>
  );
}
