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
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
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
