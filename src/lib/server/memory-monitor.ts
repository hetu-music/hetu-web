/* eslint-disable no-console */
import fs from "node:fs";
import path from "node:path";
import v8 from "node:v8";

/**
 * 进程内存监控：定时打印内存明细，并支持按信号抓堆快照。
 * 由 src/instrumentation.ts 在服务启动时调用一次。
 *
 * 环境变量：
 *   MEMORY_LOG_INTERVAL_MS  可选，打印间隔，默认 10 分钟；设为 0 关闭定时打印
 *   HEAP_SNAPSHOT_DIR       可选，快照写入目录，默认 .next/cache
 *                           （容器里 /app 归 root，运行用户只能写 .next/cache）
 *
 * 查看：docker logs hetu-music 2>&1 | grep '\[mem\]'
 * 抓快照：docker exec hetu-music kill -USR2 1
 */
const DEFAULT_INTERVAL_MS = 10 * 60 * 1000;

const mb = (bytes: number) => Math.round(bytes / 1024 / 1024);

function logMemory() {
  const m = process.memoryUsage();
  // rss 涨而 heapUsed 不涨 → 涨的是原生内存（Buffer、sharp 等），堆快照里看不到
  console.log(
    `[mem] uptime=${(process.uptime() / 3600).toFixed(1)}h` +
      ` rss=${mb(m.rss)}MB heapUsed=${mb(m.heapUsed)}MB heapTotal=${mb(m.heapTotal)}MB` +
      ` external=${mb(m.external)}MB arrayBuffers=${mb(m.arrayBuffers)}MB`,
  );
}

let snapshotting = false;

function writeHeapSnapshot() {
  if (snapshotting) return;
  snapshotting = true;
  try {
    const dir =
      process.env.HEAP_SNAPSHOT_DIR || path.join(process.cwd(), ".next/cache");
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(
      dir,
      `heap-${new Date().toISOString().replace(/[:.]/g, "-")}.heapsnapshot`,
    );
    logMemory();
    console.log(`[mem] 开始写堆快照（期间进程会暂停几秒）：${file}`);
    v8.writeHeapSnapshot(file);
    console.log(`[mem] 堆快照已写入：${file}`);
  } catch (error) {
    console.error("[mem] 写堆快照失败:", error);
  } finally {
    snapshotting = false;
  }
}

export function startMemoryMonitor() {
  const raw = process.env.MEMORY_LOG_INTERVAL_MS;
  const interval = raw === undefined ? DEFAULT_INTERVAL_MS : Number(raw);

  // 堆上限能看出容器有没有设内存限制：没设时 V8 按宿主机内存定，回收会很懒
  console.log(
    `[mem] 监控已启动 node=${process.version}` +
      ` heapLimit=${mb(v8.getHeapStatistics().heap_size_limit)}MB` +
      ` interval=${interval > 0 ? `${interval / 60000}min` : "off"}`,
  );
  logMemory();

  if (interval > 0) {
    // unref：不因这个定时器阻止进程退出
    setInterval(logMemory, interval).unref();
  }

  // 注册监听后 SIGUSR2 不再走默认行为（终止进程）
  process.on("SIGUSR2", writeHeapSnapshot);
}
