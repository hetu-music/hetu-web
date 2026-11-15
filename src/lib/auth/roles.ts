/**
 * 账号角色（users.role，同步进 JWT 的 app_metadata.role，见 docs/DATABASE.md 第六节）。
 *
 * 逐级包含：
 *   bot   — 能读写后台（资料、意象、基调、校勘都写在草稿上），不能发布、下架、删歌，不处理用户请求
 *   admin — 再加发布、放弃草稿、处理歌曲反馈
 *   super — 再加下架、删歌、用户管理、音频
 *
 * 数据库里的 RLS 与生命周期函数按同一套规则检查，这里只是让页面与接口先拦一道。
 */
export const ROLES = ["user", "bot", "admin", "super"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABEL: Record<Role, string> = {
  user: "普通用户",
  bot: "机器人",
  admin: "管理员",
  super: "超级管理员",
};

export function isRole(value: unknown): value is Role {
  return (
    typeof value === "string" && (ROLES as readonly string[]).includes(value)
  );
}

/** 从 JWT 的 app_metadata 读角色；没有或不认识的一律当普通用户 */
export function roleOf(appMetadata: object | null | undefined): Role {
  const role = (appMetadata as { role?: unknown } | null | undefined)?.role;
  return isRole(role) ? role : "user";
}

/** 能进后台读写：bot、admin、super */
export function isStaff(role: Role): boolean {
  return role === "bot" || role === "admin" || role === "super";
}

/** 人类管理员：能发布、放弃草稿、处理歌曲反馈 */
export function isHumanAdmin(role: Role): boolean {
  return role === "admin" || role === "super";
}

export function isSuperRole(role: Role): boolean {
  return role === "super";
}
