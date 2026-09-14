#!/bin/sh
# 只开 -u（引用未定义变量即报错），不开 -e。
#
# 两个原因：一是预热失败绝不该阻止服务启动，脚本里的错误分支都已显式处理；
# 二是实测 -e 会让下面的后台子 shell 在第一次轮询失败后直接退出，导致冷启动
# 稍慢时静默跳过 revalidate。
set -u

PORT="${PORT:-3000}"
BASE="http://127.0.0.1:${PORT}"

# ─── 部署后预热：等服务真正就绪再触发一次 revalidate ──────────────────────────
#
# 放在后台子 shell 里跑，主进程必须留给 node（见文件末尾的 exec）。
# 就绪判断用轮询 /robots.txt（静态、无副作用），而不是固定 sleep——
# 固定等待既可能不够（冷启动慢时白跑一次）也可能多余（浪费部署时间）。
if [ -n "${REVALIDATE_SECRET:-}" ]; then
  (
    attempt=0
    while [ "$attempt" -lt 60 ]; do
      if curl -sf -o /dev/null --max-time 2 "${BASE}/robots.txt"; then
        if curl -sf -o /dev/null --max-time 30 -X POST \
          -H "x-revalidate-secret: ${REVALIDATE_SECRET}" \
          "${BASE}/api/public/revalidate"; then
          echo "[start] revalidate 成功（等待就绪 ${attempt}s）"
        else
          echo "[start] revalidate 请求失败"
        fi
        exit 0
      fi
      attempt=$((attempt + 1))
      sleep 1
    done
    echo "[start] 等待服务就绪超时（60s），跳过 revalidate"
  ) &
else
  echo "[start] 未设置 REVALIDATE_SECRET，跳过 revalidate"
fi

# ─── 启动 Next.js（Standalone 模式）──────────────────────────────────────────
#
# 必须用 exec：让 node 直接成为 PID 1，容器停止时 SIGTERM 才能送达它，走
# Next 的优雅退出。此前写法是 `node server.js &` 配 `wait`，PID 1 是 sh，
# 信号收不到，每次部署都要等宽限期结束后被 SIGKILL 强杀，处理中的请求直接断。
exec node server.js
