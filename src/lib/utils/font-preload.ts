import { SPLIT_FONT_STYLESHEETS } from "@/lib/split-fonts";

let stylesReady: Promise<void> | null = null;

/**
 * 挂上分片字体的 @font-face 表（见 lib/split-fonts），等它们载入完。重复调用只挂一次。
 * 表没载入之前浏览器不认识这些字体，document.fonts.load 会直接落空
 */
export function ensureSplitFontStyles(): Promise<void> {
  if (stylesReady) return stylesReady;
  stylesReady = Promise.all(
    SPLIT_FONT_STYLESHEETS.map((href) => {
      let link = document.querySelector<HTMLLinkElement>(
        `link[rel="stylesheet"][href="${href}"]`,
      );
      if (link?.sheet) return undefined;
      if (!link) {
        link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = href;
        document.head.appendChild(link);
      }
      const el = link;
      return new Promise<void>((resolve) => {
        el.addEventListener("load", () => resolve(), { once: true });
        el.addEventListener("error", () => resolve(), { once: true });
      });
    }),
  ).then(() => undefined);
  return stylesReady;
}

/**
 * 提前下载一段文字要用到的字体分片。中文字体都按 unicode-range 切了片，
 * 字第一次出现在屏幕上才去下载，在那之前先用备用字体，就会跳一下。
 *
 * cssVar 是 globals.css 里的字体栈（如 --font-serif）。须按字体逐个加载：
 * 整串字体一起传时，Safari 见前面的字体声称覆盖就不再往后加载（同 LyricsFolio）
 */
export async function preloadFontText(
  entries: { cssVar: string; text: string }[],
): Promise<void> {
  if (typeof document.fonts?.load !== "function") return;
  await ensureSplitFontStyles();
  const style = getComputedStyle(document.documentElement);
  await Promise.all(
    entries.flatMap(({ cssVar, text }) =>
      style
        .getPropertyValue(cssVar)
        .split(",")
        .map((family) => family.trim().replace(/^["']|["']$/g, ""))
        .filter(Boolean)
        .map((family) =>
          document.fonts.load(`16px "${family}"`, text).catch(() => []),
        ),
    ),
  );
}
