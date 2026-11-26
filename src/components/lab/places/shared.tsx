"use client";

import { Link } from "@/i18n/navigation";
import type { Place } from "@/lib/places/types";
import { useTranslations } from "next-intl";

export type PlaceGlyphKind =
  | "mountain"
  | "pavilion"
  | "water"
  | "city"
  | "venue";

/** 按地点本身的地理与文化属性归类，用来画古舆图地标符 */
const GLYPH_BY_ID: Record<number, PlaceGlyphKind> = {
  1: "pavilion", // 文昌阁
  2: "venue", // 鸟巢
  3: "pavilion", // 故宫午门
  4: "pavilion", // 蓬莱阁
  5: "city", // 宝塔镇
  6: "city", // 徐州
  7: "city", // 洛阳
  8: "city", // 西安
  9: "water", // 黄浦江
  10: "city", // 滁州
  11: "city", // 南京
  12: "mountain", // 文赤壁
  13: "city", // 江阳
  14: "pavilion", // 八境台
  15: "pavilion", // 慈云塔
  16: "pavilion", // 郁孤台
  17: "water", // 洞庭湖
  18: "city", // 左公故里
  19: "city", // 乔口镇
  20: "city", // 铜官古镇
  21: "water", // 湘江
  22: "city", // 渔阳墓
  23: "mountain", // 岳麓山
  24: "pavilion", // 杜甫江阁
  25: "pavilion", // 赫曦台
  26: "pavilion", // 定王台
  27: "pavilion", // 自卑亭
  28: "water", // 蘋岛
  29: "pavilion", // 谭嗣同故居
  30: "water", // 沅江
  31: "mountain", // 五强溪古栈道
  32: "mountain", // 瓮子洞
  33: "water", // 清浪乡
  34: "mountain", // 壶头山
  35: "mountain", // 明月山
  36: "pavilion", // 龙兴讲寺
  37: "water", // 武陵桥
  38: "mountain", // 凤凰山
  39: "mountain", // 二酉山
  40: "city", // 杭州
  41: "water", // 一半勾留
  42: "water", // 西湖十景
  43: "mountain", // 长白山
  44: "pavilion", // 布达拉宫
  45: "mountain", // 莫高窟
};

export function glyphOf(placeId: number): PlaceGlyphKind {
  return GLYPH_BY_ID[placeId] ?? "city";
}

/** 一句按空格与句读切开，每个短语一列 */
export function phrases(line: string): string[] {
  return line.split(/[，。、！？\s]+/).filter(Boolean);
}

// ─── 书法水脉算法：Catmull-Rom 样条 + 提按变宽河身 ──────────────────────────────

export interface SampledPoint {
  x: number;
  y: number;
  nx: number;
  ny: number;
  t: number;
}

