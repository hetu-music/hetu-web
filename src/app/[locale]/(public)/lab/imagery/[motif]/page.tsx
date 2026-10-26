import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import MotifIndexProto from "@/components/lab/imagery/MotifIndexProto";
import { getMotif, getMotifIndex } from "@/components/lab/imagery/data";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ locale: string; motif: string }>;
  searchParams: Promise<{ w?: string; view?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { motif } = await params;
  const data = await getMotif(Number(motif));
  return {
    title: data ? `${data.name} · 意象原型` : "意象原型",
    robots: { index: false, follow: false },
  };
}

/** 一个母题的网址：打开的是整片词云，这个母题亮着、面板展开 */
export default async function MotifProtoPage({ params, searchParams }: Props) {
  const { locale, motif } = await params;
  setRequestLocale(locale);
  const id = Number(motif);
  if (!Number.isInteger(id)) notFound();
  const [data, current, { w, view }] = await Promise.all([
    getMotifIndex(),
    getMotif(id),
    searchParams,
  ]);
  if (!current) notFound();
  const word = current.words.find((x) => x.id === Number(w))?.id ?? null;
  return (
    <MotifIndexProto
      data={data}
      initialView={view === "words" ? "words" : "motifs"}
      initialMotif={current}
      initialWord={word}
    />
  );
}
