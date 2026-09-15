import { defineConfig } from "vitest/config";
import path from "path";

const rootDir = import.meta.dirname;

export default defineConfig({
  test: {
    // 默认 node 环境；需要 DOM 的测试在文件顶部用
    // `// @vitest-environment jsdom` 单独声明，避免拖慢纯逻辑测试。
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      // 排除制：src 下的源码默认全部纳入统计。
      //
      // 此前是白名单制，只统计手工列出的十来个文件——新增模块默认不在统计范围内，
      // 覆盖率数字会随代码增长而失真（写了多少没测的代码都看不出来）。
      // 现在改为默认全收，下面只排除无法或不适合做单元测试的部分。
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        // 测试自身与测试辅助
        "src/**/*.test.{ts,tsx}",
        "src/test/**",
        // 纯类型声明，没有可执行语句
        "src/**/*.d.ts",
        "src/lib/types.ts",
        // Service Worker：运行在 ServiceWorkerGlobalScope，无法在 vitest 中加载
        "src/sw.ts",
        // i18n 与路由配置，本身就是声明
        "src/i18n/**",
      ],
      thresholds: {
        // ⚠️ 全局阈值是「棘轮」而非目标：设在当前实测水平略下方，防止倒退。
        // 只允许随测试补充向上调，不允许为了让 CI 变绿而下调。
        //
        // 数字看起来低，是因为口径变了而不是覆盖变差了：旧配置只统计手工列出的
        // 十几个文件（因而显示 85%），现在统计 src 下全部源码。
        // 目标见路线图阶段 05：整体行覆盖率不低于 60%。
        statements: 22,
        branches: 19,
        functions: 16,
        lines: 22,

        // 已有测试的核心区域保持高水位，等同于旧白名单提供的保障，
        // 避免「全局阈值低」被当成这些模块也可以随便降。
        "src/lib/forms/**": {
          statements: 94,
          branches: 70,
          functions: 90,
          lines: 94,
        },
        "src/lib/server/**": {
          statements: 85,
          branches: 75,
          functions: 92,
          lines: 90,
        },
        "src/lib/utils/**": {
          statements: 87,
          branches: 65,
          functions: 90,
          lines: 88,
        },
        "src/store/**": {
          statements: 86,
          branches: 62,
          functions: 78,
          lines: 90,
        },
        // API 路由承载鉴权、CSRF 与入参校验，单独设棘轮防止新增路由不写测试
        "src/app/api/**": {
          statements: 38,
          branches: 36,
          functions: 34,
          lines: 38,
        },
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(rootDir, "src"),
      // server-only 的 exports map 只在 react-server 条件下解析到空实现，
      // 其余条件解析到一个「一被导入就抛错」的入口。Next 的 RSC 构建满足该条件，
      // vitest 不满足，因此显式指向包自带的 empty.js。
      "server-only": path.resolve(rootDir, "node_modules/server-only/empty.js"),
    },
  },
});
