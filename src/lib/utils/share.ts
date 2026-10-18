/**
 * 分享当前页：能调起系统分享就用系统分享，否则退回复制链接。
 * 歌曲页、曲库、测验结果页原先各写一遍，提示方式由调用方按结果决定。
 */

export type ShareOutcome = "shared" | "copied" | "cancelled" | "failed";

/** 复制当前页地址；非安全上下文等拿不到剪贴板时返回 failed */
export async function copyPageLink(): Promise<"copied" | "failed"> {
  try {
    await navigator.clipboard.writeText(window.location.href);
    return "copied";
  } catch {
    return "failed";
  }
}

export async function sharePage(data: {
  title: string;
  text?: string;
}): Promise<ShareOutcome> {
  if (!navigator.share) return copyPageLink();
  try {
    await navigator.share({ ...data, url: window.location.href });
    return "shared";
  } catch {
    // 用户关掉分享面板也会走到这里，不当作出错
    return "cancelled";
  }
}
