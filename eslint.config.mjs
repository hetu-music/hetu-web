// eslint.config.mjs
import { defineConfig } from "eslint/config";
import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import nextConfig from "eslint-config-next"; // 包含 jsx-a11y
import reactHooks from "eslint-plugin-react-hooks";
import prettierConfig from "eslint-config-prettier";

export default defineConfig(
  //全局忽略
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "out/**",
      "build/**",
      "dist/**",
      ".env*",
      "public/**",
      "*.config.js",
      "*.config.mjs",
      "next-env.d.ts",
    ],
  },

  // 基础推荐
  js.configs.recommended,
  ...tseslint.configs.recommended,

  // Next.js 完整配置（包含 jsx-a11y）
  nextConfig,  // 直接使用，不拆分

  // React Hooks（手动注册）
  {
    plugins: {
      "react-hooks": reactHooks,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
    },
  },
  
  {
    rules: {
      "jsx-a11y/alt-text": [
        "error",
        {
          elements: ["img", "object", "area", "input[type='image']"],
          img: ["Image"],
        },
      ],
      "jsx-a11y/aria-props": "warn",
      "jsx-a11y/aria-proptypes": "warn",
      "jsx-a11y/aria-unsupported-elements": "warn",
      "jsx-a11y/role-has-required-aria-props": "warn",
      "jsx-a11y/role-supports-aria-props": "warn",
    },
  },

  // 通用 JS/TS 配置
  {
    files: ["**/*.{js,mjs,cjs,ts,tsx}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.es2021,
      },
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    rules: {
      "no-unused-vars": "off",
      "no-undef": "off",
      "no-console": ["warn", { allow: ["warn", "error"] }],
      "no-unused-expressions": "warn",
      "no-useless-constructor": "off",
      "no-loop-func": "off",
      "prefer-const": "warn",
      "no-var": "error",

      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" }
      ],
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-empty-function": "warn",

      "react/react-in-jsx-scope": "off",
      "react/prop-types": "off",
    },
  },

  // 仅 TS 文件
  {
    files: ["**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/explicit-module-boundary-types": "off",
      "@typescript-eslint/no-non-null-assertion": "warn",

      // 禁止 barrel 导入，一律用具体文件路径。
      //
      // 这些目录下曾有 index.ts 聚合导出，但全仓库零引用、已删除。
      // 不恢复的原因是服务端/客户端边界：@/lib/db 的 barrel 会同时带出
      // supabase-server（service role key）与 supabase-auth（next/headers），
      // @/lib/server 会经 service-songs 带出 opencc-js 的整份字典。
      // 客户端组件想拿个 TABLES 常量就可能把这些一起拖进 bundle。
      // 用 paths（精确匹配模块名）而非 patterns——后者是前缀匹配，
      // 会把 @/lib/db/supabase-auth 这类正常的具体路径一并拦掉。
      "no-restricted-imports": [
        "error",
        {
          paths: [
            "@/lib/db",
            "@/lib/server",
            "@/lib/api",
            "@/lib/utils",
            "@/lib/forms",
            "@/lib/player",
            "@/hooks/utils",
          ].map((name) => ({
            name,
            message: `请直接导入具体文件（如 ${name}/xxx），不要使用目录聚合导入——barrel 会把服务端模块带进客户端依赖图。`,
          })),
        },
      ],
    },
  },

  // 配置文件特殊处理
  {
    files: ["*.config.{js,mjs,ts}"],
    languageOptions: { globals: globals.node },
    rules: { "@typescript-eslint/no-var-requires": "off" },
  },

  // Prettier 收尾
  prettierConfig,
);