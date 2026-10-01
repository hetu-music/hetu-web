/**
 * 卡顿看门狗：播放中进度超过 timeoutMs 没动，就调用 onStall。
 *
 * 转码流没有长度、不支持分段请求，连接一旦中途断开（比如客户端缓冲够了暂停读取，
 * 被服务端超时关掉），Safari 续不上，会一直停在缓冲里：按钮显示播放中，时间不走。
 * 这时由调用方从当前位置重新取流，效果等同于用户手动拖一下进度条。
 *
 * 只靠 timeupdate 驱动、不开定时轮询：正常播放时每次进度前进就把计时器往后推，
 * 卡住时 timeupdate 不再来（或来了但位置没变），计时器才会走到头。
 */
export function createStallWatchdog(timeoutMs: number, onStall: () => void) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let lastPosition: number | null = null;

  const stop = () => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
    lastPosition = null;
  };

  const arm = () => {
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      lastPosition = null;
      onStall();
    }, timeoutMs);
  };

  return {
    /** 开始播放（playing 事件）：从现在起计时 */
    start(position: number) {
      lastPosition = position;
      arm();
    },
    /** 进度回报（timeupdate）：位置前进了才往后推，原地不动的回报不算 */
    progress(position: number) {
      if (timer === null) return;
      if (position === lastPosition) return;
      lastPosition = position;
      arm();
    },
    /** 暂停、结束、换源、出错：停止计时 */
    stop,
  };
}

/**
 * 自动恢复的次数限制：windowMs 内最多 max 次，超过就交给调用方报错，
 * 免得网络彻底不通时无限重试
 */
export function createRetryBudget(max: number, windowMs: number) {
  let times: number[] = [];
  return {
    /** 记一次尝试；额度已用完时返回 false，不记 */
    take(now = Date.now()) {
      times = times.filter((t) => now - t < windowMs);
      if (times.length >= max) return false;
      times.push(now);
      return true;
    },
  };
}
