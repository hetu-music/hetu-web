import { useEffect, useState } from "react";

/** value 停止变化 wait 毫秒后才跟上；返回元组，与 useState 的用法一致 */
export function useDebouncedValue<T>(value: T, wait: number) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), wait);
    return () => clearTimeout(timer);
  }, [value, wait]);

  return [debounced] as const;
}
