"use client";

import { Loader2 } from "lucide-react";
import { parseAsStringLiteral, useQueryState } from "nuqs";
import Image from "next/image";
import type React from "react";
import { FormProvider, useWatch } from "react-hook-form";
import SectionHeading from "@/components/detail/SectionHeading";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useUserContext } from "@/context/UserContext";
import { Link } from "@/i18n/navigation";
import type { MusicProviderType } from "@/lib/api/api-auto-complete";
import { songFields } from "@/lib/constants";
import type { SongDetail, SongFormFieldKey } from "@/lib/types";
import { cn } from "@/lib/utils/utils";
import { getCoverUrl, getNmnUrl } from "@/lib/utils/utils-song";
import { PUBLISH_STATUS_LABEL } from "@/lib/utils/utils-song-diff";
import { useTwoStepConfirm } from "@/hooks/ui";
import AdminShell from "../kit/AdminShell";
import { AdminToolbar } from "../kit/parts";
import {
  OUTLINE_BUTTON_CLASS,
  SOLID_BUTTON_CLASS,
  TEXT_BUTTON_CLASS,
  WARN_TEXT_CLASS,
} from "../kit/styles";
import AssetUpload from "./AssetUpload";
import { SearchResultsDialog } from "./SongAdminDialogs";
import SongAudioTab from "./SongAudioTab";
import SongFormField from "./SongFormFields";
import SongEmotionTab from "./SongEmotionTab";
import SongImageryTab from "./SongImageryTab";
import UsageNotesButton from "./UsageNotes";
import { type SongWorkspaceState, useSongWorkspace } from "./useSongWorkspace";
import {
  MISSING_FIELD_LABEL_OVERRIDES,
  MISSING_GROUPS,
  PLATFORM_LINKS,
} from "./types";
import {
  getMissingFields,
  getMissingLinks,
  isFieldEmpty,
  lacksScore,
} from "./utils";

const TABS = ["info", "assets", "imagery", "emotions", "audio"] as const;
type Tab = (typeof TABS)[number];

const TAB_LABEL: Record<Tab, string> = {
  info: "资料",
  assets: "封面与乐谱",
  imagery: "意象",
  emotions: "基调",
  audio: "音频",
};

/** 资料按用途分组，宽字段（多行文字）独占一行 */
const FIELD_GROUPS: { label: string; keys: SongFormFieldKey[] }[] = [
  {
    label: "基本",
    keys: ["title", "album", "date", "length", "type", "genre"],
  },
  {
    label: "署名",
    keys: ["lyricist", "composer", "arranger", "artist", "albumartist"],
  },
  { label: "歌词", keys: ["lyrics_start", "lyrics"] },
  { label: "说明", keys: ["comment", "dispute_note"] },
  { label: "碟片", keys: ["track", "tracktotal", "discnumber", "disctotal"] },
  { label: "链接", keys: ["nelink", "kugolink", "qmlink"] },
];

const FIELD_BY_KEY = new Map(songFields.map((f) => [f.key, f]));

const PROVIDERS: { provider: MusicProviderType; label: string }[] = [
  { provider: "netease", label: "网易云" },
  { provider: "kugou", label: "酷狗" },
];

/**
 * 一首歌的工作台：资料、封面与乐谱、意象、基调、音频都在这里，暂存与发布在吸顶栏右侧。
 * 原先资料在歌曲列表的弹窗里改，意象要去意象管理找这首歌，音频在另一页。
 */
