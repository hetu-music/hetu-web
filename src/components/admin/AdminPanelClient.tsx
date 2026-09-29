"use client";

import AuditLogsPanel from "@/components/admin/AuditLogsPanel";
import CreditAliasPanel from "@/components/admin/CreditAliasPanel";
import RequestsPanel from "@/components/admin/RequestsPanel";
import UserManagePanel from "@/components/admin/UserManagePanel";
import { useUserContext } from "@/context/UserContext";
import { useCsrfToken } from "@/hooks/utils/useCsrfToken";
import AdminNavbar from "./song-admin/AdminNavbar";

type PanelSection = "credits" | "requests" | "users" | "logs";

const HEADERS: Record<PanelSection, { title: string; description: string }> = {
  credits: {
    title: "署名管理",
    description: "登记同一个人在不同作品里的不同署名，全站归到一个主名下",
  },
  requests: {
    title: "反馈管理",
    description: "处理用户提交的纠错、申请等反馈",
  },
  users: {
    title: "用户管理",
    description: "管理所有注册用户的资料与权限",
  },
  logs: {
    title: "操作日志",
    description: "数据库审计记录，仅供查阅",
  },
};

/** 署名、反馈、用户、日志几个后台页共用的外壳 */
export default function AdminPanelClient({
  section,
}: {
  section: PanelSection;
}) {
  const { user } = useUserContext();
  const csrfToken = useCsrfToken();
  const { title, description } = HEADERS[section];

  return (
    <div className="min-h-screen bg-[#FAFAFA] dark:bg-[#0B0F19] transition-colors duration-500 font-sans">
      <AdminNavbar
        active={section}
        userName={user?.name}
        isLoggedIn={Boolean(user)}
        isSuper={user?.isSuper}
      />

      <main className="pt-24 pb-20 max-w-7xl mx-auto px-6">
        <div className="mb-10">
          <h1 className="text-4xl font-bold text-slate-900 dark:text-slate-50 mb-4">
            {title}
          </h1>
          <p className="max-w-3xl text-sm text-slate-500 dark:text-slate-400">
            {description}
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5 md:p-6">
          {section === "credits" && <CreditAliasPanel csrfToken={csrfToken} />}
          {section === "requests" && (
            <RequestsPanel csrfToken={csrfToken} isSuper={!!user?.isSuper} />
          )}
          {section === "users" && <UserManagePanel csrfToken={csrfToken} />}
          {section === "logs" && <AuditLogsPanel />}
        </div>
      </main>
    </div>
  );
}
