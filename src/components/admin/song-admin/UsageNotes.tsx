"use client";

import { Bell } from "lucide-react";
import { useState } from "react";
import { NAV_BUTTON_CLASS } from "@/components/shared/nav-button";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { SOLID_BUTTON_CLASS } from "../kit/styles";

const NOTES: { title: string; items: string[]; warn?: boolean }[] = [
  {
    title: "先看这里",
    warn: true,
    items: [
      "改动先存进暂存表，点「发布」才会同步到公开页面",
      "公开页面有缓存，发布后可能要过一会儿才看到",
      "在后台看到修改生效，就说明数据库已经更新成功",
    ],
  },
  {
    title: "数据编辑",
    items: [
      "新增歌曲时请确保标题和专辑信息准确无误",
      "作词、作曲、编曲、演唱、出品发行支持多人，每个输入框只填一人",
      "歌曲时长换算成秒",
      "歌词只填 LRC 内容",
      "改完记得保存",
    ],
  },
  {
    title: "权限安全",
    items: [
      "妥善保管账号，不要与他人分享",
      "定期检查数据变更，确保信息准确",
      "发现异常操作请及时联系管理员",
    ],
  },
];

/** 顶栏常驻的「使用说明」按钮与说明面板 */
export default function UsageNotesButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={NAV_BUTTON_CLASS}
        title="使用说明"
        aria-label="使用说明"
      >
        <Bell size={20} />
      </button>
      <ResponsiveDialog
        open={open}
        onOpenChange={setOpen}
        title="使用说明"
        className="max-w-xl"
        footer={
          <button
            type="button"
            onClick={() => setOpen(false)}
            className={SOLID_BUTTON_CLASS}
          >
            知道了
          </button>
        }
      >
        <div className="space-y-6">
          {NOTES.map((group) => (
            <section key={group.title}>
              <h3
                className={
                  group.warn
                    ? "text-sm text-amber-700 dark:text-amber-400"
                    : "text-sm text-slate-900 dark:text-slate-100"
                }
              >
                {group.title}
              </h3>
              <ul className="mt-2 space-y-1.5 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                {group.items.map((text) => (
                  <li key={text} className="flex gap-2">
                    <span
                      aria-hidden
                      className="text-slate-300 dark:text-slate-600"
                    >
                      ·
                    </span>
                    <span>{text}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </ResponsiveDialog>
    </>
  );
}