/** 对控制点做 Catmull-Rom 样条插值，返回平滑曲线点列与法向量 */
export function sampleSpline(
  pts: [number, number][],
  subdivisions = 14,
): SampledPoint[] {
  if (pts.length < 2) return [];
  const raw: [number, number][] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    const steps = subdivisions;
    const start = i === 0 ? 0 : 1;
    for (let s = start; s <= steps; s++) {
      const t = s / steps;
      const t2 = t * t;
      const t3 = t2 * t;
      const x =
        0.5 *
        (2 * p1[0] +
          (-p0[0] + p2[0]) * t +
          (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 +
          (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3);
      const y =
        0.5 *
        (2 * p1[1] +
          (-p0[1] + p2[1]) * t +
          (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 +
          (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3);
      raw.push([x, y]);
    }
  }

  const lens = [0];
  for (let i = 1; i < raw.length; i++) {
    lens.push(
      lens[i - 1] + Math.hypot(raw[i][0] - raw[i - 1][0], raw[i][1] - raw[i - 1][1]),
    );
  }
  const total = lens[lens.length - 1] || 1;

  return raw.map(([x, y], i) => {
    const prev = raw[Math.max(0, i - 1)];
    const next = raw[Math.min(raw.length - 1, i + 1)];
    const dx = next[0] - prev[0];
    const dy = next[1] - prev[1];
    const len = Math.hypot(dx, dy) || 1;
    return {
      x,
      y,
      nx: -dy / len,
      ny: dx / len,
      t: lens[i] / total,
    };
  });
}

/** 中心线 SVG path（用于入场描边或伴行细波） */
export function splineCenterPath(
  pts: [number, number][],
  subdivisions = 12,
  offset = 0,
): string {
  const samples = sampleSpline(pts, subdivisions);
  if (samples.length === 0) return "";
  return samples
    .map((p, i) => {
      const px = p.x + p.nx * offset;
      const py = p.y + p.ny * offset;
      return `${i === 0 ? "M" : "L"} ${px.toFixed(1)} ${py.toFixed(1)}`;
    })
    .join(" ");
}

/**
 * 变宽书法河身多边形：从河口（t=0，宽）溯流而上至源头（t=1，细如游丝）。
 * 加入细微行笔提按波动，告别等宽工程线。
 */
export function brushRiverPath(
  pts: [number, number][],
  mouthWidth: number,
  sourceWidth = 0.5,
  options?: { bothTaper?: boolean; subdivisions?: number; ripple?: number },
): string {
  const samples = sampleSpline(pts, options?.subdivisions ?? 14);
  if (samples.length < 2) return "";
  const left: [number, number][] = [];
  const right: [number, number][] = [];
  const ripple = options?.ripple ?? 0.12;

  for (const p of samples) {
    let profile: number;
    if (options?.bothTaper) {
      profile = Math.sin(p.t * Math.PI);
      profile = 0.15 + 0.85 * Math.pow(Math.max(0, profile), 0.7);
    } else {
      // 河口略张开，向上游渐收
      const estuaryFlare = Math.exp(-p.t * 14) * 0.42;
      profile = Math.pow(1 - p.t, 0.78) + estuaryFlare;
    }
    const organic = 1 + ripple * Math.sin(p.t * 19.3 + 0.7);
    const half =
      Math.max(sourceWidth, mouthWidth * profile * organic) * 0.5;
    left.push([p.x + p.nx * half, p.y + p.ny * half]);
    right.push([p.x - p.nx * half, p.y - p.ny * half]);
  }

  const head = left
    .map(([x, y], i) => `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`)
    .join(" ");
  const tail = right
    .reverse()
    .map(([x, y]) => `L ${x.toFixed(1)} ${y.toFixed(1)}`)
    .join(" ");
  return `${head} ${tail} Z`;
}

/** 生成连绵写意远山的封闭轮廓（底部拉直，用渐变向上淡入纸色） */
export function inkMountainPath(
  ridge: [number, number][],
  baseY: number,
): string {
  if (ridge.length < 2) return "";
  const samples = sampleSpline(ridge, 10);
  const top = samples
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(" ");
  const last = samples[samples.length - 1];
  const first = samples[0];
  return `${top} L ${last.x.toFixed(1)} ${baseY} L ${first.x.toFixed(1)} ${baseY} Z`;
}

// ─── 古舆图地标符（极简 1px 线稿） ───────────────────────────────────────────────

export function PlaceGlyph({
  kind,
  x,
  y,
  active,
  kin,
  scale = 1,
}: {
  kind: PlaceGlyphKind;
  x: number;
  y: number;
  active: boolean;
  kin: boolean;
  scale?: number;
}) {
  const lit = active || kin;
  const stroke = lit ? "var(--seal)" : "var(--ink)";
  const fill = active ? "var(--seal)" : "var(--paper)";

  return (
    <g transform={`translate(${x}, ${y}) scale(${scale})`}>
      {/* 选中时的朱砂水纹涟漪 */}
      {active && (
        <>
          <circle
            r={12}
            fill="none"
            stroke="var(--seal)"
            strokeWidth={0.9}
            opacity={0.35}
          />
          <circle
            r={18}
            fill="none"
            stroke="var(--seal)"
            strokeWidth={0.6}
            strokeDasharray="2 3"
            opacity={0.25}
          />
        </>
      )}

      {kind === "mountain" && (
        <g>
          <path
            d="M -6.5 3.5 L -2.2 -3.2 L 0.4 0.5 L 2.8 -4.5 L 6.8 3.5 Z"
            fill={active ? "var(--seal)" : "var(--paper)"}
            fillOpacity={active ? 0.22 : 0.85}
            stroke={stroke}
            strokeWidth={lit ? 1.45 : 1.15}
            strokeLinejoin="round"
          />
          <line
            x1={-7.5}
            y1={3.5}
            x2={7.5}
            y2={3.5}
            stroke={stroke}
            strokeWidth={0.8}
            opacity={0.6}
          />
        </g>
      )}

      {kind === "pavilion" && (
        <g>
          {/* 飞檐双挑一笔 */}
          <path
            d="M -6.5 -0.8 Q -3 -2.2 0 -4.8 Q 3 -2.2 6.5 -0.8"
            fill="none"
            stroke={stroke}
            strokeWidth={lit ? 1.5 : 1.2}
            strokeLinecap="round"
          />
          <path
            d="M -3.5 -0.5 L -3.5 3.5 M 3.5 -0.5 L 3.5 3.5 M -5 3.5 L 5 3.5"
            fill="none"
            stroke={stroke}
            strokeWidth={lit ? 1.2 : 1}
            strokeLinecap="round"
          />
          {active && <circle cy={1.5} r={1.3} fill="var(--seal)" />}
        </g>
      )}

      {kind === "water" && (
        <g>
          <path
            d="M 0 -4.6 L 4.8 0 L 0 4.6 L -4.8 0 Z"
            fill={active ? "var(--seal)" : "var(--paper)"}
            fillOpacity={active ? 0.2 : 0.9}
            stroke={stroke}
            strokeWidth={lit ? 1.4 : 1.1}
          />
          <circle
            r={1.4}
            fill={lit ? "var(--seal)" : "var(--river)"}
          />
        </g>
      )}

      {kind === "venue" && (
        <g>
          <rect
            x={-4.2}
            y={-4.2}
            width={8.4}
            height={8.4}
            rx={1}
            fill={active ? "var(--seal)" : "var(--paper)"}
            fillOpacity={active ? 0.2 : 0.9}
            stroke={stroke}
            strokeWidth={lit ? 1.4 : 1.1}
          />
          <rect
            x={-1.6}
            y={-1.6}
            width={3.2}
            height={3.2}
            fill={lit ? "var(--seal)" : "var(--ink)"}
          />
        </g>
      )}

      {kind === "city" && (
        <g>
          <circle
            r={active ? 4.4 : 3.6}
            fill={fill}
            stroke={stroke}
            strokeWidth={lit ? 1.5 : 1.15}
          />
          {!active && (
            <circle
              r={1.3}
              fill={kin ? "var(--seal)" : "var(--river)"}
            />
          )}
        </g>
      )}
    </g>
  );
}

// ─── 朱砂小印（落款 / 卷首） ────────────────────────────────────────────────────

export function SealStamp({
  text = "溯洄",
  className = "",
}: {
  text?: string;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={`inline-flex items-center justify-center rounded-[2px] border border-(--seal)/80 bg-(--seal)/10 px-1 py-1.5 font-calligraphy text-[13px] leading-none text-(--seal) [writing-mode:vertical-rl] select-none ${className}`}
    >
      {text}
    </span>
  );
}

// ─── 实验室方案切换（放在 TopBar nav 位，克制书卷风格） ─────────────────────────

export function LabModeNav({
  active,
}: {
  active: "atlas" | "scroll" | "qinglv";
}) {
  const items: {
    key: "atlas" | "scroll" | "qinglv";
    label: string;
    shortLabel: string;
    href: string;
  }[] = [
    { key: "atlas", label: "绢本舆图", shortLabel: "舆图", href: "/lab/places/atlas" },
    { key: "scroll", label: "溯洄横卷", shortLabel: "横卷", href: "/lab/places/scroll" },
    { key: "qinglv", label: "青绿三维", shortLabel: "三维", href: "/lab/places" },
  ];
  return (
    <div className="ml-1.5 flex items-center gap-2 border-l border-current/15 pl-2 text-[11px] tracking-[0.14em] sm:ml-2 sm:gap-3 sm:pl-3 sm:text-xs sm:tracking-[0.22em]">
      {items.map((item) => {
        const isCurrent = item.key === active;
        return (
          <Link
            key={item.key}
            href={item.href}
            aria-current={isCurrent ? "page" : undefined}
            className={
              isCurrent
                ? "shrink-0 font-serif font-semibold text-(--tone)"
                : "shrink-0 text-slate-400 transition-colors hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-200"
            }
          >
            <span className="sm:hidden">{item.shortLabel}</span>
            <span className="hidden sm:inline">{item.label}</span>
          </Link>
        );
      })}
    </div>
  );
}

// ─── 共用词句阅读正文（与主站 /places 交互一致，直链歌曲详情页） ────────────────

export function PlaceReadingBody({
  place,
  siblings,
  onGo,
  compact = false,
}: {
  place: Place;
  siblings: Place[];
  onGo: (id: number) => void;
  compact?: boolean;
}) {
  const t = useTranslations("places");
  const withVerses = place.entries.filter((e) => e.verses.length > 0);

  return (
    <>
      {withVerses.length > 0 && (
        <div
          className={`flex flex-row-reverse justify-end gap-x-7 overflow-x-auto pb-2 thin-scrollbar ${
            compact ? "mb-5 max-h-56" : "mb-7 max-h-[min(28rem,46svh)]"
          }`}
        >
          {withVerses.map((entry) => (
            <div
              key={`${entry.songId}-${entry.relation}`}
              className="flex flex-col flex-wrap-reverse gap-x-3 [writing-mode:vertical-rl]"
            >
              {entry.verses.map((verse) => (
                <Link
                  key={verse.index}
                  href={`/song/${entry.songId}?line=${verse.index}`}
                  className={`block font-kaiti leading-[1.5] tracking-[0.14em] text-(--ink) transition-colors hover:text-(--seal) ${
                    compact ? "text-[1.25rem]" : "text-[1.55rem]"
                  }`}
                >
                  {phrases(verse.text).map((p, i) => (
                    <span key={i} className="block">
                      {p}
                    </span>
                  ))}
                </Link>
              ))}
            </div>
          ))}
        </div>
      )}

      <div className="space-y-2.5 border-t border-(--ink)/10 pt-4">
        {place.entries.map((entry) => (
          <div key={`${entry.songId}-${entry.relation}`}>
            <p className="font-serif text-[15px] text-(--ink)">
              {entry.relation === "venue" && (
                <span className="mr-2 text-[11px] tracking-[0.25em] text-(--ink-muted)">
                  {t("venue")}
                </span>
              )}
              <Link
                href={`/song/${entry.songId}`}
                className="transition-colors hover:text-(--seal)"
              >
                《{entry.title}》
              </Link>
            </p>
            {entry.note && (
              <p className="mt-0.5 font-kaiti text-sm leading-relaxed text-(--ink-muted)">
                {entry.note}
              </p>
            )}
          </div>
        ))}

        {siblings.length > 0 && (
          <p className="pt-2 text-xs leading-loose tracking-[0.22em] text-(--ink-muted)">
            {t("siblings")}
            {siblings.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onGo(s.id);
                }}
                className="ml-2.5 cursor-pointer text-(--seal) transition-opacity hover:underline"
              >
                {s.name}
              </button>
            ))}
          </p>
        )}
      </div>
    </>
  );
}
