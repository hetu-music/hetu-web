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
 * 主动加载一段文字要用到的字体，全站都走这里。字默认等出现在页面上才下载，
 * 只有等不及的地方才用：翻页前下好下一屏的字、Canvas 作画、Safari 的着重号。
 *
 * stack 是整条字体栈，可以是 CSS 变量的值或计算样式的 font-family。须按字体逐个加载：
 * 整串字体一起传时，Safari 见前面的字体声称覆盖就不再往后加载。
 *
 * 所有字体都结束才返回；有字体失败或超过 timeoutMs 时 reject，不在乎结果的调用方自己 catch。
 * 自切分片的声明表还没载入时加载会落空，要先等 ensureSplitFontStyles
 */
export async function loadFontStack(
  stack: string,
  text: string,
  {
    weight,
    size = "16px",
    timeoutMs,
  }: { weight?: string; size?: string; timeoutMs?: number } = {},
): Promise<void> {
  if (typeof document.fonts?.load !== "function") return;
  const families = stack
    .split(",")
    .map((family) => family.trim().replace(/^["']|["']$/g, ""))
    .filter(Boolean);
  // async 包一层：写法不被接受时 load 是同步抛错，也要算作这一个字体失败
  const loads = Promise.allSettled(
    families.map(async (family) =>
      document.fonts.load(
        [weight, size, `"${family}"`].filter(Boolean).join(" "),
        text,
      ),
    ),
  ).then((results) => {
    const failed = results.find((r) => r.status === "rejected");
    if (failed) throw failed.reason;
  });
  if (timeoutMs === undefined) return loads;

  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("字体加载超时")), timeoutMs);
  });
  return Promise.race([loads, timeout]).finally(() => clearTimeout(timer));
}

/**
 * 提前下载几段文字的字体，免得字第一次出现时跳一下。失败也不要紧，到时候照常下载。
 * cssVar 是 globals.css 里的字体栈（如 --font-serif）
 */
export async function preloadFontText(
  entries: { cssVar: string; text: string }[],
): Promise<void> {
  if (typeof document.fonts?.load !== "function") return;
  await ensureSplitFontStyles();
  const style = getComputedStyle(document.documentElement);
  await Promise.all(
    entries.map(({ cssVar, text }) =>
      loadFontStack(style.getPropertyValue(cssVar), text).catch(
        () => undefined,
      ),
    ),
  );
}
