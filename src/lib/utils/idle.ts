/**
 * 页面空闲时执行，返回取消函数。Safari 没有 requestIdleCallback，退回 fallbackMs 后的定时器。
 * timeout：最晚等这么久，页面一直忙也照样执行（requestIdleCallback 的同名选项）。
 */
export function whenIdle(
  run: () => void,
  {
    timeout,
    fallbackMs = 1500,
  }: { timeout?: number; fallbackMs?: number } = {},
): () => void {
  if (typeof window.requestIdleCallback === "function") {
    const id = window.requestIdleCallback(
      run,
      timeout === undefined ? undefined : { timeout },
    );
    return () => window.cancelIdleCallback(id);
  }
  const id = window.setTimeout(run, fallbackMs);
  return () => window.clearTimeout(id);
}
