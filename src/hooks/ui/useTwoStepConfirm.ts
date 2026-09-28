import { useCallback, useEffect, useState } from "react";

/**
 * 危险操作的两步确认：第一次点击只进入待确认（文字变成「确认删除」），
 * 在 timeout 内再点一次才真正执行；不点就自动复原，不用确认弹窗。
 *
 * request() 返回 true 表示已确认、应当执行。
 */
export function useTwoStepConfirm(timeout = 3000) {
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!confirming) return;
    const timer = setTimeout(() => setConfirming(false), timeout);
    return () => clearTimeout(timer);
  }, [confirming, timeout]);

  const request = useCallback(() => {
    if (confirming) {
      setConfirming(false);
      return true;
    }
    setConfirming(true);
    return false;
  }, [confirming]);

  const reset = useCallback(() => setConfirming(false), []);

  return { confirming, request, reset };
}
