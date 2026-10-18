"use client";

import AuditLogsPanel from "@/components/admin/AuditLogsPanel";
import CreditAliasPanel from "@/components/admin/CreditAliasPanel";
import RequestsPanel from "@/components/admin/RequestsPanel";
import UserManagePanel from "@/components/admin/UserManagePanel";
import { useUserContext } from "@/context/UserContext";
import { useCsrfToken } from "@/hooks/utils/useCsrfToken";
import AdminShell from "./kit/AdminShell";

type PanelSection = "credits" | "requests" | "users" | "logs";

const HEADERS: Record<PanelSection, { title: string; description: string }> = {
  credits: {
    title: "署名",
    description: "登记同一个人在不同作品里的不同署名，全站归到一个主名下",
  },
  requests: {
    title: "反馈",
    description: "处理用户提交的纠错、申请等反馈",
  },
  users: {
    title: "用户",
    description: "管理所有注册用户的资料与权限",
  },
  logs: {
    title: "日志",
    description: "数据库审计记录，仅供查阅",
  },
};

/** 署名、反馈、用户、日志几个后台页共用的外壳 */
export default function AdminPanelClient({
  section,
  initialStatus,
}: {
  section: PanelSection;
  /** 反馈板块的初始状态筛选 */
  initialStatus?: string;
}) {
  const { user } = useUserContext();
  const csrfToken = useCsrfToken();
  const { title, description } = HEADERS[section];

  return (
    <AdminShell section={section} title={title} description={description}>
      {section === "credits" && <CreditAliasPanel csrfToken={csrfToken} />}
      {section === "requests" && (
        <RequestsPanel
          csrfToken={csrfToken}
          isSuper={!!user?.isSuper}
          initialStatus={initialStatus}
        />
      )}
      {section === "users" && <UserManagePanel csrfToken={csrfToken} />}
      {section === "logs" && <AuditLogsPanel />}
    </AdminShell>
  );
}
