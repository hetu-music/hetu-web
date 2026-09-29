import { cache } from "react";
import {
  fetchAll,
  getServiceClient,
  getUserClient,
  TABLES,
} from "@/lib/db/supabase-server";
import { CREDIT_FIELDS } from "@/lib/types";
import {
  summarizeCreditNames,
  type CreditAliasMap,
  type CreditNameUsage,
} from "@/lib/utils/utils-credits";

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

// ─── 后台 ─────────────────────────────────────────────────────────────────────

export type CreditAliasRow = {
  alias: string;
  name: string;
  created_at: string;
};

/** 写入被数据库拒绝时的原因，路由据此给出 4xx 而不是 500 */
export type CreditAliasErrorCode = "ALIAS_EXISTS" | "INVALID_ALIAS";

function creditAliasError(code: CreditAliasErrorCode, message: string) {
  return Object.assign(new Error(message), { code });
}

function userClient(accessToken: string) {
  const supabase = getUserClient(accessToken);
  if (!supabase) throw new Error("Supabase client unavailable");
  return supabase;
}

export async function listCreditAliases(
  accessToken: string,
): Promise<CreditAliasRow[]> {
  const { data, error } = await userClient(accessToken)
    .from(TABLES.CREDIT_ALIASES)
    .select("alias,name,created_at")
    .order("name")
    .order("alias");
  if (error) throw error;
  return data as CreditAliasRow[];
}

/** 全部署名及其用法；读暂存表，还没发布的歌里的名字也能登记 */
export async function listCreditNames(
  accessToken: string,
): Promise<CreditNameUsage[]> {
  const rows = await fetchAll<Record<string, string[] | null>>(
    userClient(accessToken),
    TABLES.ADMIN,
    ["id", ...CREDIT_FIELDS].join(","),
    (q) => q.order("id", { ascending: true }),
  );
  return summarizeCreditNames(rows);
}

export async function createCreditAlias(
  alias: string,
  name: string,
  accessToken: string,
): Promise<CreditAliasRow> {
  const { data, error } = await userClient(accessToken)
    .from(TABLES.CREDIT_ALIASES)
    .insert({ alias, name })
    .select("alias,name,created_at")
    .single();
  if (error) {
    if (error.code === "23505") {
      throw creditAliasError("ALIAS_EXISTS", `「${alias}」已登记过别名`);
    }
    // 23514：别名指向自己；P0001：触发器拦下的多层归并，消息是给人看的
    if (error.code === "23514") {
      throw creditAliasError("INVALID_ALIAS", "别名不能与主名相同");
    }
    if (error.code === "P0001") {
      throw creditAliasError("INVALID_ALIAS", error.message);
    }
    throw error;
  }
  return data as CreditAliasRow;
}

/** @returns 是否真的删掉了一行 */
export async function deleteCreditAlias(
  alias: string,
  accessToken: string,
): Promise<boolean> {
  const { data, error } = await userClient(accessToken)
    .from(TABLES.CREDIT_ALIASES)
    .delete()
    .eq("alias", alias)
    .select("alias");
  if (error) throw error;
  return (data ?? []).length > 0;
}

/** 已发布的歌里署有这个名字的，别名改动后要刷新它们的页面 */
export async function getPublishedSongIdsCreditedAs(
  name: string,
): Promise<number[]> {
  const supabase = getServiceClient();
  if (!supabase) return [];
  const rows = await fetchAll<Record<string, unknown> & { id: number }>(
    supabase,
    TABLES.MUSIC,
    ["id", ...CREDIT_FIELDS].join(","),
  );
  return rows
    .filter((row) =>
      CREDIT_FIELDS.some((f) => (row[f] as string[] | null)?.includes(name)),
    )
    .map((row) => row.id);
}
