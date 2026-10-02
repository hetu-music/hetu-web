/** 个人中心的四节，也是 ?tab= 的取值 */
export const PROFILE_TABS = [
  "favorites",
  "annotations",
  "account",
  "feedback",
] as const;
export type ProfileTab = (typeof PROFILE_TABS)[number];

export function isProfileTab(value: string): value is ProfileTab {
  return (PROFILE_TABS as readonly string[]).includes(value);
}

/** 2026.9.28 这样的短日期 */
export function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}`;
}

export { bumpNavDepth } from "@/lib/utils/utils-nav";