export default function SongWorkspace({
  song: initialSong,
  published,
}: {
  /** null 为新增 */
  song: SongDetail | null;
  published: Record<string, unknown> | null;
}) {
  const ws = useSongWorkspace(initialSong, published);
  const { song } = ws;
  const { user } = useUserContext();
  const [tabParam, setTab] = useQueryState(
    "tab",
    parseAsStringLiteral(TABS).withDefault("info"),
  );

  // 新增时只有资料一栏；音频接口只对超级管理员开放
  const tabs = TABS.filter(
    (t) => (song || t === "info") && (t !== "audio" || user?.isSuper),
  );
  const tab: Tab = tabs.includes(tabParam) ? tabParam : "info";
  const missing = song ? getMissingFields(song) : [];

  return (
    <AdminShell
      section="songs"
      eyebrow={
        <Link href="/admin/songs" className="hover:opacity-75">
          歌曲{song && ` · #${song.id}`}
        </Link>
      }
      title={song?.title ?? "新增歌曲"}
      stats={
        song
          ? [
              {
                label: "状态",
                value: PUBLISH_STATUS_LABEL[ws.publishStatus],
                warn: ws.publishStatus !== "published",
              },
              {
                label: "待完善",
                value: missing.length > 0 ? `缺 ${missing.length} 项` : "无",
                warn: missing.length > 0,
              },
            ]
          : undefined
      }
      actions={
        song &&
        ws.publishStatus !== "unpublished" && (
          <Link
            href={`/song/${song.id}`}
            target="_blank"
            className={TEXT_BUTTON_CLASS}
          >
            看公开页
          </Link>
        )
      }
      pinned={<UsageNotesButton />}
    >
      <FormProvider {...ws.form}>
        <Tabs
          value={tab}
          onValueChange={(t: Tab) => void setTab(t === "info" ? null : t)}
        >
          <AdminToolbar search={<SaveBar ws={ws} />}>
            {tabs.length > 1 && (
              // 页签撑满工具栏的行高，当前项的短线压在工具栏的细线上
              <TabsList
                variant="inline"
                aria-label="工作台栏目"
                className="items-stretch"
              >
                {tabs.map((t) => (
                  <TabsTrigger
                    key={t}
                    value={t}
                    variant="inline"
                    className="flex items-center after:bottom-0"
                  >
                    {TAB_LABEL[t]}
                  </TabsTrigger>
                ))}
              </TabsList>
            )}
          </AdminToolbar>

          {/* 封面、乐谱的选项也是资料表单的字段，两栏共用一个 form */}
          <form id="song-form" onSubmit={ws.save}>
            {/* 资料一直挂着：切到别的栏再回来，没暂存的改动还在 */}
            <TabsContent value="info" variant="inline" keepMounted>
              <InfoTab ws={ws} onOpenAssets={() => void setTab("assets")} />
            </TabsContent>
            {song && (
              <TabsContent value="assets" variant="inline">
                <AssetsTab ws={ws} song={song} />
              </TabsContent>
            )}
          </form>

          {song && (
            <TabsContent value="imagery" variant="inline">
              <SongImageryTab song={song} />
            </TabsContent>
          )}
          {song && (
            <TabsContent value="emotions" variant="inline">
              <SongEmotionTab song={song} />
            </TabsContent>
          )}
          {song && user?.isSuper && (
            <TabsContent value="audio" variant="inline">
              <SongAudioTab songId={song.id} />
            </TabsContent>
          )}
        </Tabs>
      </FormProvider>

      <SearchResultsDialog
        open={ws.autoComplete.showSearchResults}
        results={ws.autoComplete.searchResults}
        onSelect={(r) => void ws.selectSearchResult(r)}
        onClose={ws.autoComplete.closeSearchResults}
      />
    </AdminShell>
  );
}

/** 吸顶栏右侧：状态、暂存、发布 */
function SaveBar({ ws }: { ws: SongWorkspaceState }) {
  const publishConfirm = useTwoStepConfirm();
  const busy = ws.isSaving || ws.isPublishing;
  const nothingToPublish = !ws.isDirty && ws.publishStatus === "published";

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 md:justify-end">
      <span className="text-xs text-slate-400 dark:text-slate-500">
        {ws.isDirty ? (
          <span className={WARN_TEXT_CLASS}>有未暂存的修改</span>
        ) : ws.song ? (
          PUBLISH_STATUS_LABEL[ws.publishStatus]
        ) : (
          "填好后创建，才能上传封面、标注意象"
        )}
      </span>
      {ws.isDirty && ws.song && (
        <button
          type="button"
          onClick={ws.discard}
          disabled={busy}
          className={TEXT_BUTTON_CLASS}
        >
          放弃修改
        </button>
      )}
      <button
        type="submit"
        form="song-form"
        disabled={busy || (!ws.isDirty && Boolean(ws.song))}
        className={ws.song ? OUTLINE_BUTTON_CLASS : SOLID_BUTTON_CLASS}
      >
        {ws.isSaving && <Loader2 size={14} className="animate-spin" />}
        {ws.song ? "暂存" : "创建"}
      </button>
      {ws.song && (
        <button
          type="button"
          onClick={() => {
            if (publishConfirm.request()) void ws.publish();
          }}
          disabled={busy || nothingToPublish}
          className={SOLID_BUTTON_CLASS}
          title="发布后对所有人可见"
        >
          {ws.isPublishing && <Loader2 size={14} className="animate-spin" />}
          {publishConfirm.confirming
            ? ws.isDirty
              ? "暂存并发布"
              : "确认发布"
            : "发布"}
        </button>
      )}
    </div>
  );
}

