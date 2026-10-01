import type { Metadata, Viewport } from "next";
import "./globals.css";

// PWA Viewport 配置
export const viewport: Viewport = {
  // 与页面底色（globals.css 的 --background）一致；水合后由 BrowserChromeColor 接管，
  // 跟上手动切的主题和打开的浮层
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fafafa" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0f19" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  metadataBase: new URL("https://hetu-music.com"),
  title: {
    default: "河图作品勘鉴 - 河图音乐作品收录与鉴赏",
    template: "%s - 河图作品勘鉴",
  },
  description: "河图音乐作品收录与鉴赏。",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "河图勘鉴",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/icons/icon-152x152.png", sizes: "152x152", type: "image/png" },
      { url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
    ],
  },
};

// 根 layout 仅导出全局 metadata 和 viewport（被 Next.js 收集注入 <head>）。
// 完整的 <html>/<body> 结构由 [locale]/layout.tsx 负责。
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
