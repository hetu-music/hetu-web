"use server";

import { isHumanAdmin, isSuperRole } from "@/lib/auth/roles";
import { assertAdmin } from "@/lib/server/server-auth";
import { wordsMissingFromLyrics } from "@/lib/server/service-imagery";
import {
  deleteSong,
  discardDraft,
  liveVersionId,
  motifIdsOfVersion,
  publishSong,
  unpublishSong,
  userDb,
} from "@/lib/server/service-versions";
import { refreshImagery, refreshSongs } from "@/lib/server/server-revalidate";

/**
 * 歌曲的生命周期操作（docs/DATABASE.md 第三节）。权限在数据库函数里再查一遍：
 * 发布、放弃草稿要 admin 或 super，下架、删歌要 super，bot 都不能做。
 */

type ActionResult = { success: true } | { success: false; error: string };

function failure(err: unknown): { success: false; error: string } {
  console.error("[admin-actions]", err);
  return {
    success: false,
    error: err instanceof Error ? err.message : "未知错误",
  };
}

/** 刷新这首歌牵连的公开页面与缓存数据；线上版本变了，前后两版标注挂的母题页都要清 */
async function refreshLive(songId: number, motifIds: number[]) {
  const purges = await Promise.all([
    refreshSongs([songId]),
    ...(motifIds.length > 0 ? [refreshImagery({ motifIds })] : []),
  ]);
  return [...new Set(purges.flatMap((p) => p.failed))];
}

/**
 * 发布：草稿冻结并上线；没有草稿而已下架时，重新上线最新的冻结版本。
 *
 * 意象的时间标签读时按歌词算，发布不用管；只把歌词里已找不到的标注词告诉调用方，
 * 要到意象页签删掉或改标。核对出错不拦发布。
 */
export async function handleApprove(id: number): Promise<
  | {
      success: true;
      cdnPurgeFailed: string[];
      imageryNotFound: string[];
    }
  | { success: false; error: string }
> {
  try {
    const { accessToken } = await assertAdmin(isHumanAdmin);
    const db = userDb(accessToken);

    const before = await motifIdsOfVersion(db, await liveVersionId(db, id));
    const imageryNotFound = await wordsMissingFromLyrics(id, accessToken).catch(
      (err) => {
        console.error("[handleApprove] 核对意象标注失败:", err);
        return [];
      },
    );

    const live = await publishSong(db, id);
    const after = await motifIdsOfVersion(db, live);
    const cdnPurgeFailed = await refreshLive(id, [
      ...new Set([...before, ...after]),
    ]);

    // Server Action 拿不到响应头，没刷成功的 CDN 放进返回值，由调用方提示
    return {
      success: true,
      cdnPurgeFailed,
      imageryNotFound,
    };
  } catch (err) {
    return failure(err);
  }
}

/** 放弃草稿：删掉草稿及其编校数据，回到最新的冻结版本。线上不变，不用刷新 */
export async function handleDiscardDraft(id: number): Promise<ActionResult> {
  try {
    const { accessToken } = await assertAdmin(isHumanAdmin);
    await discardDraft(userDb(accessToken), id);
    return { success: true };
  } catch (err) {
    return failure(err);
  }
}

/** 下架：不在线上，版本、草稿、读者数据都保留 */
export async function handleUnpublish(
  id: number,
): Promise<
  | { success: true; cdnPurgeFailed: string[] }
  | { success: false; error: string }
> {
  try {
    const { accessToken } = await assertAdmin(isSuperRole);
    const db = userDb(accessToken);
    const motifIds = await motifIdsOfVersion(db, await liveVersionId(db, id));
    await unpublishSong(db, id);
    return { success: true, cdnPurgeFailed: await refreshLive(id, motifIds) };
  } catch (err) {
    return failure(err);
  }
}

/** 删歌：歌及挂在上面的一切级联删除。在线的歌要先下架，所以不牵动公开页 */
export async function handleDeleteSong(id: number): Promise<ActionResult> {
  try {
    const { accessToken } = await assertAdmin(isSuperRole);
    await deleteSong(userDb(accessToken), id);
    return { success: true };
  } catch (err) {
    return failure(err);
  }
}
