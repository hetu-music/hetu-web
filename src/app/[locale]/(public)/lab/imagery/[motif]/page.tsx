import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import MotifPageProto from "@/components/lab/imagery/MotifPageProto";
import { getMotif } from "@/components/lab/imagery/data";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ locale: string; motif: string }>;
  searchParams: Promise<{ w?: string; q?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { motif } = await params;
  const data = await getMotif(Number(motif));
  return {
    title: data ? `${data.name} · 意象原型` : "意象原型",
    robots: { index: false, follow: false },
  };
}

export default async function MotifProtoPage({ params, searchParams }: Props) {
  const { locale, motif } = await params;
  setRequestLocale(locale);
  const id = Number(motif);
  if (!Number.isInteger(id)) notFound();
  const data = await getMotif(id);
  if (!data) notFound();

  // ?w=<词 id> 直接选中；?q= 是从索引页搜索过来的，选中第一个含它的写法
  const { w, q } = await searchParams;
  const byId = data.words.find((x) => x.id === Number(w));
  const byQuery = q ? data.words.find((x) => x.name.includes(q)) : undefined;
  return (
    <MotifPageProto motif={data} initialWord={(byId ?? byQuery)?.id ?? null} />
  );
}
