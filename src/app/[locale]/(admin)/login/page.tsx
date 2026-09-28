import type { Metadata } from "next";
import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";
import AuthClient from "@/components/auth/AuthClient";
import { getAuthGallery } from "@/lib/server/service-auth-gallery";
import { safeNextPath } from "@/lib/utils/safe-next";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ next?: string | string[] }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "auth" });
  const tSite = await getTranslations({ locale, namespace: "common.site" });
  // (admin) 布局的标题是普通字符串，接不上根布局的「%s - 站名」模板，这里写全
  return { title: { absolute: `${t("login.title")} - ${tSite("name")}` } };
}

export default async function LoginPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const headersList = await headers();
  const nonce = headersList.get("x-nonce") || undefined;
  // 在服务端读好并校验 next：客户端再读会与服务端渲染的链接不一致
  const { next } = await searchParams;
  const gallery = await getAuthGallery(locale);

  return (
    <AuthClient
      nonce={nonce}
      mode="login"
      next={safeNextPath(next)}
      gallery={gallery}
    />
  );
}
