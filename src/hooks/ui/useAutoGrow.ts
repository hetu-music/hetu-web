import { type RefObject, useLayoutEffect } from "react";

/** 不支持 field-sizing 的浏览器（Safari）用脚本让输入框随内容长高 */
const supportsFieldSizing = () =>
  typeof CSS !== "undefined" && CSS.supports("field-sizing", "content");

/** value 变化时按内容重设高度；支持 field-sizing 的浏览器什么都不做 */
export function useAutoGrow(
  ref: RefObject<HTMLTextAreaElement | null>,
  value: string,
) {
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || supportsFieldSizing()) return;
    el.style.height = "auto";
    // scrollHeight 不含边框，而高度按 border-box 算
    el.style.height = `${el.scrollHeight + el.offsetHeight - el.clientHeight}px`;
  }, [ref, value]);
}