function FieldGrid({
  keys,
  changed,
}: {
  keys: SongFormFieldKey[];
  changed: Set<SongFormFieldKey>;
}) {
  return (
    <div className="mt-6 grid gap-x-8 gap-y-5 md:grid-cols-2">
      {keys.map((key) => {
        const field = FIELD_BY_KEY.get(key);
        if (!field) return null;
        return (
          <SongFormField
            key={key}
            field={field}
            changed={changed.has(key)}
            className={cn(
              (field.type === "textarea" ||
                field.key === "type" ||
                field.key === "genre") &&
                "md:col-span-2",
            )}
          />
        );
      })}
    </div>
  );
}

/** 表单里放这个字段的那一段，待完善列表点组名时滚过去 */
const sectionIdOf = (key: SongFormFieldKey) => {
  const group = FIELD_GROUPS.find((g) => g.keys.includes(key));
  return group ? `fields-${group.label}` : undefined;
};

function InfoTab({
  ws,
  onOpenAssets,
}: {
  ws: SongWorkspaceState;
  onOpenAssets: () => void;
}) {
  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_16rem] lg:gap-x-16">
      <div className="space-y-12">
        {FIELD_GROUPS.map((group, i) => (
          <section
            key={group.label}
            id={`fields-${group.label}`}
            className="scroll-mt-[calc(var(--nav-h)+5rem)]"
          >
            <SectionHeading label={group.label}>
              {i === 0 && ws.song && (
                <span className="flex items-baseline gap-3">
                  {PROVIDERS.map(({ provider, label }) => (
                    <button
                      key={provider}
                      type="button"
                      onClick={() => void ws.runAutoComplete(provider)}
                      disabled={ws.autoComplete.isAutoCompleting}
                      className={cn(
                        TEXT_BUTTON_CLASS,
                        "inline-flex items-center gap-1",
                      )}
                      title={`按标题从${label}搜索，只填空着的字段`}
                    >
                      {ws.autoComplete.isAutoCompleting &&
                        ws.autoComplete.currentProvider === provider && (
                          <Loader2 size={12} className="animate-spin" />
                        )}
                      从{label}补全
                    </button>
                  ))}
                </span>
              )}
            </SectionHeading>
            <FieldGrid keys={group.keys} changed={ws.changedFields} />
          </section>
        ))}
      </div>

      {ws.song && (
        <aside className="mt-12 space-y-8 text-sm lg:sticky lg:top-[calc(var(--nav-h)+5rem)] lg:mt-0 lg:self-start">
          <MissingList song={ws.song} onOpenAssets={onOpenAssets} />
          <SideList
            title="与线上不同"
            items={[...ws.changedFields].map(
              (key) => FIELD_BY_KEY.get(key)?.label ?? key,
            )}
            empty={
              ws.publishStatus === "unpublished" ? "还没发布过" : "与线上一致"
            }
          />
        </aside>
      )}
    </div>
  );
}

/**
 * 待完善按组列出（与歌曲列表的细分同一套分组），点组名滚到表单里那一段。
 * 乐谱、平台链接不算待完善，各单独一行：乐谱切到「封面与乐谱」，链接滚到表单的「链接」一段。
 * 按暂存版判断：刚填还没暂存的字段要暂存后才从这里消失。
 */
