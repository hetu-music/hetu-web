import { cache } from "react";
import { getServiceClient, TABLES } from "@/lib/db/supabase-server";
import type { CreditAliasMap } from "@/lib/utils/utils-credits";

/**
 * 读取署名别名表（别名 → 主名）。
 *
 * 表只有寥寥几十行，每次请求整表读一遍即可。读取失败时退回空表：
 * 署名照原样显示，不应因此让整页出错。
 */
export const getCreditAliases = cache(
  async function getCreditAliases(): Promise<CreditAliasMap> {
    const supabase = getServiceClient();
    if (!supabase) return new Map();

    const { data, error } = await supabase
      .from(TABLES.CREDIT_ALIASES)
      .select("alias,name");

    if (error) {
      console.error("[getCreditAliases] Supabase error:", error);
      return new Map();
    }
    return new Map(
      (data as { alias: string; name: string }[]).map((r) => [r.alias, r.name]),
    );
  },
);
