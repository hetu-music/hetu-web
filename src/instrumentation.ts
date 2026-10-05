// 服务启动时 Next 调用一次 register()，见 node_modules/next/dist/docs/01-app/02-guides/instrumentation.md
export async function register() {
  // 内存监控只在生产的 Node 运行时开；开发环境频繁重编译，数字没有参考价值
  if (
    process.env.NEXT_RUNTIME === "nodejs" &&
    process.env.NODE_ENV === "production"
  ) {
    const { startMemoryMonitor } = await import("./lib/server/memory-monitor");
    startMemoryMonitor();
  }
}
