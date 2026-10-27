import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const nextConfig: NextConfig = {
  output: "standalone",
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "cover.hetu-music.com",
      },
    ],
    minimumCacheTTL: 3600,
    // 本地网络下 cover.hetu-music.com 会解析到内网地址，图片优化器默认拒绝；
    // 只在开发环境放开，生产环境保留 SSRF 防护
    dangerouslyAllowLocalIP: process.env.NODE_ENV === "development",
    // 优化图片处理以减少内存占用
  },
  // 压缩配置
  compress: true,
  // ISR 页面过期上限（默认一年），同时决定两件事：
  // - CDN 收到的 stale-while-revalidate：万一清 CDN 失败，旧页面最多再挂 7 天
  // - Next 自己：超过 7 天没人访问的页面，下次访问当场重新生成，不先给旧页面
  expireTime: 604800,
  // 安全响应头只在这里设置（CSP 在 proxy.ts），nginx 不再重复添加
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // 让 nginx 不缓冲响应，页面外壳与 loading 骨架屏能先发出去（流式渲染）。
          // nginx 默认不把 X-Accel-* 头转给客户端
          {
            key: "X-Accel-Buffering",
            value: "no",
          },
          {
            key: "X-DNS-Prefetch-Control",
            value: "on",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Cross-Origin-Opener-Policy",
            value: "same-origin",
          },
        ],
      },
      {
        // 字体分片（pnpm fonts:split 生成）以内容哈希命名，内容变了名字就变，可以永久缓存。
        // 同目录的 result.css 名字固定，保持默认的每次校验
        source: "/fonts/:font/:file([0-9a-f]{32}\\.woff2)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ];
  },
  // OG 图片代理：爬虫通过部署服务器中转访问封面图
  async rewrites() {
    return [
      {
        source: "/og-cover/:path*",
        destination: "https://cover.hetu-music.com/cover/:path*",
      },
    ];
  },
  // 旧 zh-CN 无前缀 URL → 新 /zh-CN/ 显式前缀 URL 的 301 永久重定向
  // 防止 Google 已收录页面变为 404，保护 SEO 权重
  async redirects() {
    return [
      // 首页
      {
        source: "/",
        destination: "/zh-CN",
        permanent: true,
      },
      // imagery
      {
        source: "/imagery",
        destination: "/zh-CN/imagery",
        permanent: true,
      },
      // story/qjtx
      {
        source: "/story/qjtx",
        destination: "/zh-CN/story/qjtx",
        permanent: true,
      },
      // song 详情页（通配）
      {
        source: "/song/:id",
        destination: "/zh-CN/song/:id",
        permanent: true,
      },
      // login / register（admin 相关）
      {
        source: "/login",
        destination: "/zh-CN/login",
        permanent: true,
      },
      {
        source: "/register",
        destination: "/zh-CN/register",
        permanent: true,
      },
    ];
  },
};

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");
export default withNextIntl(nextConfig);
