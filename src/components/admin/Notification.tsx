"use client";
import React from "react";
import { Bell, X, Shield, Database, AlertTriangle } from "lucide-react";

interface NotificationProps {
  onClose: () => void;
}

const Notification: React.FC<NotificationProps> = ({ onClose }) => {
  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-[#151921] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl p-8 w-full max-w-4xl relative max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400">
              <Bell className="w-6 h-6" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
              说明与注意
            </h2>
          </div>
          <button
            className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 transition-colors"
            onClick={onClose}
            aria-label="关闭"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="space-y-6 overflow-y-auto pr-2 flex-1">
          {/* Important Alert */}
          <div className="relative p-5 rounded-xl bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/30">
            <div className="flex items-start gap-4">
              <div className="shrink-0 mt-0.5 p-2 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <h4 className="font-bold text-red-700 dark:text-red-300 text-lg">
                    重要提示
                  </h4>
                  <span className="px-2 py-0.5 bg-red-100 dark:bg-red-500/20 rounded-full text-xs text-red-700 dark:text-red-300 font-medium">
                    必读
                  </span>
                </div>
                <ul className="text-sm text-red-600 dark:text-red-300/80 leading-relaxed space-y-2 font-medium">
                  <li className="flex items-start gap-2">
                    <span className="text-red-400 dark:text-red-500 font-bold shrink-0">
                      •
                    </span>
                    <span>数据更改不会立刻同步到主页面 (ISR/CDN缓存)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-red-400 dark:text-red-500 font-bold shrink-0">
                      •
                    </span>
                    <span>在本页面列表看到修改生效即表示数据库更新成功</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* Data Rules */}
          <div className="p-5 rounded-xl bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30">
            <div className="flex items-start gap-4">
              <div className="shrink-0 mt-1 text-blue-500 dark:text-blue-400">
                <Database className="w-6 h-6" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-semibold text-slate-800 dark:text-slate-200 mb-3 text-lg">
                  数据编辑
                </h4>
                <ul className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed space-y-2">
                  {[
                    "新增歌曲时请确保标题和专辑信息准确无误",
                    "作词、作曲、编曲、演唱、出品发行支持多人，请每个输入框只填写一人",
                    "歌曲时长需要换算成秒",
                    "歌词只需填写LRC内容",
                    "修改完成务必点击保存按钮保存",
                  ].map((text, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-blue-400/60 dark:text-blue-500/60 font-bold shrink-0">
                        •
                      </span>
                      <span>{text}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {/* Security Rules */}
          <div className="p-5 rounded-xl bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/30">
            <div className="flex items-start gap-4">
              <div className="shrink-0 mt-1 text-emerald-500 dark:text-emerald-400">
                <Shield className="w-6 h-6" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-semibold text-slate-800 dark:text-slate-200 mb-3 text-lg">
                  权限安全
                </h4>
                <ul className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed space-y-2">
                  {[
                    "请妥善保管账号，不要与他人分享",
                    "定期检查数据变更，确保信息准确性",
                    "如发现异常操作请及时联系管理员",
                  ].map((text, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-emerald-400/60 dark:text-emerald-500/60 font-bold shrink-0">
                        •
                      </span>
                      <span>{text}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 pt-6 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center shrink-0">
          <div className="text-sm text-slate-400">注意事项 · 请仔细阅读</div>
          <button
            onClick={onClose}
            className="px-6 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl font-medium hover:opacity-90 transition-all shadow-lg shadow-slate-500/10"
          >
            我知道了
          </button>
        </div>
      </div>
    </div>
  );
};

export default Notification;
