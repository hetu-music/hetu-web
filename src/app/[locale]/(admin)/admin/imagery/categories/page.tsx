import { redirect } from "@/i18n/navigation";

type Props = {
  params: Promise<{ locale: string }>;
};

/** 原先的「分类」子页已并入意象库首页（门类 › 类别 › 母题） */
export default async function ImageryCategoriesPage({ params }: Props) {
  const { locale } = await params;
  redirect({ href: "/admin/imagery", locale });
}