function MissingList({
  song,
  onOpenAssets,
}: {
  song: SongDetail;
  onOpenAssets: () => void;
}) {
  const groups = MISSING_GROUPS.map((group) => {
    const fields = songFields.filter(
      (f) => group.keys.includes(f.key) && isFieldEmpty(song, f),
    );
    return { ...group, fields };
  }).filter((g) => g.fields.length > 0);
  const missingLinks = getMissingLinks(song).map(
    (key) => PLATFORM_LINKS.find((l) => l.key === key)?.label ?? key,
  );

  return (
    <div>
      <h3 className="text-xs tracking-[0.2em] text-slate-400 dark:text-slate-500">
        待完善
      </h3>
      {groups.length === 0 ? (
        <p className="mt-2 font-kaiti text-slate-400">资料都填好了</p>
      ) : (
        <dl className="mt-2 space-y-1.5 leading-relaxed">
          {groups.map((g) => (
            <div key={g.key} className="flex gap-3">
              <dt className="shrink-0">
                <a
                  href={`#${sectionIdOf(g.fields[0].key)}`}
                  className="text-slate-700 transition-colors hover:text-(--tone) dark:text-slate-200"
                >
                  {g.label}
                </a>
              </dt>
              <dd className={WARN_TEXT_CLASS}>
                {g.fields
                  .map((f) => MISSING_FIELD_LABEL_OVERRIDES[f.key] ?? f.label)
                  .join("、")}
              </dd>
            </div>
          ))}
        </dl>
      )}
      {/* 乐谱、链接不算待完善，另起两行，只作提醒 */}
      {(lacksScore(song) || missingLinks.length > 0) && (
        <div className="mt-3 flex flex-col items-start gap-1">
          {missingLinks.length > 0 && (
            <a
              href={`#${sectionIdOf("nelink")}`}
              className={cn(TEXT_BUTTON_CLASS, "tracking-normal")}
            >
              没有{missingLinks.join("、")}链接
            </a>
          )}
          {lacksScore(song) && (
            <button
              type="button"
              onClick={onOpenAssets}
              className={cn(TEXT_BUTTON_CLASS, "tracking-normal")}
            >
              还没有乐谱，去上传
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function SideList({
  title,
  items,
  empty,
}: {
  title: string;
  items: string[];
  empty: string;
}) {
  return (
    <div>
      <h3 className="text-xs tracking-[0.2em] text-slate-400 dark:text-slate-500">
        {title}
      </h3>
      {items.length === 0 ? (
        <p className="mt-2 font-kaiti text-slate-400">{empty}</p>
      ) : (
        <p className="mt-2 leading-relaxed text-slate-600 dark:text-slate-300">
          {items.join("、")}
        </p>
      )}
    </div>
  );
}

function AssetsTab({ ws, song }: { ws: SongWorkspaceState; song: SongDetail }) {
  const cover = FIELD_BY_KEY.get("hascover");
  const score = FIELD_BY_KEY.get("nmn_status");
  // 跟着表单里当前选的封面走，没暂存也算：选了预设就不提示「未上传」
  const hascover = useWatch({ control: ws.form.control, name: "hascover" });
  const coverPreset =
    hascover === true ? undefined : hascover === false ? "初号机" : "白底狐狸";

  return (
    <div className="grid gap-16 md:grid-cols-2">
      <AssetSection label="封面">
        {cover && (
          <SongFormField
            field={cover}
            changed={ws.changedFields.has("hascover")}
          />
        )}
        <Preview
          src={getCoverUrl({ id: song.id, hascover })}
          alt={`${song.title} 封面`}
          square
        />
        <AssetUpload kind="cover" songId={song.id} preset={coverPreset} />
        <p className="text-xs text-slate-400">
          上传定制封面后，记得把封面设为「定制封面」并暂存
        </p>
      </AssetSection>
      <AssetSection label="乐谱">
        {score && (
          <SongFormField
            field={score}
            changed={ws.changedFields.has("nmn_status")}
          />
        )}
        {song.nmn_status && (
          <Preview src={getNmnUrl(song)} alt={`${song.title} 乐谱`} />
        )}
        <AssetUpload kind="score" songId={song.id} />
      </AssetSection>
    </div>
  );
}

function AssetSection({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <SectionHeading label={label} />
      <div className="mt-6 space-y-5">{children}</div>
    </section>
  );
}

function Preview({
  src,
  alt,
  square = false,
}: {
  src: string;
  alt: string;
  square?: boolean;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-md bg-slate-100 ring-1 ring-slate-900/5 dark:bg-slate-900 dark:ring-white/10",
        square ? "aspect-square w-48" : "aspect-3/4 w-full max-w-sm",
      )}
    >
      <Image
        src={src}
        alt={alt}
        fill
        sizes="384px"
        className="object-contain"
      />
    </div>
  );
}
