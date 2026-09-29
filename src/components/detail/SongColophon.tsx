"use client";

import SectionHeading from "@/components/detail/SectionHeading";
import type { SongDetail } from "@/lib/types";
import type { FolioCredit } from "@/lib/utils/utils-folio";
import { calculateSongInfo } from "@/lib/utils/utils-song";
import { ArrowUpRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo } from "react";

/** 这些角色已在卷首署名里（取自作词、作曲、编曲、演唱字段），参与制作中不再重复 */
const CREDIT_ROLES_SHOWN = new Set([
  "词",
  "作词",
  "填词",
  "曲",
  "作曲",
  "谱曲",
  "词曲",
  "编",
  "编曲",
  "唱",
  "演唱",
  "歌手",
  "原唱",
]);

/**
 * 合写的角色（「作曲/编曲/演唱」「编曲/混音」）拆开来看：
 * 卷首已有的去掉，剩下的保留；全都已有就整行不列。
 */
function productionCredits(credits: FolioCredit[]): FolioCredit[] {
  return credits.flatMap((c) => {
    const rest = c.role
      .split(/[/／、]/)
      .filter((r) => r && !CREDIT_ROLES_SHOWN.has(r));
    return rest.length > 0 ? [{ role: rest.join("/"), names: c.names }] : [];
  });
}

interface SongColophonProps {
  song: SongDetail;
  credits: FolioCredit[];
  /** 署名区里的声明与副题 */
  notices: string[];
}

/** 版记：基本信息、参与制作、收听渠道，排成书籍版权页的样子 */
export default function SongColophon({
  song,
  credits,
  notices,
}: SongColophonProps) {
  const t = useTranslations("song");
  const tCommon = useTranslations("common");
  const tEnum = useTranslations("enums");

  const rows = useMemo(() => {
    // 卷首用主名，版记照录作品上的原署
    const info = calculateSongInfo(
      song.credited ? { ...song, ...song.credited } : song,
      t,
      tCommon,
      tEnum,
    );
    const unknown = tCommon("unknown");
    // 基本信息里的「未知」只是占位，不值得占一行
    return [
      ...info.creativeInfo,
      ...info.basicInfo.filter((row) => row.value && row.value !== unknown),
    ];
  }, [song, t, tCommon, tEnum]);

  const production = productionCredits(credits);

  const links = [
    { href: song.nelink, label: t("actions.netease") },
    { href: song.qmlink, label: t("actions.qqmusic") },
    { href: song.kugolink, label: t("actions.kugou") },
  ].filter((l): l is { href: string; label: string } => !!l.href);

  return (
    <section id="colophon" className="py-16 md:py-20">
      <SectionHeading label={t("folio.sections.colophon")} />

      <div className="mt-12 grid gap-12 lg:grid-cols-[22rem_minmax(0,1fr)] lg:gap-x-16">
        {/* 收听 */}
        <div>
          {links.length > 0 && (
            <>
              <h3 className="text-xs tracking-[0.3em] text-slate-400 dark:text-slate-500 mb-4">
                {t("folio.listen")}
              </h3>
              <ul className="space-y-2.5">
                {links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group inline-flex items-center gap-1 text-sm text-slate-700 dark:text-slate-300 hover:text-(--tone) transition-colors"
                    >
                      {link.label}
                      <ArrowUpRight
                        size={14}
                        className="text-slate-400 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-(--tone)"
                      />
                    </a>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        <div className="min-w-0 space-y-12">
          <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-8 gap-y-6">
            {rows.map((row) => (
              <div key={row.label} className="min-w-0">
                <dt className="text-xs tracking-[0.2em] text-slate-400 dark:text-slate-500">
                  {row.label}
                </dt>
                <dd className="mt-1.5 text-sm text-slate-800 dark:text-slate-200 wrap-break-word">
                  {row.value}
                </dd>
              </div>
            ))}
          </dl>

          {production.length > 0 && (
            <div>
              <h3 className="text-xs tracking-[0.3em] text-slate-400 dark:text-slate-500 mb-4">
                {t("folio.production")}
              </h3>
              <dl className="grid sm:grid-cols-2 gap-x-8 gap-y-2 text-[13px]">
                {production.map((c, i) => (
                  <div key={i} className="flex gap-3 min-w-0">
                    <dt className="text-slate-400 dark:text-slate-500 shrink-0">
                      {c.role}
                    </dt>
                    <dd className="min-w-0 text-slate-600 dark:text-slate-400 wrap-break-word">
                      {c.names}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          )}

          {notices.length > 0 && (
            <div className="space-y-1 text-xs leading-relaxed text-slate-400 dark:text-slate-500">
              {notices.map((notice, i) => (
                <p key={i}>{notice}</p>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
