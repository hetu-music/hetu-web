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

// 标题字体 - 衬线体
const playfairDisplay = Playfair_Display({
  variable: "--font-heading",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const notoSerifSC = Noto_Serif_SC({
  variable: "--font-heading-sc",
  weight: ["400", "500", "600", "700"],
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
  weight: ["400", "500", "700"],
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
