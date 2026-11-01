/// <reference lib="webworker" />

import {
  CacheableResponsePlugin,
  CacheFirst,
  ExpirationPlugin,
  NetworkFirst,
  NetworkOnly,
  Serwist,
  StaleWhileRevalidate,
  type PrecacheEntry,
  type SerwistGlobalConfig,
} from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

// 允许进入 Cache Storage 的公开只读接口白名单。
//
// Cache Storage 按 origin 共享，不区分登录账号，因此身份相关的接口一律
// 不得缓存：/api/auth/**（登录态）、/api/admin/**（后台数据）、收藏与
// 用户请求（按 user_id 返回）、CSRF token（缓存会导致 token 与 cookie
// 不一致）、Navidrome 串流凭证。用白名单而非黑名单，新增接口默认不缓存。
const PUBLIC_CACHEABLE_API = [
  /^\/api\/public\/songs\/lyrics-index$/,
  /^\/api\/public\/songs\/\d+\/lyrics$/,
  /^\/api\/public\/contributors$/,
  /^\/api\/imagery\/motifs\/\d+$/,
];

// 旧版本 SW 把全部 /api/** 写进了 "api-data"，其中可能残留上一个登录
// 账号的 /api/auth/me 与收藏响应。激活时一次性删除该缓存。
self.addEventListener("activate", (event) => {
  event.waitUntil(caches.delete("api-data"));
});

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  precacheOptions: {
    cleanupOutdatedCaches: true,
  },
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: false,
  runtimeCaching: [
    {
      matcher: ({ url }) => url.origin === "https://fonts.googleapis.com",
      handler: new StaleWhileRevalidate({
        cacheName: "google-fonts-stylesheets",
      }),
    },
    {
      matcher: ({ url }) => url.origin === "https://fonts.gstatic.com",
      handler: new CacheFirst({
        cacheName: "google-fonts-webfonts",
        plugins: [
          new ExpirationPlugin({
            maxEntries: 30,
            maxAgeSeconds: 60 * 60 * 24 * 365,
          }),
        ],
      }),
    },
    {
      matcher: ({ sameOrigin, url }) =>
        sameOrigin && url.pathname.startsWith("/_next/static/"),
      handler: new CacheFirst({
        cacheName: "next-static-assets",
        plugins: [
          new ExpirationPlugin({
            maxEntries: 100,
            maxAgeSeconds: 60 * 60 * 24 * 365,
          }),
        ],
      }),
    },
    {
      matcher: ({ sameOrigin, url }) =>
        sameOrigin && url.pathname === "/_next/image",
      handler: new StaleWhileRevalidate({
        cacheName: "next-optimized-images",
        plugins: [
          new ExpirationPlugin({
            maxEntries: 200,
            maxAgeSeconds: 60 * 60 * 24 * 30,
          }),
        ],
      }),
    },
    {
      // 曲库页搜歌词的数据（docs/LIBRARY.md 阶段 5「2.」）：地址带版本号，同一地址内容不变，
      // 第二次访问直接从这里读，不再等下载。简繁各留两三个版本，旧的自动淘汰。
      // 只存版本号和数据对得上的响应（接口用响应头说明，见 lyrics-lines/route.ts）。
      // 不带 v 的请求不进这条，走下面的白名单规则（也不在白名单里，不缓存）
      matcher: ({ sameOrigin, url, request }) =>
        sameOrigin &&
        request.method === "GET" &&
        url.pathname === "/api/public/songs/lyrics-lines" &&
        url.searchParams.has("v"),
      handler: new CacheFirst({
        cacheName: "lyrics-lines",
        plugins: [
          new CacheableResponsePlugin({
            statuses: [200],
            headers: { "X-Lyrics-Version-Match": "1" },
          }),
          new ExpirationPlugin({
            maxEntries: 6,
            maxAgeSeconds: 60 * 60 * 24 * 90,
          }),
        ],
      }),
    },
    {
      matcher: ({ sameOrigin, url, request }) =>
        sameOrigin &&
        request.method === "GET" &&
        PUBLIC_CACHEABLE_API.some((pattern) => pattern.test(url.pathname)),
      handler: new NetworkFirst({
        cacheName: "public-api-data",
        networkTimeoutSeconds: 5,
        plugins: [
          new ExpirationPlugin({
            maxEntries: 50,
            maxAgeSeconds: 60 * 5,
          }),
        ],
      }),
    },
    {
      matcher: ({ request }) => request.mode === "navigate",
      handler: new NetworkOnly(),
    },
  ],
});

serwist.addEventListeners();
