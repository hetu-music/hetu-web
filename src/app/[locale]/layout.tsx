import { NextIntlClientProvider, hasLocale } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import {
  Inter,
  Noto_Sans_SC,
  Noto_Serif_SC,
  Playfair_Display,
} from "next/font/google";
import { PWARegistration } from "@/components/pwa/PWARegistration";
import { SplitFontStyles } from "@/components/shared/SplitFontStyles";
import { Providers } from "@/context/providers";

// 四款都是可变字体，都不写 weight：@font-face 声明整个字重区间，font-light 才真的是 300
// （Playfair 最细只到 400，落到它上面仍是 400）。写成固定字重（400/500/…）时
// Google 给的仍是同一批文件，流量不变，但只声明了这几个值，font-light 会退回 400

// 标题字体 - 衬线体
const playfairDisplay = Playfair_Display({
  variable: "--font-heading",
  subsets: ["latin"],
  display: "swap",
});

const notoSerifSC = Noto_Serif_SC({
  variable: "--font-heading-sc",
  display: "swap",
});

// 正文字体 - 无衬线体
const inter = Inter({
  variable: "--font-body",
  subsets: ["latin"],
  display: "swap",
});

const notoSansSC = Noto_Sans_SC({
  variable: "--font-body-sc",
  display: "swap",
});

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  setRequestLocale(locale);

  const messages = await getMessages();

  return (
    <html
      lang={locale}
      suppressHydrationWarning
      className={`${playfairDisplay.variable} ${notoSerifSC.variable} ${inter.variable} ${notoSansSC.variable}`}
    >
      <body className="antialiased">
        <PWARegistration />
        <SplitFontStyles />
        <NextIntlClientProvider messages={messages} locale={locale}>
          <Providers>
            {/* 不要给这层加 z-index：那会自成一个层级上下文，页面里的浮层再高也压不过
                外面的播放条（层级表见 DESIGN.md 第九节） */}
            <div className="relative min-h-screen">{children}</div>
          </Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
