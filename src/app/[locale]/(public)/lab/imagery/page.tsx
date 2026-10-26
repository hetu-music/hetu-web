import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import MotifIndexProto from "@/components/lab/imagery/MotifIndexProto";
import { getMotifIndex } from "@/components/lab/imagery/data";

// 原型页：不进搜索引擎
export const metadata: Metadata = {
  title: "意象词云（原型）",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ view?: string }>;
};

export default async function MotifIndexProtoPage({
  params,
  searchParams,
}: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [data, { view }] = await Promise.all([getMotifIndex(), searchParams]);
  return (
    <MotifIndexProto
      data={data}
      initialView={view === "words" ? "words" : "motifs"}
      initialMotif={null}
      initialWord={null}
    />
  );
}
