/**
 * 后台写了编校数据（意象、基调、校记、补遗）的通知。
 *
 * 这些写入落在歌的草稿上（没有就开一份），歌曲工作台据此把状态改成「有未发布的改动」，
 * 发布按钮随之可用。只在浏览器里有效；服务端渲染时什么也不做。
 */
const target = typeof window === "undefined" ? null : new EventTarget();

export function notifyEditorialWrite(): void {
  target?.dispatchEvent(new Event("write"));
}

export function onEditorialWrite(listener: () => void): () => void {
  target?.addEventListener("write", listener);
  return () => target?.removeEventListener("write", listener);
}

/** 写成功后发通知，原样返回结果 */
export async function editorialWrite<T>(request: Promise<T>): Promise<T> {
  const result = await request;
  notifyEditorialWrite();
  return result;
}
