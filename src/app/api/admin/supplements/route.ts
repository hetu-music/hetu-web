import { entryWriteHandlers } from "@/lib/server/collation-routes";
import { songRow } from "@/lib/server/service-collations";
import { supplementInputSchema } from "@/lib/utils/utils-collations";

// 补遗与校记同表：读取、删除都走 /api/admin/collations，这里只管新增与修改
const write = entryWriteHandlers(
  "/api/admin/supplements",
  supplementInputSchema,
  songRow,
);

/** 新增补遗：POST，{ song_id, entry } */
export const POST = write.POST;
/** 修改补遗：PUT，{ id, entry } */
export const PUT = write.PUT;
